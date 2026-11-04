// Two real browser tabs, routed synthetic pages. No YouTube traffic, accounts, or extension install.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const source=readFileSync(new URL('../speed-pro.user.js',import.meta.url),'utf8');
const key='yt-speed-pro:resume:v1:progress:standalone:abcdefghijk';
const errors=[];
try{
 const context=await browser.newContext();
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body>
 <div class="ytp-right-controls"></div><div id="movie_player"><video class="html5-main-video" id="main" style="width:640px;height:360px"></video></div>
 <ytd-thumbnail><a id="thumbnail" href="/watch?v=abcdefghijk&t=15" style="display:block;width:240px;height:135px"><span class="native-progress">native</span></a></ytd-thumbnail>
 </body></html>`}));
 const a=await context.newPage(),b=await context.newPage();
 for(const p of [a,b])p.on('pageerror',error=>errors.push(String(error)));
 await a.goto('https://www.youtube.com/watch?v=abcdefghijk');
 await a.evaluate(({key})=>{
  localStorage.setItem('yt-speed-pro:settings',JSON.stringify({resumeEnabled:true,sponsorBlock:false,autoSkipAds:false,muteAds:false}));
  localStorage.setItem(key,JSON.stringify({time:40,duration:120,completed:false,savedAt:Date.now()}));
  const v=document.getElementById('main');let time=0;
  Object.defineProperties(v,{currentSrc:{value:'fixture.mp4'},readyState:{value:4},duration:{value:120},paused:{value:false},currentTime:{get:()=>time,set:value=>{time=value;}}});
  window.GM_xmlhttpRequest=()=>{throw new Error('Unexpected network request');};
 },{key});
 await a.addScriptTag({content:source});
 await b.goto('https://www.youtube.com/');await b.addScriptTag({content:source});
 const bar=b.locator('.yt-speed-pro-resume-progress');
 await bar.waitFor();assert.equal(await bar.getAttribute('aria-label'),'Playback Suite 續播進度 33%');
 assert.equal(await b.locator('#thumbnail').getAttribute('href'),'/watch?v=abcdefghijk&t=15');
 await a.bringToFront();await a.evaluate(()=>{const v=document.getElementById('main');v.currentTime=65;v.dispatchEvent(new Event('timeupdate'));});
 await b.waitForFunction(()=>document.querySelector('.yt-speed-pro-resume-progress')?.getAttribute('aria-label')==='Playback Suite 續播進度 54%');
 assert.equal(await b.locator('#thumbnail .native-progress').count(),1);
 await b.evaluate(()=>{document.getElementById('thumbnail').href='/watch?v=lmnopqrstuv';});
 await b.waitForFunction(()=>!document.querySelector('.yt-speed-pro-resume-progress'));
 await b.evaluate(()=>{document.getElementById('thumbnail').href='/watch?v=abcdefghijk';});await bar.waitFor();
 // Remote update cannot seek a loaded player; a paused/detaching stale tab cannot rewrite it.
 await b.evaluate(({key})=>localStorage.setItem(key,JSON.stringify({time:90,duration:120,completed:false,savedAt:Date.now()})),{key});
 await a.waitForTimeout(300);assert.equal(await a.locator('#main').evaluate(v=>v.currentTime),65);
 await a.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 assert.equal(await b.evaluate(key=>JSON.parse(localStorage.getItem(key)).time,key),90);
 await a.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await b.evaluate(key=>localStorage.removeItem(key),key);await b.reload();await b.addScriptTag({content:source});
 await a.waitForTimeout(350);assert.equal(await a.locator('.yt-speed-pro-resume-progress').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS real-DOM two-tab indicators, dynamic links, no remote seek, stale detach, BFCache hooks and removal. NOT live-site or Tampermonkey acceptance.');
}finally{await browser.close();}
