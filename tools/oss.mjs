#!/usr/bin/env node
// Builds data/oss.json for the /oss page: pull requests bedeaf opened in other
// people's repositories, plus bedeaf's own public source repositories.
// Runs before `hugo` in `npm run build`, using the local `gh` login. On any
// failure the previous data/oss.json is kept, so a deploy never breaks on it.
import { execFile } from 'node:child_process';
import { readFile, rename, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const USER = 'bedeaf';
// The profile README and this site are on the page already in other forms.
const SKIP_PROJECTS = new Set(['bedeaf', 'blog']);
const OUT = fileURLToPath(new URL('../data/oss.json', import.meta.url));
const run = promisify(execFile);

async function gh(path, params = {}) {
  const args = ['api', '-X', 'GET', path];
  for (const [k, v] of Object.entries(params)) args.push('-f', `${k}=${v}`);
  const { stdout } = await run('gh', args, { maxBuffer: 32 * 1024 * 1024, timeout: 30_000 });
  return JSON.parse(stdout);
}

// radare2-style titles end in a changelog tag ("... ##print"); show it apart.
export function splitTag(title) {
  const m = /^(.*?)\s*##([A-Za-z0-9_-]+)\s*$/.exec(title);
  return m ? { title: m[1], tag: m[2] } : { title, tag: null };
}

// Pure: GitHub API payloads in, page data out. Closed-unmerged PRs are dropped.
export function shape({ prs, repos, own, now = new Date() }) {
  const byRepo = new Map();
  for (const it of prs) {
    const merged = it.pull_request?.merged_at || null;
    const state = merged ? 'merged' : it.state === 'open' ? 'open' : null;
    if (!state) continue;
    const full = it.repository_url.replace(/^.*\/repos\//, '');
    const { title, tag } = splitTag(it.title);
    const pr = { number: it.number, title, tag, state, url: it.html_url,
                 date: merged || it.created_at };
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

  const projects = own
    .filter(r => !r.fork && !r.archived && !r.private && !SKIP_PROJECTS.has(r.name))
    .map(r => ({ name: r.name, url: r.html_url, description: r.description || '',
                 language: r.language || '', stars: r.stargazers_count, pushed: r.pushed_at }))
    .sort((a, b) => b.stars - a.stars || b.pushed.localeCompare(a.pushed));

  const all = contributions.flatMap(c => c.prs);
  return {
    generated: now.toISOString(),
    user: USER,
    stats: { merged: all.filter(p => p.state === 'merged').length,
             open: all.filter(p => p.state === 'open').length,
             projects: contributions.length },
    contributions,
    projects,
  };
}

async function fetchAll() {
  const prs = [];
  for (let page = 1; page <= 10; page++) {
    const res = await gh('search/issues', { q: `author:${USER} type:pr -user:${USER}`,
                                            per_page: 100, page });
    prs.push(...res.items);
    if (res.items.length < 100) break;
  }
  const repos = {};
  for (const full of new Set(prs.map(it => it.repository_url.replace(/^.*\/repos\//, '')))) {
    repos[full] = await gh(`repos/${full}`);
  }
  const own = await gh(`users/${USER}/repos`, { type: 'owner', per_page: 100 });
  return { prs, repos, own };
}

async function main() {
  try {
    const data = shape(await fetchAll());
    await mkdir(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
    await writeFile(OUT + '.tmp', JSON.stringify(data, null, 2) + '\n');
    await rename(OUT + '.tmp', OUT);
    console.log(`oss: ${data.stats.merged} merged, ${data.stats.open} open, ` +
                `${data.contributions.length} repos, ${data.projects.length} own projects`);
  } catch (err) {
    const kept = await readFile(OUT).then(() => 'keeping the previous data/oss.json',
                                          () => 'no data/oss.json yet; /oss will be empty');
    console.warn(`oss: GitHub fetch failed (${err.message.split('\n')[0]}); ${kept}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
