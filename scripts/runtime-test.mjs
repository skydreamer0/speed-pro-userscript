// Runs production functions in an isolated VM; browser fixture tests complement this harness.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../speed-pro.user.js', import.meta.url), 'utf8');
function fixture(host = 'www.bilibili.com', path = '/video/BVfixture/') {
  const videos = []; const jobs = []; const requests = [];
  const location = { hostname: host, pathname: path, href: `https://${host}${path}?p=1` };
  const document = { querySelector: () => null, querySelectorAll: selector => videos.filter(v => selector === 'video' || v.main), getElementById: () => null };
  const context = vm.createContext({ location, document, window: { innerWidth: 1000, innerHeight: 800 },
    structuredClone, URL, console, setTimeout: fn => (jobs.push(fn), jobs.length), clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }, GM_xmlhttpRequest: x => requests.push(x) });
  // Export a private test seam in the VM only, never in the installed userscript.
  vm.runInContext(source.slice(0, source.indexOf("    document.addEventListener('keydown'")) + `
    showToast = () => {}; updateControlUI = () => {}; renderPanelValues = () => {};
    globalThis.api = { getVideo, bindVideo, startHold, stopHold, toggleLock, setPreset, enforceRate,
      ignoreInput, fetchSponsorSegments, releaseTemporaryHold, stateFor,
      media: () => currentVideo, flags: () => ({locked, holdActive}),
      navigation: () => { currentVideoId = getVideoId(); }, defaults: () => settings };
  })();`, context);
  const video = (rate = 1, main = true) => {
    const listeners = new Map(); let actual = rate; let writes = 0;
    const v = { main, paused: false, ended: false, src: 'one.mp4', currentSrc: 'one.mp4',
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
  return { ...context.api, video, videos, location, requests, drain };
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
test('media reload cancels hold and keeps independent baseline', () => {
 const f=fixture(); const a=f.video(1.5); f.bindVideo(a); f.startHold(); a.emit('loadstart'); assert.equal(a.playbackRate,1.5); assert.equal(f.flags().holdActive,false);
});
test('same-node source replacement cannot adopt our own locked rate as baseline', () => {
 const f=fixture(); const a=f.video(1.25); f.bindVideo(a); f.setPreset(3);
 a.src=a.currentSrc='two.mp4'; a.emit('loadstart'); a.emit('loadedmetadata'); f.drain();
 f.toggleLock(); assert.equal(a.playbackRate,1.25);
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
