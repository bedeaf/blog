import assert from 'node:assert/strict';
import test from 'node:test';
import { calendar, shape, splitName, splitTag } from '../tools/prof.mjs';

const pr = (repo, number, state, created, merged = null, title = `PR ${number}`) => ({
  repository_url: `https://api.github.com/repos/${repo}`, number, state, title,
  html_url: `https://github.com/${repo}/pull/${number}`, created_at: created,
  pull_request: { merged_at: merged },
});
// Consecutive days starting at `start`, counts given in order.
const cal = (start, counts) => {
  const t0 = Date.parse(start + 'T00:00:00Z');
  const days = counts.map((n, i) => ({ date: new Date(t0 + i * 864e5).toISOString().slice(0, 10),
    contributionCount: n, contributionLevel: n ? 'FIRST_QUARTILE' : 'NONE' }));
  return { totalContributions: counts.reduce((a, b) => a + b, 0), weeks: [{ contributionDays: days }] };
};
const user = (extra = {}) => ({
  name: 'Mert | 0x00BEDEAF', login: 'bedeaf', url: 'https://github.com/bedeaf', avatarUrl: 'a',
  bio: ' bio ', location: 'Eskişehir, Türkiye ', createdAt: '2025-08-09T18:59:20Z',
  followers: { totalCount: 11 }, following: { totalCount: 12 },
  contributionsCollection: { totalCommitContributions: 5, totalPullRequestContributions: 2,
    totalPullRequestReviewContributions: 0, totalIssueContributions: 0, restrictedContributionsCount: 0,
    contributionCalendar: cal('2026-11-15', [1, 0, 2]) },
  ...extra,
});

test('splitTag moves a trailing radare2 changelog tag out of the title', () => {
  assert.deepEqual(splitTag('Color the variables ##print'), { title: 'Color the variables', tag: 'print' });
  assert.deepEqual(splitTag('Plain title'), { title: 'Plain title', tag: null });
  assert.deepEqual(splitTag('Mentions ##tag in the middle'), { title: 'Mentions ##tag in the middle', tag: null });
});

test('splitName separates the real name from the handle tag', () => {
  assert.deepEqual(splitName('Mert | 0x00BEDEAF', 'bedeaf'), { name: 'Mert', tag: '0x00BEDEAF' });
  assert.deepEqual(splitName('Mert', 'bedeaf'), { name: 'Mert', tag: null });
  assert.deepEqual(splitName(null, 'bedeaf'), { name: 'bedeaf', tag: null });
});

test('calendar pads the first partial week and counts weeks from Sunday', () => {
  const c = calendar(cal('2026-11-18', [0, 0, 0, 0, 0]));   // Wednesday .. Sunday
  assert.equal(c.pad, 3);
  assert.equal(c.weeks, 2);
});

test('calendar streaks: longest run, and a current run that tolerates an empty today', () => {
  const c = calendar(cal('2026-11-01', [1, 1, 1, 0, 2, 3, 0]));
  assert.deepEqual(c.streak, { current: 2, longest: 3 });
  assert.equal(c.active, 5);
  assert.deepEqual(c.best, { d: '2026-11-06', n: 3 });
  assert.deepEqual(calendar(cal('2026-11-01', [1, 0, 0])).streak.current, 0);
  assert.equal(calendar(cal('2026-11-01', [0, 0])).best, null);
});

test('calendar labels month starts and drops a first label that would collide', () => {
  const counts = Array(70).fill(0);                          // 2026-08-28 .. 2026-11-05
  const c = calendar(cal('2026-08-28', counts));
  assert.deepEqual(c.months.map(m => m.d), ['2026-09-01', '2026-10-01', '2026-11-01']);
  const early = calendar(cal('2026-08-02', Array(40).fill(0)));
  assert.deepEqual(early.months.map(m => m.d), ['2026-08-02', '2026-09-01']);
});

test('shape keeps merged and open PRs, drops closed-unmerged ones, and times merges', () => {
  const data = shape({ user: user(), now: new Date('2026-11-19T00:00:00Z'),
    prs: [pr('a/x', 1, 'closed', '2026-01-01T10:00:00Z', '2026-01-01T12:30:00Z'),
          pr('a/x', 2, 'open', '2026-03-01T00:00:00Z'),
          pr('b/y', 3, 'closed', '2026-02-01T00:00:00Z')],
    repos: { 'a/x': { html_url: 'https://github.com/a/x', description: 'X', language: 'C', stargazers_count: 7 } } });
  assert.deepEqual(data.stats, { merged: 1, open: 1, repos: 1 });
  const [open, merged] = data.contributions[0].prs;
  assert.deepEqual([open.number, open.merge_minutes], [2, null]);
  assert.deepEqual([merged.number, merged.merge_minutes, merged.date], [1, 150, '2026-01-01T12:30:00Z']);
  assert.equal(data.generated, '2026-11-19T00:00:00.000Z');
});

test('shape builds the profile and contribution breakdown', () => {
  const data = shape({ user: user(), prs: [], repos: {} });
  assert.deepEqual(data.profile, { name: 'Mert', tag: '0x00BEDEAF', login: 'bedeaf',
    url: 'https://github.com/bedeaf', avatar: 'a', bio: 'bio', location: 'Eskişehir, Türkiye',
    since: '2025-08-09T18:59:20Z', followers: 11, following: 12 });
  assert.deepEqual(data.breakdown, { commits: 5, prs: 2, reviews: 0, issues: 0, private: 0 });
  assert.equal(data.calendar.total, 3);
  assert.deepEqual(data.contributions, []);
});

test('shape orders repositories by their latest PR and tolerates missing metadata', () => {
  const data = shape({ user: user(), repos: {},
    prs: [pr('old/r', 1, 'open', '2025-01-01T00:00:00Z'), pr('new/r', 2, 'open', '2026-06-01T00:00:00Z')] });
  assert.deepEqual(data.contributions.map(c => c.repo), ['new/r', 'old/r']);
  assert.equal(data.contributions[0].url, 'https://github.com/new/r');
  assert.equal(data.contributions[0].stars, null);
});
