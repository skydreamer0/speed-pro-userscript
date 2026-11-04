// Production-function VM fixtures. Synthetic DOM/storage, not YouTube or manager certification.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const source=readFileSync(process.env.PLAYBACK_SOURCE || new URL('../speed-pro.user.js', import.meta.url),'utf8');
function fixture(store=new Map()) {
 const jobs=[], anchors=[], listeners=new Map(), styles=[];
 const node=()=>({style:{},dataset:{},children:[],attrs:{},classList:{add(){},remove(){}},
  setAttribute(k,v){this.attrs[k]=String(v);}, appendChild(child){this.children.push(child);child.parent=this;return child;},
  querySelector(selector){return this.children.find(x=>selector==='.'+x.className)||null;},remove(){const i=this.parent?.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);}});
 const document={hidden:false,querySelector:()=>null,getElementById:id=>styles.find(x=>x.id===id)||null,
  querySelectorAll:()=>anchors,createElement:node,head:{appendChild:n=>styles.push(n)}};
 const window={addEventListener:(type,fn)=>{const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);},removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn)};
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),
  get length(){return store.size;},key:i=>[...store.keys()][i]||null};
 const location={hostname:'www.youtube.com',href:'https://www.youtube.com/watch?v=abcdefghijk'};
 const ctx=vm.createContext({document,window,localStorage,location,URL,console,crypto:webcrypto,structuredClone,TextEncoder,
  setTimeout:fn=>(jobs.push(fn),jobs.length),clearTimeout:()=>{},GM_xmlhttpRequest:()=>{}});
 vm.runInContext(source.slice(0,source.indexOf("    document.addEventListener('keydown'"))+`
 showToast=()=>{};
 globalThis.api={resume:ResumeManager,thumbnails:typeof ResumeThumbnails==='undefined'?null:ResumeThumbnails,
  coordinator:MediaCoordinator,settings,bind:video=>{currentVideo=video;MediaCoordinator.bind(video);}};})();`,ctx);
 const api=ctx.api;
 const video={currentTime:0,duration:120,readyState:4,seeking:false,ended:false,paused:false,currentSrc:'one.mp4',src:'one.mp4'};
 api.settings.resumeEnabled=true;api.bind(video);api.resume.attach(video);
 const anchor=href=>{const a=node();a.href=href;a.getAttribute=k=>k==='href'?a.href:null;anchors.push(a);return a;};
 const flush=()=>{let count=0;while(jobs.length){assert(++count<30,'bounded thumbnail work');jobs.shift()();}};
 const remote=(key,value)=>{if(value===null)store.delete(key);else store.set(key,JSON.stringify(value));api.resume.onStorage({key,storageArea:localStorage});};
 return {...api,store,document,window,localStorage,location,video,anchor,anchors,flush,remote,listeners};
}
let checks=0;
const test=(name,fn)=>{if(process.env.TEST_MATCH&&!name.includes(process.env.TEST_MATCH))return;fn();checks++;console.log('PASS '+name);};
const record=(time=40,extra={})=>({time,duration:120,completed:false,savedAt:Date.now(),...extra});
test('thumbnail progress is opt-in, idempotent, and preserves timestamp links',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk&t=15');
 const href=a.href;f.resume.write(f.resume.keyFor('abcdefghijk'),record());f.thumbnails.render();
 assert.equal(a.children.length,1);assert.equal(a.children[0].attrs['aria-label'],'Playback Suite 續播進度 33%');
 f.thumbnails.render();assert.equal(a.children.length,1);assert.equal(a.href,href);
 f.settings.resumeEnabled=false;f.thumbnails.render();assert.equal(a.children.length,0);
});
test('playlist thumbnails use their exact list checkpoint, not standalone or another list',()=>{
 const f=fixture();const a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk&list=PLone');
 const b=f.anchor('https://www.youtube.com/watch?v=abcdefghijk&list=PLtwo');
 f.resume.write(f.resume.keyFor('abcdefghijk'),record(20));
 f.resume.write(f.resume.keyFor('abcdefghijk','PLone'),record(60));f.thumbnails.render();
 assert.equal(a.children[0].attrs['aria-label'],'Playback Suite 續播進度 50%');assert.equal(b.children.length,0);
});
test('recycled links remove obsolete overlays; malformed, external and Shorts links stay untouched',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk');
 f.resume.write(f.resume.keyFor('abcdefghijk'),record());f.thumbnails.render();assert.equal(a.children.length,1);
 a.href='https://www.youtube.com/watch?v=lmnopqrstuv';f.thumbnails.render();assert.equal(a.children.length,0);
 for(const href of ['https://evil.example/watch?v=abcdefghijk','https://www.youtube.com/shorts/abcdefghijk','javascript:alert(1)'])f.anchor(href);
 f.thumbnails.render();assert(f.anchors.every(x=>x.children.length===0));
});
test('invalid, expired and future records do not produce progress; completed records display complete',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk'),key=f.resume.keyFor('abcdefghijk');
 for(const value of [record(NaN),record(-1),record(999),record(20,{duration:0}),record(40,{savedAt:Date.now()-91*86400000}),record(40,{savedAt:Date.now()+86400000})]){
  f.store.set(key,JSON.stringify(value));f.thumbnails.render();assert.equal(a.children.length,0);
 }
 f.store.set(key,JSON.stringify(record(115,{completed:true})));f.thumbnails.render();assert.equal(a.children[0].attrs['aria-label'],'Playback Suite 已看完');
});
test('remote progress refreshes thumbnails but never seeks the current player',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk'),key=f.resume.keyFor('abcdefghijk');
 f.video.currentTime=20;f.remote(key,record(70));f.flush();
 assert.equal(f.video.currentTime,20);assert.equal(a.children[0].attrs['aria-label'],'Playback Suite 續播進度 58%');
});
test('paused or hidden stale tab cannot overwrite newer remote progress on detach or timeupdate',()=>{
 for(const hidden of [false,true]){
  const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);
  f.document.hidden=hidden;f.video.paused=!hidden;f.remote(key,record(70));f.video.currentTime=21;
  f.resume.save(f.video);f.resume.detach();assert.equal(f.resume.read(key).time,70);
 }
});
test('visible resumed playback can take ownership without taking a remote seek',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);
 f.remote(key,record(70));f.resume.active.lastSavedAt=0;f.video.currentTime=23;f.resume.save(f.video);
 assert.equal(f.resume.read(key).time,23);assert.equal(f.video.currentTime,23);
});
test('clearing history updates both tabs and stationary paused players do not recreate it',()=>{
 const store=new Map(),a=fixture(store),b=fixture(store),key=a.resume.keyFor('abcdefghijk');
 a.video.currentTime=b.video.currentTime=40;a.resume.save(a.video,true);b.resume.active.observed=a.store.get(key);b.video.paused=true;
 const thumbnail=b.anchor('https://www.youtube.com/watch?v=abcdefghijk');b.thumbnails.render();assert.equal(thumbnail.children.length,1);
 a.resume.clearHistory();b.resume.onStorage({key,storageArea:b.localStorage});b.flush();
 b.resume.detach();a.resume.detach();assert.equal(store.get(key),undefined);assert.equal(thumbnail.children.length,0);
});
test('only matching localStorage changes are observed; sync lifecycle has no duplicate listeners',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.resume.startSync();f.resume.startSync();
 assert.equal(f.listeners.get('storage').size,1);f.resume.onStorage({key,storageArea:{}});assert.equal(f.resume.active.remoteChanged,false);
 f.resume.onStorage({key:'unrelated',storageArea:f.localStorage});assert.equal(f.resume.active.remoteChanged,false);
 f.resume.stopSync();assert.equal(f.listeners.get('storage').size,0);f.resume.startSync();assert.equal(f.listeners.get('storage').size,1);
});
test('timestamp and manual-seek priority survives storage notifications',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.remote(key,record(50));
 f.location.href+='&t=10';assert.equal(f.resume.tryRestore(f.video),false);assert.equal(f.video.currentTime,0);
 f.location.href='https://www.youtube.com/watch?v=abcdefghijk';f.resume.active=null;f.resume.attach(f.video);
 f.video.currentTime=15;f.resume.onSeeking(f.video);f.remote(key,record(60));assert.equal(f.resume.tryRestore(f.video),false);assert.equal(f.video.currentTime,15);
});
test('unobserved remote writes still block forced stale saves',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);
 f.store.set(key,JSON.stringify(record(70)));f.video.paused=true;f.resume.detach();assert.equal(f.resume.read(key).time,70);
});
test('delayed storage notifications reread current storage instead of event payload',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk'),key=f.resume.keyFor('abcdefghijk');
 f.store.set(key,JSON.stringify(record(80)));f.resume.onStorage({key,storageArea:f.localStorage,newValue:JSON.stringify(record(10))});f.flush();
 assert.equal(a.children[0].attrs['aria-label'],'Playback Suite 續播進度 67%');
});
test('cross-tab replay and explicit local backward seek are not replaced with maximum progress',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=80;f.resume.save(f.video,true);
 f.remote(key,record(100));f.video.currentTime=15;f.video.paused=true;f.resume.onSeeking(f.video);f.resume.save(f.video,true);
 assert.equal(f.resume.read(key).time,15);
});
test('storage clear event removes bars without seeking or recreating paused progress',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk');f.video.currentTime=40;f.resume.save(f.video,true);f.thumbnails.render();
 f.store.clear();f.resume.onStorage({key:null,storageArea:f.localStorage});f.flush();f.video.paused=true;f.resume.detach();
 assert.equal(a.children.length,0);assert.equal(f.store.size,0);assert.equal(f.video.currentTime,40);
});
test('storage failures fail closed without changing links or playback',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk'),href=a.href;
 f.localStorage.getItem=()=>{throw new Error('denied');};f.localStorage.setItem=()=>{throw new Error('quota');};
 f.video.currentTime=40;f.resume.save(f.video,true);f.thumbnails.render();assert.equal(a.children.length,0);assert.equal(a.href,href);assert.equal(f.video.currentTime,40);
});
test('thumbnail marker never replaces native thumbnail content or native progress',()=>{
 const f=fixture(),a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk');
 const native={className:'native-progress'};a.appendChild(native);f.resume.write(f.resume.keyFor('abcdefghijk'),record());
 f.thumbnails.render();f.thumbnails.render();assert.equal(a.children.length,2);assert.equal(a.children[0],native);
 f.settings.resumeEnabled=false;f.thumbnails.render();assert.equal(a.children.length,1);assert.equal(a.children[0],native);
});
test('earlier local seek cannot authorize overwriting a remote write or clear before event delivery',()=>{
 for(const next of [record(70),null]){
  const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);
  f.video.currentTime=30;f.resume.onSeeking(f.video);f.video.paused=true;
  if(next)f.store.set(key,JSON.stringify(next));else f.store.delete(key);
  f.resume.detach();assert.equal(f.resume.read(key)?.time,next?.time);
 }
});
test('same-video reattach cannot overwrite newer progress or recreate a clear without new playback',()=>{
 for(const next of [record(70),null]){
  const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);f.video.paused=true;f.resume.detach();
  if(next)f.store.set(key,JSON.stringify(next));else f.store.delete(key);
  f.resume.attach(f.video);f.resume.tryRestore(f.video);f.resume.detach();assert.equal(f.resume.read(key)?.time,next?.time);
 }
});
test('automatic coordinator seek is not local user intent and hidden seeking cannot reclaim progress',()=>{
 for(const hidden of [false,true]){
  const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);f.remote(key,record(70));
  f.document.hidden=hidden;f.coordinator.seek(f.coordinator.snapshot(),35);f.resume.onSeeking(f.video);
  f.video.paused=true;f.resume.save(f.video,true);assert.equal(f.resume.read(key).time,70);
 }
});
test('disabled resume does no full thumbnail scans and cleans only owned indicators',()=>{
 const f=fixture();let scans=0;const query=f.document.querySelectorAll;
 f.document.querySelectorAll=(selector)=>{scans++;return query(selector);};f.settings.resumeEnabled=false;
 for(let i=0;i<5;i++){f.thumbnails.schedule();f.flush();f.thumbnails.render();}assert.equal(scans,0);
 f.settings.resumeEnabled=true;const a=f.anchor('https://www.youtube.com/watch?v=abcdefghijk');f.resume.write(f.resume.keyFor('abcdefghijk'),record());f.flush();assert.equal(a.children.length,1);
 f.settings.resumeEnabled=false;scans=0;f.thumbnails.schedule();f.flush();assert.equal(a.children.length,0);assert.equal(scans,0);
});
test('retained hidden player cannot recreate a remote clear during suspension',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.video.currentTime=20;f.resume.save(f.video,true);f.resume.detach();
 f.store.delete(key);f.resume.attach(f.video);f.resume.tryRestore(f.video);f.document.hidden=true;f.video.currentTime=21;f.resume.save(f.video);
 assert.equal(f.resume.read(key),null);
});
test('first attachment of a stationary paused player is not new viewing activity',()=>{
 const f=fixture(),key=f.resume.keyFor('abcdefghijk');f.resume.active=null;f.resume.observations.delete(f.video);
 f.video.currentTime=20;f.video.paused=true;f.resume.attach(f.video);f.resume.save(f.video,true);
 assert.equal(f.resume.read(key),null);
});
console.log(`${checks} resume-sync production-function groups passed; not live-site/Tampermonkey validation.`);
