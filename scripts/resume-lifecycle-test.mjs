// Runs production functions in an isolated VM; browser fixture tests complement this harness.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const source = readFileSync(process.env.PLAYBACK_SOURCE || new URL('../speed-pro.user.js', import.meta.url), 'utf8');
function fixture(host = 'www.bilibili.com', path = '/video/BV1abcdEFGH2/', savedEntries = {}) {
  const videos = []; const jobs = []; const requests = []; const store = new Map(Object.entries(savedEntries));
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
const test = (name, fn) => { if (process.env.TEST_MATCH && !name.includes(process.env.TEST_MATCH)) return; fn(); checks++; console.log(`PASS ${name}`); };
const youtube = () => {
 const f=fixture('www.youtube.com','/watch');
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk';
 f.defaults().resumeEnabled=true;
 return f;
};
test('player replacement flushes the final valid checkpoint before invalidation', () => {
 const f=youtube(), a=f.video(); f.bindVideo(a);
 a.currentTime=20; f.resume.save(a,true); a.currentTime=24;
 const b=f.video(); b.currentTime=24; f.bindVideo(b);
 assert.equal(f.resume.read(f.resume.keyFor('abcdefghijk')).time,24);
 assert.equal(a.count(),0,'old listeners removed');
 assert.equal(f.media(),b,'replacement owns the current media');
});
test('replacement flush still rejects changed routes, sources, and newer remote progress', () => {
 for (const kind of ['route','source','remote']) {
  const f=youtube(), a=f.video(); f.bindVideo(a);
  a.currentTime=20; f.resume.save(a,true); a.currentTime=24;
  if(kind==='route') f.location.href='https://www.youtube.com/watch?v=lmnopqrstuv';
  if(kind==='source') a.currentSrc=a.src='changed.mp4';
  if(kind==='remote') f.store.set(f.resume.keyFor('abcdefghijk'),JSON.stringify({time:70,duration:120,completed:false,savedAt:Date.now()}));
  const b=f.video(); b.currentTime=24; f.bindVideo(b);
  assert.equal(f.resume.read(f.resume.keyFor('abcdefghijk')).time,kind==='remote'?70:20,kind);
  assert.equal(f.resume.read(f.resume.keyFor('lmnopqrstuv')),null,'no wrong-video checkpoint');
 }
});
const pendingRestore = () => {
 const f=youtube(), a=f.video(); f.bindVideo(a); f.resume.detach();
 a.currentTime=0; f.resume.write(f.resume.keyFor('abcdefghijk'),{time:40,duration:120,completed:false,savedAt:Date.now()});
 f.resume.attach(a); return {f,a};
};
test('native or manual seeks to the first second suppress initial resume', () => {
 for (const time of [0,0.5,1]) {
  const {f,a}=pendingRestore(); a.currentTime=time; a.emit('seeking');
  assert.equal(f.resume.active.userSeeked,true,`intent recorded at ${time}`);
  assert.equal(f.resume.active.localIntent,true);
  assert.equal(f.resume.tryRestore(a),false);
  assert.equal(a.currentTime,time,'resume must not override replay');
 }
});
test('coordinator-owned resume and sponsor seeks remain automatic at zero and later times', () => {
 for(const time of [0,40,60]) {
  const {f,a}=pendingRestore();
  assert.equal(f.coordinator.seek(f.resume.active.token,time),true);
  a.emit('seeking');
  assert.equal(f.resume.active.userSeeked,false,'automatic seek does not suppress resume');
  assert.equal(f.resume.active.localIntent,false,'automatic seek cannot claim local intent');
 }
});
console.log(`${checks} resume lifecycle production-function groups passed; not browser/site validation.`);
