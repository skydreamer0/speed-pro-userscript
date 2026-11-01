// Mutation negative controls: the real regression suite must reject each removed safety guard.
// Work only in a temporary copy; never mutate the checkout or make network requests.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'speed-pro.user.js'), 'utf8');
const cases = [
  ['G1 remove locale support', '(?:zh-Hant\\/)?', '', '/zh-Hant/video'],
  ['G2 trust route-only CID', `    function getBilibiliSponsorIdentity() {\n        return null;\n    }`,
    `    function getBilibiliSponsorIdentity() {\n        return {platform:'bilibili',videoId:'BV1abcdEFGH2',cid:'202',page:2};\n    }`, 'Expected values to be strictly equal'],
  ['G3 omit duration freshness', 'segment.videoDuration <= 0 || Math.abs(segment.videoDuration - duration) > 2',
    'segment.videoDuration <= 0', '999'],
  ['core ignore empty/reload invalidation', `            MediaCoordinator.invalidate();\n            if (event.type !== 'loadedmetadata') MediaCoordinator.ready = false;`,
    `            if (source) MediaCoordinator.invalidate();\n            if (false) MediaCoordinator.ready = false;`, 'Expected values to be strictly equal'],
  ['resume wrong completion margin', 'd - t <= Math.min(d / 2, Math.max(15, d * 0.01))',
    'd - t <= Math.min(15, Math.max(1, d * 0.01))', 'Expected values to be strictly equal']
];
for (const [name, before, after, expectedFailure] of cases) {
  assert(source.includes(before), `Mutation anchor exists: ${name}`);
  const dir = mkdtempSync(join(tmpdir(), 'speed-negative-'));
  try {
    cpSync(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'speed-pro.user.js'), source.replace(before, after));
    const result = spawnSync(process.execPath, ['scripts/runtime-test.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.error, undefined, `${name}: runner started`);
    assert.notEqual(result.status, 0, `${name}: regression suite rejected mutant`);
    assert((result.stdout + result.stderr).includes(expectedFailure), `${name}: expected assertion failed`);
    console.log(`PASS negative control rejected: ${name}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
