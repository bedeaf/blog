import assert from 'node:assert/strict';
import test from 'node:test';
import { shape, splitTag } from '../tools/oss.mjs';

const pr = (repo, number, state, created, merged = null, title = `PR ${number}`) => ({
  repository_url: `https://api.github.com/repos/${repo}`, number, state, title,
  html_url: `https://github.com/${repo}/pull/${number}`, created_at: created,
  pull_request: { merged_at: merged },
});
const own = (name, stars, pushed, extra = {}) => ({
  name, html_url: `https://github.com/bedeaf/${name}`, description: name, language: 'C',
  stargazers_count: stars, pushed_at: pushed, fork: false, archived: false, private: false, ...extra,
});

test('splitTag moves a trailing radare2 changelog tag out of the title', () => {
  assert.deepEqual(splitTag('Color the variables ##print'), { title: 'Color the variables', tag: 'print' });
  assert.deepEqual(splitTag('Plain title'), { title: 'Plain title', tag: null });
  assert.deepEqual(splitTag('Mentions ##tag in the middle'), { title: 'Mentions ##tag in the middle', tag: null });
});

test('shape keeps merged and open PRs, drops closed-unmerged ones, and counts them', () => {
  const data = shape({
    prs: [pr('a/x', 1, 'closed', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
          pr('a/x', 2, 'open', '2026-03-01T00:00:00Z'),
          pr('b/y', 3, 'closed', '2026-02-01T00:00:00Z')],
    repos: { 'a/x': { html_url: 'https://github.com/a/x', description: 'X', language: 'C', stargazers_count: 7 } },
    own: [], now: new Date('2026-11-19T00:00:00Z'),
  });
  assert.deepEqual(data.stats, { merged: 1, open: 1, projects: 1 });
  assert.equal(data.contributions.length, 1);
  assert.deepEqual(data.contributions[0].prs.map(p => [p.number, p.state]), [[2, 'open'], [1, 'merged']]);
  assert.equal(data.contributions[0].prs[1].date, '2026-01-02T00:00:00Z', 'merged PRs are dated by merge time');
  assert.equal(data.generated, '2026-11-19T00:00:00.000Z');
});

test('shape orders repositories by their latest PR and tolerates missing metadata', () => {
  const data = shape({
    prs: [pr('old/r', 1, 'open', '2025-01-01T00:00:00Z'), pr('new/r', 2, 'open', '2026-06-01T00:00:00Z')],
    repos: {}, own: [],
  });
  assert.deepEqual(data.contributions.map(c => c.repo), ['new/r', 'old/r']);
  assert.equal(data.contributions[0].url, 'https://github.com/new/r');
  assert.equal(data.contributions[0].stars, null);
});

test('own projects skip forks, archives, private repos and the profile/blog repos', () => {
  const data = shape({ prs: [], repos: {}, own: [
    own('gom', 1, '2026-10-01T00:00:00Z'), own('ppwm', 1, '2026-11-01T00:00:00Z'),
    own('peeq', 0, '2026-11-10T00:00:00Z'), own('forked', 9, '2026-11-01T00:00:00Z', { fork: true }),
    own('old', 9, '2026-11-01T00:00:00Z', { archived: true }), own('bedeaf', 9, '2026-11-01T00:00:00Z'),
    own('blog', 9, '2026-11-01T00:00:00Z'),
  ] });
  assert.deepEqual(data.projects.map(p => p.name), ['ppwm', 'gom', 'peeq']);
});
