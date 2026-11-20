#!/usr/bin/env node
// Builds data/github.json for the /github page: the GitHub profile, last year's
// contribution calendar, and the pull requests bedeaf opened in other people's
// repositories. Runs before `hugo` in `npm run build`, using the `gh` login
// (GH_TOKEN in CI, where the deploy workflow also reruns it every 6 hours).
// On any failure the previous data/github.json is kept, so a deploy never
// breaks on it.
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const USER = 'bedeaf';
const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const OUT = DATA_DIR + 'github.json';
const run = promisify(execFile);

const PROFILE = `query($login: String!) {
  user(login: $login) {
    name login bio location avatarUrl url createdAt
    followers { totalCount }
    following { totalCount }
    contributionsCollection {
      totalCommitContributions totalPullRequestContributions
      totalPullRequestReviewContributions totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

async function gh(args) {
  const { stdout } = await run('gh', args, { maxBuffer: 32 * 1024 * 1024, timeout: 30_000 });
  return JSON.parse(stdout);
}
const rest = (path, params = {}) =>
  gh(['api', '-X', 'GET', path, ...Object.entries(params).flatMap(([k, v]) => ['-f', `${k}=${v}`])]);
const graphql = (query, vars) =>
  gh(['api', 'graphql', '-f', `query=${query}`, ...Object.entries(vars).flatMap(([k, v]) => ['-f', `${k}=${v}`])]);

// radare2-style titles end in a changelog tag ("... ##print"); show it apart.
export function splitTag(title) {
  const m = /^(.*?)\s*##([A-Za-z0-9_-]+)\s*$/.exec(title);
  return m ? { title: m[1], tag: m[2] } : { title, tag: null };
}

// "Mert | 0x00BEDEAF" -> name and handle tag, shown on separate lines.
export function splitName(name, login) {
  const [real, tag] = (name || login).split(/\s+\|\s+/, 2);
  return { name: real, tag: tag || null };
}

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// GitHub's calendar: week columns starting on Sunday, the first one partial.
export function calendar(cal) {
  const days = cal.weeks.flatMap(w => w.contributionDays)
    .map(d => ({ d: d.date, n: d.contributionCount, l: LEVEL[d.contributionLevel] ?? 0 }));
  if (!days.length) return null;
  const pad = new Date(days[0].d + 'T00:00:00Z').getUTCDay();
  const weekOf = i => Math.floor((pad + i) / 7);

  // Label a column with the month that starts in it; skip labels that would
  // collide with the previous one (GitHub does the same for the first month).
  const months = [];
  days.forEach((day, i) => {
    if (i !== 0 && !day.d.endsWith('-01')) return;
    const week = i === 0 ? 0 : weekOf(i);
    const last = months.at(-1);
    if (last && week - last.week < 3) { if (last.week === 0) months.pop(); else return; }
    months.push({ week, d: day.d });
  });

  let longest = 0, streak = 0;
  for (const day of days) { streak = day.n > 0 ? streak + 1 : 0; longest = Math.max(longest, streak); }
  let i = days.length - 1, current = 0;
  if (days[i].n === 0) i--;                 // today may simply not have started yet
  for (; i >= 0 && days[i].n > 0; i--) current++;
  const best = days.reduce((a, b) => (b.n > a.n ? b : a));

  return { total: cal.totalContributions, pad, weeks: weekOf(days.length - 1) + 1, days, months,
           active: days.filter(d => d.n > 0).length, streak: { current, longest },
           best: best.n > 0 ? { d: best.d, n: best.n } : null };
}

// Pure: GitHub API payloads in, page data out. Closed-unmerged PRs are dropped.
export function shape({ user, prs, repos, now = new Date() }) {
  const byRepo = new Map();
  for (const it of prs) {
    const merged = it.pull_request?.merged_at || null;
    const state = merged ? 'merged' : it.state === 'open' ? 'open' : null;
    if (!state) continue;
    const full = it.repository_url.replace(/^.*\/repos\//, '');
    const { title, tag } = splitTag(it.title);
    const pr = { number: it.number, title, tag, state, url: it.html_url, opened: it.created_at,
                 date: merged || it.created_at,
                 merge_minutes: merged ? Math.round((Date.parse(merged) - Date.parse(it.created_at)) / 60_000) : null };
    if (!byRepo.has(full)) byRepo.set(full, []);
    byRepo.get(full).push(pr);
  }
  const contributions = [...byRepo].map(([full, list]) => {
    const meta = repos[full] || {};
    list.sort((a, b) => b.date.localeCompare(a.date));
    return { repo: full, url: meta.html_url || `https://github.com/${full}`,
             description: meta.description || '', language: meta.language || '',
             stars: meta.stargazers_count ?? null, prs: list };
  }).sort((a, b) => b.prs[0].date.localeCompare(a.prs[0].date));
  const all = contributions.flatMap(c => c.prs);

  const cc = user.contributionsCollection;
  return {
    generated: now.toISOString(),
    profile: { ...splitName(user.name, user.login), login: user.login, url: user.url,
               avatar: user.avatarUrl, bio: (user.bio || '').trim(), location: (user.location || '').trim(),
               since: user.createdAt, followers: user.followers.totalCount, following: user.following.totalCount },
    calendar: calendar(cc.contributionCalendar),
    breakdown: { commits: cc.totalCommitContributions, prs: cc.totalPullRequestContributions,
                 reviews: cc.totalPullRequestReviewContributions, issues: cc.totalIssueContributions,
                 private: cc.restrictedContributionsCount },
    stats: { merged: all.filter(p => p.state === 'merged').length,
             open: all.filter(p => p.state === 'open').length, repos: contributions.length },
    contributions,
  };
}

async function fetchAll() {
  const { data } = await graphql(PROFILE, { login: USER });
  if (!data?.user) throw new Error('GitHub returned no user');
  const prs = [];
  for (let page = 1; page <= 10; page++) {
    const res = await rest('search/issues', { q: `author:${USER} type:pr -user:${USER}`, per_page: 100, page });
    prs.push(...res.items);
    if (res.items.length < 100) break;
  }
  const repos = {};
  for (const full of new Set(prs.map(it => it.repository_url.replace(/^.*\/repos\//, '')))) {
    repos[full] = await rest(`repos/${full}`);
  }
  return { user: data.user, prs, repos };
}

async function main() {
  try {
    const out = shape(await fetchAll());
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(OUT + '.tmp', JSON.stringify(out, null, 2) + '\n');
    await rename(OUT + '.tmp', OUT);
    const c = out.calendar;
    console.log(`prof: ${c ? c.total : 0} contributions, ${out.stats.merged} merged / ` +
                `${out.stats.open} open PRs in ${out.stats.repos} repos`);
  } catch (err) {
    const kept = await readFile(OUT).then(() => 'keeping the previous data/github.json',
                                          () => 'no data/github.json yet; /github will be empty');
    console.warn(`prof: GitHub fetch failed (${err.message.split('\n')[0]}); ${kept}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
