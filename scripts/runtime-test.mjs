// Runs production functions in an isolated VM; browser fixture tests complement this harness.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../speed-pro.user.js', import.meta.url), 'utf8');
function fixture(host = 'www.bilibili.com', path = '/video/BV1abcdEFGH2/') {
  const videos = []; const jobs = []; const requests = []; const store = new Map();
  const localStorage = { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,String(v)),
    removeItem: k => store.delete(k), key: i => [...store.keys()][i] || null, get length() { return store.size; } };
  const location = { hostname: host, href: `https://${host}${path}?p=1`,
    get pathname() { return new URL(this.href).pathname; }, set pathname(value) { const url = new URL(this.href); url.pathname=value; this.href=url.href; } };
  const document = { querySelector: () => null, querySelectorAll: selector => videos.filter(v => selector === 'video' || v.main), getElementById: () => null };
  const context = vm.createContext({ location, document, window: { innerWidth: 1000, innerHeight: 800 },
    structuredClone, URL, console, crypto: webcrypto, TextEncoder, setTimeout: fn => (jobs.push(fn), jobs.length), clearTimeout: () => {},
    localStorage, GM_xmlhttpRequest: x => requests.push(x) });
  // Export a private test seam in the VM only, never in the installed userscript.
  vm.runInContext(source.slice(0, source.indexOf("    document.addEventListener('keydown'")) + `
    let testToast = null;
    showToast = (message, options) => { testToast = { message, options }; }; updateControlUI = () => {}; renderPanelValues = () => {};
    globalThis.api = { getVideo, bindVideo, startHold, stopHold, toggleLock, setPreset, enforceRate,
      ignoreInput, fetchSponsorSegments, releaseTemporaryHold, stateFor, coordinator: MediaCoordinator, resume: ResumeManager, biliIdentity: getBilibiliSponsorIdentity, normalizeSponsorBucket, parseBilibiliRoute, inScope, checkSponsorSkip,
      toast: () => testToast, sponsorState: () => ({segments: sponsorSegments, context: sponsorContext}), adAssist: handleAdAssist, adMuteRestore: restoreAdMute, cosmeticAds: applyCosmeticAdFiltering,
      media: () => currentVideo, flags: () => ({locked, holdActive}),
      navigation: () => { currentVideoId = getVideoId(); }, defaults: () => settings };
  })();`, context);
  const video = (rate = 1, main = true) => {
    const listeners = new Map(); let actual = rate; let writes = 0;
    const v = { main, paused: false, ended: false, muted: false, seeking: false, readyState: 4, currentTime: 0, duration: 120, src: 'one.mp4', currentSrc: 'one.mp4',
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 }),
      addEventListener: (type, fn) => { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); },
      removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
      emit: type => [...(listeners.get(type) || [])].forEach(fn => fn({ type })),
      count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
      writes: () => writes, reset: false,
      get playbackRate() { return actual; }, set playbackRate(value) { writes++; actual = v.reset ? 1 : value; v.emit('ratechange'); } };
    videos.push(v); return v;
  };
  const drain = () => { let i = 0; while (jobs.length) { assert(++i < 50, 'finite timer work'); jobs.shift()(); } };
  return { ...context.api, video, videos, location, requests, store, win: context.window, doc: context.document, drain };
}
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
test('Bilibili main-only selection and unsupported SPA exit', () => {
 const f=fixture(); f.video(1,false); assert.equal(f.getVideo(),null); const main=f.video(); assert.equal(f.getVideo(),main);
 f.location.pathname='/bangumi/play/ep1'; assert.equal(f.getVideo(),null);
});
test('hold restores owned rate, never transfers to replacement', () => {
 const f=fixture(); const a=f.video(1.25); f.bindVideo(a); f.startHold(); assert.equal(a.playbackRate,3);
 const b=f.video(1.5); f.bindVideo(b); assert.equal(a.playbackRate,1.25); assert.equal(b.playbackRate,1.5); assert.equal(f.flags().holdActive,false); assert.equal(a.count(),0);
});
test('lock transfers and restores each baseline; repeated bindings do not duplicate', () => {
 const f=fixture(); const a=f.video(1.25); f.bindVideo(a); f.toggleLock(); const b=f.video(1.5); f.videos.shift(); f.bindVideo(b); f.drain();
 assert.equal(a.playbackRate,1.25); assert.equal(b.playbackRate,3); const count=b.count(); f.bindVideo(b); assert.equal(b.count(),count); f.toggleLock(); assert.equal(b.playbackRate,1.5);
});
test('adversarial rate reset is bounded across metadata events and watchdog', () => {
 const f=fixture(); const a=f.video(); a.reset=true; f.bindVideo(a); f.setPreset(2); f.drain(); assert.equal(a.writes(),4); assert.equal(f.stateFor(a).blocked,true);
 for(let i=0;i<20;i++){ a.emit('loadstart'); a.emit('loadedmetadata'); f.enforceRate(); f.drain(); }
 assert.equal(a.writes(),4); a.reset=false; f.setPreset(2); assert.equal(a.playbackRate,2);
});
test('opt-in resume stores standalone and playlist checkpoints separately', () => {
 const f=fixture('www.youtube.com','/watch');
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 f.defaults().resumeEnabled=true;
 const v=f.video(); f.bindVideo(v); v.currentTime=40; f.resume.save(v,true);
 const key=f.resume.keyFor('abcdefghijk');
 assert.equal(f.resume.read(key).time,40);
 f.resume.detach();
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk&list=PLtest123';
 f.resume.attach(v); v.currentTime=65; f.resume.save(v,true);
 assert.equal(f.resume.read(f.resume.keyFor('abcdefghijk','PLtest123')).time,65);
 assert.equal(f.resume.read(key).time,40);
});
test('resume respects explicit YouTube t, completion, and stale checkpoints', () => {
 const f=fixture('www.youtube.com','/watch'); const v=f.video();
 f.defaults().resumeEnabled=true;
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 f.bindVideo(v); f.resume.write(f.resume.keyFor('abcdefghijk'),
    {time:30,duration:120,completed:false,savedAt:Date.now()});
 f.resume.detach(); // Reset initial no-checkpoint attempt before simulating a fresh page.
 f.resume.attach(v); assert.equal(f.resume.tryRestore(v),true); assert.equal(v.currentTime,30);
 f.resume.detach(); v.currentTime=0;
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk&t=10';
 f.resume.attach(v); assert.equal(f.resume.tryRestore(v),false); assert.equal(v.currentTime,0);
});
test('media coordinator rejects stale generation and invalid seek', () => {
 const f=fixture(); const first=f.video(1.25); f.bindVideo(first);
 const token=f.coordinator.snapshot(); first.currentTime=10; first.duration=100;
 assert.equal(f.coordinator.seek(token,20),true); assert.equal(first.currentTime,20);
 assert.equal(f.coordinator.seek(token,150),false);
 const second=f.video(1.5); f.bindVideo(second);
 assert.equal(f.coordinator.seek(token,25),false); assert.equal(first.currentTime,20);
});
test('media reload cancels hold and keeps independent baseline', () => {
 const f=fixture(); const a=f.video(1.5); f.bindVideo(a); f.startHold(); a.emit('loadstart'); assert.equal(a.playbackRate,1.5); assert.equal(f.flags().holdActive,false);
});
test('same-node source replacement cannot adopt our own locked rate as baseline', () => {
 const f=fixture(); const a=f.video(1.25); f.bindVideo(a); f.setPreset(3);
 a.src=a.currentSrc='two.mp4'; a.emit('loadstart'); a.emit('loadedmetadata'); f.drain();
 f.toggleLock(); assert.equal(a.playbackRate,1.25);
});
test('ad assist only acts on confirmed ad and restores self-owned mute', () => {
 const f=fixture('www.youtube.com','/watch'); const v=f.video(); f.bindVideo(v);
 let showing=false, clicks=0;
 const player={classList:{contains: c => c==='ad-showing' && showing}};
 const button={disabled:false,offsetParent:{},getAttribute:()=>null,click:()=>{clicks++;}};
 f.doc.querySelector = selector => selector==='#movie_player' ? player :
   selector.includes('skip-button') ? button : null;
 f.defaults().muteAds=true; f.defaults().autoSkipAds=true;
 f.adAssist(); assert.equal(v.muted,false); assert.equal(clicks,0);
 showing=true; f.adAssist(); assert.equal(v.muted,true); assert.equal(clicks,1);
 showing=false; f.adAssist(); assert.equal(v.muted,false);
});
test('cosmetic ad CSS opt-in toggles without touching player', () => {
 const f=fixture('www.youtube.com','/watch'); const styles=[];
 f.doc.head={appendChild: node=>styles.push(node)};
 f.doc.createElement=()=>({remove(){ styles.splice(styles.indexOf(this),1); }});
 f.doc.getElementById=id=>styles.find(node=>node.id===id)||null;
 f.cosmeticAds(); assert.equal(styles.length,0);
 f.defaults().cosmeticAdFiltering=true; f.cosmeticAds(); assert.equal(styles.length,1);
 assert(styles[0].textContent.includes('#masthead-ad'));
 f.defaults().cosmeticAdFiltering=false; f.cosmeticAds(); assert.equal(styles.length,0);
});
test('Bilibili route CID never substitutes for verified active-media identity', () => {
 const f=fixture('www.bilibili.com','/video/BV1abcdEFGH2/');
 f.location.href='https://www.bilibili.com/video/BV1abcdEFGH2/?p=2';
 f.win.__INITIAL_STATE__={videoData:{bvid:'BV1abcdEFGH2',pages:[{cid:101},{cid:202}]}};
 assert.equal(f.biliIdentity(),null);
 const v=f.video(); f.bindVideo(v); assert.equal(f.biliIdentity(),null); // Route CID is not active-media evidence.
 f.location.href='https://www.bilibili.com/video/BV1abcdEFGH2/?p=3';
 assert.equal(f.biliIdentity(),null);
});
test('Sponsor normalized bucket refuses wrong CID, invalid ranges and full labels', () => {
 const f=fixture('www.bilibili.com');
 const identity={platform:'bilibili',videoId:'BV1abcdEFGH2',cid:'202'};
 const result=f.normalizeSponsorBucket([{videoID:identity.videoId,segments:[
  {segment:[5,12],cid:'101',category:'sponsor',actionType:'skip',UUID:'bad-page'},
  {segment:[15,22],cid:'202',videoDuration:120,category:'sponsor',actionType:'skip',UUID:'good'},
  {segment:[0,1200],cid:'202',videoDuration:120,category:'sponsor',actionType:'skip'},
  {segment:[0,120],cid:'202',videoDuration:120,category:'selfpromo',actionType:'full'}
 ]}],identity,120);
 assert.equal(result.segments.length,1);
 assert.equal(result.segments[0].uuid,'good');
 assert.equal(result.fullLabel,'selfpromo');
});
test('all non-YouTube adapters emit zero SponsorBlock requests', () => {
 for(const host of ['www.bilibili.com','www.facebook.com','www.instagram.com','www.threads.net']) { const f=fixture(host); f.video(); f.navigation(); f.fetchSponsorSegments(); assert.equal(f.requests.length,0); }
});
test('four existing sites retain video control', () => {
 for(const host of ['www.youtube.com','www.facebook.com','www.instagram.com','www.threads.com']) { const f=fixture(host); const v=f.video(1.25); f.bindVideo(v); f.setPreset(2); assert.equal(v.playbackRate,2); f.toggleLock(); assert.equal(v.playbackRate,1.25); }
});
test('composed-path and IME/default-prevented/modifier guards', () => {
 const f=fixture(); for(const event of [{isComposing:true},{keyCode:229},{defaultPrevented:true},{ctrlKey:true},{metaKey:true},{composedPath:()=>[{closest:()=>true}]}]) assert.equal(f.ignoreInput(event),true);
});


test('Bilibili strict route parser covers locale and malformed p negative controls', () => {
 const f=fixture();
 const base='https://www.bilibili.com';
 for(const path of ['/video/BV1abcdEFGH2/','/zh-Hant/video/BV1abcdEFGH2/','/video/BV1abcdEFGH2?p=2&x=1'])
  assert(f.parseBilibiliRoute(base+path), path);
 assert.equal(f.parseBilibiliRoute(base+'/zh-Hant/video/BV1abcdEFGH2/?p=2').routeKey,'BV1abcdEFGH2:2');
 for(const query of ['p=0','p=-1','p=NaN','p=1001','p=1&p=2','p=','p=01','%70=2','p=%32','p=2.0','p=+2'])
  assert.equal(f.parseBilibiliRoute(base+'/video/BV1abcdEFGH2/?'+query),null,query);
 for(const url of ['http://www.bilibili.com/video/BV1abcdEFGH2/', 'https://bilibili.com/video/BV1abcdEFGH2/',
  base+'/en/video/BV1abcdEFGH2/',base+'/video/av1/',base+'/bangumi/play/ep1',base+'/video/BV1abcdEFGH2/extra',
  base+'/video/BV1abcdEFGH2%2F', 'https://user@www.bilibili.com/video/BV1abcdEFGH2/'])
  assert.equal(f.parseBilibiliRoute(url),null,url);
});
test('localized Bilibili retains rate control; unsupported route has no media', () => {
 const f=fixture('www.bilibili.com','/zh-Hant/video/BV1abcdEFGH2/');
 const v=f.video(1.25); f.bindVideo(v); f.setPreset(2); assert.equal(v.playbackRate,2);
 f.location.href='https://www.bilibili.com/zh-Hant/bangumi/play/ep1'; assert.equal(f.getVideo(),null);
});
test('Bilibili duration policy rejects stale unknown missing and malformed values', () => {
 const f=fixture(), identity={platform:'bilibili',videoId:'BV1abcdEFGH2',cid:'202'};
 const run=(videoDuration,rest={})=>f.normalizeSponsorBucket([{videoID:identity.videoId,segments:[{
  segment:[5,12],cid:'202',category:'sponsor',actionType:'skip',videoDuration,...rest}]}],identity,120);
 for(const duration of [999,0,undefined,null,'120',NaN,Infinity,-120,117.99,122.01])
  assert.equal(run(duration).segments.length,0,String(duration));
 for(const duration of [118,120,122]) assert.equal(run(duration).segments.length,1);
 assert.equal(run(120,{cid:'101'}).segments.length,0);
 assert.equal(run(120,{actionType:undefined}).segments.length,0);
 assert.equal(run(120,{actionType:'mute'}).segments.length,0);
 assert.equal(run(120,{actionType:'full'}).segments.length,0);
 assert.equal(run(120,{actionType:'full'}).fullLabel,'sponsor');
});
test('empty/reloading media invalidates tokens immediately and requires metadata', () => {
 const f=fixture(); const v=f.video(); f.bindVideo(v); const token=f.coordinator.snapshot();
 v.currentTime=10; v.src=v.currentSrc=''; v.emit('emptied');
 assert.equal(f.coordinator.seek(token,30),false);
 assert.equal(f.coordinator.seek(f.coordinator.snapshot(),30),false);
 v.src=v.currentSrc='new.mp4'; v.emit('loadstart');
 assert.equal(f.coordinator.seek(f.coordinator.snapshot(),30),false);
 v.emit('loadedmetadata'); assert.equal(f.coordinator.seek(f.coordinator.snapshot(),30),true);
 assert.equal(f.coordinator.seek(token,40),false);
});
test('YouTube route-before-media cannot save or restore the old video into new checkpoint', () => {
 const f=fixture('www.youtube.com','/watch'); f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 f.defaults().resumeEnabled=true; const v=f.video(); f.bindVideo(v); v.currentTime=40; f.resume.save(v,true);
 assert.equal(f.resume.read(f.resume.keyFor('abcdefghijk')).time,40);
 f.location.href='https://www.youtube.com/watch?v=lmnopqrstuv'; f.resume.detach(); f.resume.attach(v); f.resume.save(v,true);
 assert.equal(f.resume.read(f.resume.keyFor('lmnopqrstuv')),null);
 v.emit('loadedmetadata'); f.resume.attach(v); f.resume.save(v,true);
 assert.equal(f.resume.read(f.resume.keyFor('lmnopqrstuv')),null, 'old source metadata is not new identity');
 v.src=v.currentSrc='second.mp4'; v.emit('loadstart'); v.emit('loadedmetadata');
 v.currentTime=20; f.resume.save(v,true); assert.equal(f.resume.read(f.resume.keyFor('lmnopqrstuv')).time,20);
});
test('resume completion margin is 15s or 1%, capped at half short duration', () => {
 const f=fixture('www.youtube.com','/watch'); f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 f.defaults().resumeEnabled=true; const v=f.video(); f.bindVideo(v);
 for(const [duration,time,expected] of [[120,100,false],[120,110,true],[3600,3565,true],[10,5,true]]) {
  v.duration=duration; v.currentTime=time; f.resume.save(v,true);
  assert.equal(f.resume.read(f.resume.keyFor('abcdefghijk')).completed,expected);
 }
});
const asyncTest = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
const until = async predicate => { for(let i=0;i<50&&!predicate();i++) await new Promise(r=>setTimeout(r,5)); assert(predicate(),'async fixture settled'); };
const ytSponsor = () => {
 const f=fixture('www.youtube.com','/watch'); f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 const v=f.video(); f.bindVideo(v); return {f,v};
};
const response = { status:200,responseText:JSON.stringify([{videoID:'abcdefghijk',segments:[{
 segment:[5,12],category:'sponsor',actionType:'skip',UUID:'yt-positive'}]}]) };
await asyncTest('YouTube sponsor positive control requests hash prefix and skips valid segment',async()=>{
 const {f,v}=ytSponsor(); const job=f.fetchSponsorSegments(); await until(()=>f.requests.length===1);
 assert.match(f.requests[0].url,/^https:\/\/sponsor\.ajay\.app\/api\/skipSegments\/[0-9a-f]{4}\?/);
 f.requests[0].onload(response); await job; assert.equal(f.sponsorState().segments.length,1);
 v.currentTime=6; f.checkSponsorSkip(); assert.equal(v.currentTime,12.03);
});
await asyncTest('late sponsor response cannot survive same-node source reload',async()=>{
 const {f,v}=ytSponsor(); const job=f.fetchSponsorSegments(); await until(()=>f.requests.length===1);
 v.src=v.currentSrc='new.mp4'; v.emit('loadstart'); f.requests[0].onload(response); await job;
 assert.equal(f.sponsorState().segments.length,0); v.currentTime=6; f.checkSponsorSkip(); assert.equal(v.currentTime,6);
});
await asyncTest('accepted sponsor segments cannot transfer to a new source without an event',async()=>{
 const {f,v}=ytSponsor(); const job=f.fetchSponsorSegments(); await until(()=>f.requests.length===1);
 f.requests[0].onload(response); await job; v.src=v.currentSrc='new.mp4'; v.currentTime=6;
 f.checkSponsorSkip(); assert.equal(v.currentTime,6);
});
await asyncTest('sponsor response rejects replacement video and A-to-B-to-A generation',async()=>{
 const {f,v}=ytSponsor(); const job=f.fetchSponsorSegments(); await until(()=>f.requests.length===1);
 const next=f.video(); f.bindVideo(next); f.bindVideo(v); f.requests[0].onload(response); await job;
 assert.equal(f.sponsorState().segments.length,0);
});
await asyncTest('Bilibili opt-in remains fail-closed even with route CID and a main video',async()=>{
 for(const path of ['/video/BV1abcdEFGH2/','/zh-Hant/video/BV1abcdEFGH2/']) {
  const f=fixture('www.bilibili.com',path); const v=f.video(); f.bindVideo(v);
  f.defaults().bilibiliSponsorBlock=true; f.defaults().showSponsorMarkers=true;
  f.win.__INITIAL_STATE__={videoData:{bvid:'BV1abcdEFGH2',pages:[{cid:202}]}};
  await f.fetchSponsorSegments(); assert.equal(f.requests.length,0); assert.equal(f.biliIdentity(),null);
  assert.equal(f.sponsorState().context,null); assert.equal(f.sponsorState().segments.length,0);
  v.currentTime=6; f.checkSponsorSkip(); assert.equal(v.currentTime,6);
 }
});
await asyncTest('sponsor undo exempts the entire viewing pass, then allows a later replay',async()=>{
 const {f,v}=ytSponsor(); const job=f.fetchSponsorSegments(); await until(()=>f.requests.length===1);
 f.requests[0].onload(response); await job; v.currentTime=6; f.checkSponsorSkip();
 const undo=f.toast().options.onAction; assert.equal(v.currentTime,12.03); undo(); assert.equal(v.currentTime,6);
 for(const t of [6,9,11.9]) { v.currentTime=t; f.checkSponsorSkip(); assert.equal(v.currentTime,t); }
 v.currentTime=13; f.checkSponsorSkip(); v.currentTime=6; f.checkSponsorSkip(); assert.equal(v.currentTime,12.03);
 f.toast().options.onAction(); v.currentTime=4; f.checkSponsorSkip(); v.currentTime=6;
 f.checkSponsorSkip(); assert.equal(v.currentTime,12.03,'seek before segment starts a new pass');
 v.src=v.currentSrc='replacement.mp4'; v.currentTime=0; undo(); assert.equal(v.currentTime,0,'old undo never seeks new source');
});
console.log(`${checks} production-function fixture groups passed; not live-site/Tampermonkey validation.`);
