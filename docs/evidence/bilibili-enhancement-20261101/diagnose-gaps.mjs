// Read-only diagnostic against exact exported PR #8 production source. No website traffic.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourcePath = process.argv[2];
if (!sourcePath || process.argv.length !== 3) {
  console.error('Usage: node diagnose-gaps.mjs <path-to-pinned-speed-pro.user.js>');
  process.exit(2);
}
const bytes = readFileSync(sourcePath);
const expected = '4474d2f7ddb840861248af0fc25acdec6db3b5a5ec1aa65e4af65608a9174ea1';
assert.equal(createHash('sha256').update(bytes).digest('hex'), expected,
  'Source hash mismatch: diagnostics require PR #8 commit e46f05cb170ebbb534341ea84cce442a7e6c16cb');
const source = bytes.toString('utf8');
const location={hostname:'www.bilibili.com',pathname:'/video/BV1abcdEFGH2/',href:'https://www.bilibili.com/video/BV1abcdEFGH2/?p=1'};
const context=vm.createContext({location,URL,structuredClone,console,localStorage:{getItem:()=>null},window:{},document:{}});
vm.runInContext(source.slice(0,source.indexOf("    document.addEventListener('keydown'"))+`globalThis.api={inScope,getVideoId,getBilibiliSponsorIdentity,normalizeSponsorBucket};})();`,context);
assert.equal(context.api.inScope(),true);
location.pathname='/zh-Hant/video/BV1abcdEFGH2/';location.href='https://www.bilibili.com'+location.pathname+'?p=1';
assert.equal(context.api.inScope(),false);
assert.equal(context.api.getBilibiliSponsorIdentity(),null);
console.log('REPRODUCED GAP G1: /zh-Hant/video is rejected by current runtime; no corresponding metadata match either.');
location.pathname='/video/BV1abcdEFGH2/';location.href='https://www.bilibili.com'+location.pathname+'?p=2';
context.window.__INITIAL_STATE__={videoData:{bvid:'BV1abcdEFGH2',pages:[{cid:101},{cid:202}]}};
assert.equal(context.api.getBilibiliSponsorIdentity().cid,'202');
console.log('LIMIT G2: identity inferred from URL p + initial pages; this fixture has no current media or active-player CID, yet returns CID 202. This is not proof of active-media CID.');
const identity={platform:'bilibili',videoId:'BV1abcdEFGH2',cid:'202'};
const result=context.api.normalizeSponsorBucket([{videoID:identity.videoId,segments:[{segment:[5,12],cid:'202',category:'sponsor',actionType:'skip',videoDuration:999,UUID:'stale-duration'}]}],identity,120);
assert.equal(result.segments.length,1);
console.log('REPRODUCED GAP G3: known stale videoDuration=999 accepted for current duration=120.');
console.log('Diagnostic assertions passed = gaps confirmed, NOT feature acceptance. No source edits.');
