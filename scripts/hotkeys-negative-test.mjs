// Mutation controls prove the dispatch regressions fail for behavioral reasons.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const source=readFileSync(new URL('../speed-pro.user.js',import.meta.url),'utf8');
const cases=[
 ['exact modifier matching','Boolean(key.alt) === Boolean(event.altKey) && Boolean(key.shift) === Boolean(event.shiftKey)','true'],
 ['AltGraph protection',"event.getModifierState?.('AltGraph') ||",''],
 ['one-shot autorepeat',"        // Holding a key cannot repeatedly", "        // Holding a key cannot repeatedly"],
 ['vertical wheel guard','!Number.isFinite(event.deltaY) || event.deltaY === 0','false'],
 ['held turbo yields to explicit rate','        turboActive = false;\n        if (!locked && !holdActive)', '        if (!locked && !holdActive)'],
 ['Bilibili native protection','return HOTKEYS.filter(key => !(isBilibili && key.nativeOnBilibili));','return HOTKEYS;'],
];
const dir=mkdtempSync(join(tmpdir(),'playback-hotkeys-negative-'));
try {
 for(const [name,before,after] of cases){
  assert(source.includes(before),`mutation anchor: ${name}`);
  let mutated=source.replace(before,after);
  if(name==='one-shot autorepeat'){
   const start=mutated.indexOf("    document.addEventListener('keydown'");
   const end=mutated.indexOf("    document.addEventListener('keyup'",start);
   const block=mutated.slice(start,end);assert(block.includes('        if (event.repeat) return;'));
   mutated=mutated.slice(0,start)+block.replace('        if (event.repeat) return;','')+mutated.slice(end);
  }
  const path=join(dir,'mutant.user.js');writeFileSync(path,mutated);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./hotkeys-test.mjs',import.meta.url))],{env:{...process.env,PLAYBACK_SOURCE:path},encoding:'utf8',timeout:30000});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0,`mutation survived: ${name}`);
  assert.match(result.stderr,/AssertionError/,`expected behavioral failure: ${name}`);
  console.log(`PASS negative control rejected: ${name}`);
 }
} finally {rmSync(dir,{recursive:true,force:true});}
