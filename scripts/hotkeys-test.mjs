// Exercise the installed key/wheel listeners and production helpers in a VM.
// DOM/media/API doubles isolate dispatch, not live-site/native shortcut behavior.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(process.env.PLAYBACK_SOURCE || new URL('../speed-pro.user.js', import.meta.url), 'utf8');
const start = source.indexOf("    document.addEventListener('keydown'");
const end = source.indexOf("    document.addEventListener('yt-navigate-finish'");
assert(start > 0 && end > start, 'production event boundaries exist');
const hosts = ['www.youtube.com', 'www.bilibili.com', 'www.facebook.com', 'facebook.com', 'm.facebook.com', 'web.facebook.com', 'www.instagram.com', 'www.threads.com', 'www.threads.net'];
function fixture(host = 'www.youtube.com') {
  const handlers = new Map(), videos = [], effects = [], store = new Map(), jobs = [];
  const location = { hostname: host, href: host === 'www.bilibili.com' ? `https://${host}/video/BV1abcdEFGH2/` : `https://${host}/watch?v=abcdefghijk` };
  const nativeFullscreen = { click: () => effects.push('native-fullscreen') };
  const document = { hidden: false, fullscreenElement: null,
    querySelector: s => s === '.ytp-fullscreen-button' && host === 'www.youtube.com' ? nativeFullscreen : null,
    querySelectorAll: () => videos, getElementById: () => null,
    addEventListener: (name, fn) => handlers.set(name, fn),
    exitFullscreen: () => effects.push('exit-fullscreen') };
  const context = vm.createContext({ location, document, window: { innerWidth: 1000, innerHeight: 800 }, URL, structuredClone, console,
    setTimeout: fn => (jobs.push(fn),jobs.length), clearTimeout: () => {}, localStorage: {getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v)} });
  vm.runInContext(source.slice(0,start) + `
    const productionUpdateControlUI = updateControlUI;
    showToast = () => {}; updateControlUI = () => {}; renderPanelValues = () => {};
    takeScreenshot = () => globalThis.effects.push('screenshot');
    togglePiP = () => globalThis.effects.push('pip');
    globalThis.api = { bindVideo, flags: () => ({locked,holdActive}), settings,
      button: node => {controlButton = node; productionUpdateControlUI();},
      keys: () => typeof availableHotkeys === 'function' ? availableHotkeys() : null,
      help: () => typeof hotkeyHelpHTML === 'function' ? hotkeyHelpHTML() : null };
  ` + source.slice(start,end) + '})();', context);
  context.effects = effects;
  function video() {
    const v = { paused: false, ended: false, muted: false, readyState: 4, currentTime: 0, duration: 120, src:'one.mp4', currentSrc:'one.mp4', playbackRate:1.25,
      getBoundingClientRect: () => ({left:0,top:0,right:600,bottom:400,width:600,height:400}),
      addEventListener: () => {}, removeEventListener: () => {},
      requestFullscreen: () => { effects.push('fullscreen'); return Promise.resolve(); }, closest: () => null };
    videos.push(v); context.api.bindVideo(v); return v;
  }
  function event(type, code, extras={}) {
    const e = {code, repeat:false, altKey:false, shiftKey:false, ctrlKey:false, metaKey:false,
      defaultPrevented:false, target:{}, preventDefault(){this.defaultPrevented=true;}, ...extras};
    handlers.get(type)(e); return e;
  }
  return { ...context.api, effects, video, videos, document, location,
    drain: () => {let count=0; while(jobs.length){assert(++count<50); jobs.shift()();}},
    key:(code,extras={})=>event('keydown',code,extras), up:(code,extras={})=>event('keyup',code,extras), wheel:extras=>event('wheel','',extras) };
}
let passed=0, failed=0;
function test(name, fn) { try { fn(); passed++; console.log(`PASS ${name}`); } catch(error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); } }
test('every matched host shares temporary hold and turbo with owned release after focus change', () => {
  for (const host of hosts) {
    const f=fixture(host), v=f.video(); f.settings.speed=2.5; f.settings.turboSpeed=4;
    assert(f.key('Backquote').defaultPrevented, host); assert.equal(v.playbackRate,2.5);
    assert(f.up('Backquote',{target:{closest:()=>true}}).defaultPrevented); assert.equal(v.playbackRate,1.25);
    f.key('Backquote',{shiftKey:true}); assert.equal(v.playbackRate,4);
    f.up('Backquote'); assert.equal(v.playbackRate,1.25);
    assert.equal(f.up('Backquote').defaultPrevented,false);
  }
});
test('every matched host shares presets, configured step, Delete and Alt wheel', () => {
  for(const host of hosts){
    const f=fixture(host), v=f.video(); f.settings.step=0.5;
    for(let rate=1;rate<=5;rate++){ assert(f.key(`Digit${rate}`,{altKey:true}).defaultPrevented); assert.equal(v.playbackRate,rate,host); }
    f.key('PageUp'); assert.equal(v.playbackRate,5.5); f.key('PageDown'); assert.equal(v.playbackRate,5);
    f.key('Delete'); assert.equal(v.playbackRate,3);
    f.wheel({altKey:true,deltaY:-1}); assert.equal(v.playbackRate,3.5);
    f.wheel({altKey:true,deltaY:1}); assert.equal(v.playbackRate,3);
  }
});
test('native navigation keys stay untouched and Bilibili preserves plain Tab/Enter', () => {
  for(const host of hosts){
    const f=fixture(host); f.video();
    for(const code of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyF','Escape','KeyK']) assert.equal(f.key(code).defaultPrevented,false,`${host} ${code}`);
    assert.equal(f.key('Tab').defaultPrevented,false);
    f.key('Digit2',{altKey:true});
    assert.equal(f.key('Tab',{shiftKey:true}).defaultPrevented,false,`${host} Shift+Tab`);
    if(host==='www.bilibili.com') for(const code of ['Tab','Enter']) assert.equal(f.key(code).defaultPrevented,false);
    else { assert(f.key('Tab').defaultPrevented); assert.equal(f.flags().locked,false); }
  }
});
test('legacy Enter uses YouTube native button or generic browser fullscreen only outside Bilibili',()=>{
  for(const host of hosts){const f=fixture(host);f.video();const e=f.key('Enter');
    assert.equal(e.defaultPrevented,host!=='www.bilibili.com');
    assert.deepEqual(f.effects,host==='www.bilibili.com'?[]:[host==='www.youtube.com'?'native-fullscreen':'fullscreen']);
  }
});
test('unlisted modifier combinations never fall through to bare shortcuts',()=>{
  for(const code of ['Backquote','PageUp','PageDown','Delete','Tab','Enter']) for(const extra of [{altKey:true},{altKey:true,shiftKey:true},...(code==='Backquote'?[]:[{shiftKey:true}])]){
    const f=fixture();f.video();f.key('Digit2',{altKey:true});const before=f.settings.speed;
    assert.equal(f.key(code,extra).defaultPrevented,false,`${code} ${JSON.stringify(extra)}`);assert.equal(f.settings.speed,before);assert.equal(f.flags().locked,true);
  }
  for(const code of ['Digit1','Digit2','KeyS','KeyP']){const f=fixture();f.video();assert.equal(f.key(code,{altKey:true,shiftKey:true}).defaultPrevented,false);assert.deepEqual(f.effects,[]);}
});
test('AltGraph never triggers presets or tools',()=>{
  for(const code of ['Digit2','KeyS','KeyP']){const f=fixture();const v=f.video();assert.equal(f.key(code,{altKey:true,getModifierState:key=>key==='AltGraph'}).defaultPrevented,false);assert.equal(v.playbackRate,1.25);assert.deepEqual(f.effects,[]);}
});
test('autorepeat never repeats one-shot actions or causes fallback',()=>{
  for(const code of ['Digit2','KeyS','KeyP']){const f=fixture();f.video();
    f.key(code,{altKey:true});const before=[...f.effects];const rate=f.settings.speed;
    f.key(code,{altKey:true,repeat:true});assert.deepEqual(f.effects,before,code);assert.equal(f.settings.speed,rate);}
  const f=fixture();const v=f.video();f.key('PageUp');const rate=v.playbackRate;f.key('PageUp',{repeat:true});assert.equal(v.playbackRate,rate);
});
test('editable and interactive composed-path targets preserve typing and native controls',()=>{
  for(const token of ['input','textarea','select','contenteditable','role="textbox"','role="searchbox"','role="combobox"','button','a,','role="button"','role="link"','role="menuitem"','role="option"','role="slider"','role="checkbox"','role="radio"','role="switch"','role="tab"','role="treeitem"']) {
    const f=fixture();const v=f.video();const target={closest:selector=>selector.includes(token)?{}:null};
    assert.equal(f.key('PageUp',{composedPath:()=>[{},target]}).defaultPrevented,false,token);assert.equal(v.playbackRate,1.25);
    assert.equal(f.wheel({altKey:true,deltaY:-1,composedPath:()=>[target]}).defaultPrevented,false,token);
  }
});
test('IME, prevented events, Ctrl/Meta and absent eligible video never act',()=>{
  for(const extra of [{isComposing:true},{keyCode:229},{defaultPrevented:true},{ctrlKey:true},{metaKey:true}]){
    const f=fixture();const v=f.video();f.key('PageUp',extra);assert.equal(v.playbackRate,1.25);
  }
  for(const host of hosts){const f=fixture(host);for(const code of ['Backquote','PageUp','Delete','Enter'])assert.equal(f.key(code).defaultPrevented,false,host);assert.equal(f.wheel({altKey:true,deltaY:-1}).defaultPrevented,false);}
});
test('Alt wheel requires finite vertical motion and exact modifiers',()=>{
  for(const extra of [{deltaY:0},{deltaY:NaN},{deltaY:Infinity},{deltaY:-1,shiftKey:true},{deltaY:-1,getModifierState:key=>key==='AltGraph'}]){
    const f=fixture();const v=f.video();assert.equal(f.wheel({altKey:true,...extra}).defaultPrevented,false);assert.equal(v.playbackRate,1.25);
  }
});
test('explicit preset or rate adjustment overrides held turbo until the owned key releases',()=>{
  for(const host of hosts) for(const command of ['Digit2','PageUp','Delete']) {
    const f=fixture(host),v=f.video();f.key('Backquote',{shiftKey:true});assert.equal(v.playbackRate,5);
    f.key(command,{altKey:command==='Digit2'}); const expected=command==='Digit2'?2:command==='PageUp'?3.25:3;
    f.drain();assert.equal(v.playbackRate,expected,`${host}: ${command}`);
    assert.equal(f.flags().locked,false);f.up('Backquote');assert.equal(v.playbackRate,1.25);
  }
});
test('control button labels retain their actual action after rate updates',()=>{
  for(const host of hosts){const f=fixture(host);const v=f.video();const button={dataset:{},setAttribute(k,v){this[k]=v;}};
    f.button(button);const action=host==='www.youtube.com'?'開啟 Playback Suite 設定':'鎖定加速倍率';
    assert(button.title.includes(action),host);assert(button['aria-label'].includes(action));assert(button.title.includes('1.25'));
    f.key('Digit2',{altKey:true});f.button(button);assert(button.title.includes(host==='www.youtube.com'?'開啟 Playback Suite 設定':'解除倍速鎖定'));assert(button.title.includes('2'));
  }
});
test('central key map and panel expose every available action without fixed configurable rates',()=>{
  for(const host of hosts){const f=fixture(host);const keys=f.keys();assert(Array.isArray(keys),'central key map');
    const chords=keys.map(k=>`${k.code}:${Boolean(k.alt)}:${Boolean(k.shift)}`);assert.equal(new Set(chords).size,chords.length);
    const help=f.help();for(const key of keys){assert(help.includes(key.label),`${host}: ${key.label}`);assert(help.includes(key.description),key.description);}
    assert(help.includes('Alt + 滾輪'));assert(!help.includes('5×超速'));assert(!help.includes('±0.25×'));
  }
});
console.log(`Hotkey dispatch groups: ${passed} passed, ${failed} failed. Browser/native-site acceptance NOT RUN.`);
if(failed)process.exitCode=1;
