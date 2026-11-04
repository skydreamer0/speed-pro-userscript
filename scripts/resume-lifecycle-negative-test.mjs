// Ensure lifecycle regressions fail for the intended behavioral reason, not syntax or harness errors.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source=readFileSync(new URL('../speed-pro.user.js',import.meta.url),'utf8');
const testFile=new URL('./resume-lifecycle-test.mjs',import.meta.url);
const mutations=[
 ['invalidate before checkpoint flush','player replacement flushes',
  '        unbindVideo();\n        MediaCoordinator.invalidate();',
  '        MediaCoordinator.invalidate();\n        unbindVideo();'],
 ['discard beginning-of-video seek intent','native or manual',
  '            state.userSeeked = true;',
  '            if (video.currentTime > 1 || state.ctx.explicitTime) state.userSeeked = true;']
];
const directory=mkdtempSync(join(tmpdir(),'playback-lifecycle-negative-'));
try {
 for(const [name,match,before,after] of mutations) {
  assert(source.includes(before),`mutation target exists: ${name}`);
  const path=join(directory,'mutant.user.js'); writeFileSync(path,source.replace(before,after));
  const syntax=spawnSync(process.execPath,['--check',path],{encoding:'utf8',timeout:30000}); assert.equal(syntax.status,0,syntax.stderr);
  const result=spawnSync(process.execPath,[fileURLToPath(testFile)],{encoding:'utf8',timeout:30000,env:{...process.env,PLAYBACK_SOURCE:path,TEST_MATCH:match}});
  assert.notEqual(result.status,0,`regression not detected: ${name}`);
  assert.match(result.stderr,/AssertionError/,`must fail a behavior assertion: ${name}`);
  console.log(`PASS negative control rejected: ${name}`);
 }
} finally { rmSync(directory,{recursive:true,force:true}); }
