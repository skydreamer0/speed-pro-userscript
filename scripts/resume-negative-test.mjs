// Mutation checks execute the production fixtures against deliberately broken copies.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const source=readFileSync(new URL('../speed-pro.user.js',import.meta.url),'utf8');
const cases=[
 ['thumbnail playlist separation',"return ResumeManager.keyFor(id, list);","return ResumeManager.keyFor(id);"],
 ['stale writer protection','if (state.remoteChanged && !(!document.hidden && (state.localIntent ||','if (false && !(!document.hidden && (state.localIntent ||'],
 ['cross-tab notification',"state.remoteChanged = true;\n                    state.observedTime", "state.remoteChanged = false;\n                    state.observedTime"],
 ['invalid or expired progress','const saved = key && records.get(key);','const saved = key && ResumeManager.read(key);'],
 ['automatic seek suppression', 'Math.abs(Number(video.currentTime) - state.automaticSeekTarget) < 0.25', 'false'],
 ['stationary reattach guard', 'if (!state.localIntent && Math.abs(t - state.observedTime) < 0.1) return;', '/* mutation: removed stationary guard */'],
 ['remote playback untouched','// Remote updates repaint indicators, never seek the currently playing video.',"if (state) state.video.currentTime = this.read(state.ctx.key)?.time || 0;"],
];
const dir=mkdtempSync(join(tmpdir(),'playback-resume-negative-'));
try {
 for(const [name,from,to] of cases){
  assert(source.includes(from),`Mutation anchor missing: ${name}`);
  const path=join(dir,'candidate.js');writeFileSync(path,source.replace(from,to));
  const result=spawnSync(process.execPath,['scripts/resume-sync-test.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PLAYBACK_SOURCE:path},encoding:'utf8',timeout:30000});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0,`Mutation survived: ${name}`);
  assert(result.stderr.includes('AssertionError'),`Expected behavioral failure: ${name}\n${result.stderr}`);
  console.log(`PASS negative control rejected: ${name}`);
 }
} finally {rmSync(dir,{recursive:true,force:true});}
