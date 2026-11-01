// Runs production functions in an isolated VM; browser fixture tests complement this harness.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../speed-pro.user.js', import.meta.url), 'utf8');
function fixture(host = 'www.bilibili.com', path = '/video/BVfixture/') {
  const videos = []; const jobs = []; const requests = []; const store = new Map();
  const localStorage = { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,String(v)),
    removeItem: k => store.delete(k), key: i => [...store.keys()][i] || null, get length() { return store.size; } };
  const location = { hostname: host, pathname: path, href: `https://${host}${path}?p=1` };
  const document = { querySelector: () => null, querySelectorAll: selector => videos.filter(v => selector === 'video' || v.main), getElementById: () => null };
  const context = vm.createContext({ location, document, window: { innerWidth: 1000, innerHeight: 800 },
    structuredClone, URL, console, setTimeout: fn => (jobs.push(fn), jobs.length), clearTimeout: () => {},
    localStorage, GM_xmlhttpRequest: x => requests.push(x) });
  // Export a private test seam in the VM only, never in the installed userscript.
  vm.runInContext(source.slice(0, source.indexOf("    document.addEventListener('keydown'")) + `
    showToast = () => {}; updateControlUI = () => {}; renderPanelValues = () => {};
    globalThis.api = { getVideo, bindVideo, startHold, stopHold, toggleLock, setPreset, enforceRate,
      ignoreInput, fetchSponsorSegments, releaseTemporaryHold, stateFor, coordinator: MediaCoordinator, resume: ResumeManager, biliIdentity: getBilibiliSponsorIdentity, normalizeSponsorBucket, adAssist: handleAdAssist, adMuteRestore: restoreAdMute, cosmeticAds: applyCosmeticAdFiltering,
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
test('Bilibili sponsor requires verified BV and CID for current p', () => {
 const f=fixture('www.bilibili.com','/video/BV1abcdEFGH2/');
 f.location.href='https://www.bilibili.com/video/BV1abcdEFGH2/?p=2';
 f.win.__INITIAL_STATE__={videoData:{bvid:'BV1abcdEFGH2',pages:[{cid:101},{cid:202}]}};
 assert.equal(f.biliIdentity().cid,'202');
 f.location.href='https://www.bilibili.com/video/BV1abcdEFGH2/?p=3';
 assert.equal(f.biliIdentity(),null);
});
test('Sponsor normalized bucket refuses wrong CID, invalid ranges and full labels', () => {
 const f=fixture('www.bilibili.com');
 const identity={platform:'bilibili',videoId:'BV1abcdEFGH2',cid:'202'};
 const result=f.normalizeSponsorBucket([{videoID:identity.videoId,segments:[
  {segment:[5,12],cid:'101',category:'sponsor',actionType:'skip',UUID:'bad-page'},
  {segment:[15,22],cid:'202',category:'sponsor',actionType:'skip',UUID:'good'},
  {segment:[0,1200],cid:'202',category:'sponsor',actionType:'skip'},
  {segment:[0,120],cid:'202',category:'selfpromo',actionType:'full'}
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
console.log(`${checks} production-function fixture groups passed; not live-site/Tampermonkey validation.`);
