// No account, site traffic, extension installation or third-party media. All pages are routed fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox'] });
const source = readFileSync(new URL('../speed-pro.user.js',import.meta.url),'utf8');
const errors=[]; let checks=0;
async function fixture(host) {
 const page=await browser.newPage(); page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body>
 <div class="ytp-right-controls"></div><div class="bpx-player-video-wrap"><video id="main" class="html5-main-video" style="width:640px;height:360px"></video></div>
 <video id="preview" style="width:700px;height:400px"></video><input id="danmaku"><textarea></textarea><button id="native">Native</button><div contenteditable id="comment"></div>
 </body></html>`}));
 await page.goto(`https://${host}/video/BV1abcdEFGH2/?p=1`);
 await page.evaluate(()=>{window.requests=[];window.GM_xmlhttpRequest=x=>window.requests.push(x.url); document.querySelector('#main').playbackRate=1.25;});
 await page.addScriptTag({content:source}); return page;
}
async function key(page,code,selector='body',extras={}) {
 return page.evaluate(({code,selector,extras})=>{
 const e=new KeyboardEvent('keydown',{code,bubbles:true,cancelable:true,...extras});document.querySelector(selector).dispatchEvent(e);return e.defaultPrevented;
 },{code,selector,extras});
}
try {
 for(const host of ['www.youtube.com','www.facebook.com','www.instagram.com','www.threads.com','www.bilibili.com']) {
  const p=await fixture(host); const button=host==='www.youtube.com'?'#yt-speed-pro-button':'#yt-speed-pro-settings-button';
  await p.click(button); assert.equal(await p.locator('#yt-speed-pro-panel').isVisible(),true);
  await p.locator('[data-action="reset-all"]').click(); assert.equal(await p.locator('#yt-speed-pro-panel input[type="number"]').first().inputValue(),'3');
  await p.locator('.yt-speed-pro-close').click(); await p.click(button); assert.equal(await p.locator('#yt-speed-pro-panel').isVisible(),true);
  await p.locator('.yt-speed-pro-close').click();
  await key(p,'Digit2','body',{altKey:true}); assert.equal(await p.locator('#main').evaluate(v=>v.playbackRate),2);
  if(host!=='www.youtube.com') assert.equal(await p.evaluate(()=>requests.length),0);
  await p.close(); checks++; console.log(`PASS ${host} settings open/reset/close/reopen and rate control`);
 }
 const p=await fixture('www.bilibili.com');
 for(const code of ['Tab','Enter','ArrowRight','ArrowUp','Space','KeyF','Escape']) assert.equal(await key(p,code),false,code);
 for(const selector of ['#danmaku','textarea','#native','#comment']) assert.equal(await key(p,'PageUp',selector),false,selector);
 assert.equal(await key(p,'PageUp','body',{isComposing:true}),false);
 await key(p,'Backquote'); assert.equal(await p.locator('#main').evaluate(v=>v.playbackRate),3);
 await p.evaluate(()=>window.dispatchEvent(new Event('blur'))); assert.equal(await p.locator('#main').evaluate(v=>v.playbackRate),1.25);
 await key(p,'Backquote'); await p.evaluate(()=>document.querySelector('#danmaku').dispatchEvent(new KeyboardEvent('keyup',{code:'Backquote',bubbles:true,cancelable:true}))); assert.equal(await p.locator('#main').evaluate(v=>v.playbackRate),1.25);
 await key(p,'Digit2','body',{altKey:true});
 await p.evaluate(()=>{document.querySelector('#main').remove();const v=document.createElement('video');v.id='replacement';v.style='width:640px;height:360px';v.playbackRate=1.5;document.querySelector('.bpx-player-video-wrap').append(v);});
 await p.waitForTimeout(250); assert.equal(await p.locator('#replacement').evaluate(v=>v.playbackRate),2); assert.equal(await p.locator('#preview').evaluate(v=>v.playbackRate),1);
 await p.click('#yt-speed-pro-button'); assert.equal(await p.locator('#replacement').evaluate(v=>v.playbackRate),1.5);
 await key(p,'Backquote'); await p.evaluate(()=>document.querySelector('#replacement').dispatchEvent(new Event('loadstart'))); assert.equal(await p.locator('#replacement').evaluate(v=>v.playbackRate),1.5);
 await p.evaluate(()=>history.pushState({},'', '/video/BV1abcdEFGH2/?p=2')); await p.waitForTimeout(900);
 await key(p,'Digit2','body',{altKey:true});
 await p.evaluate(()=>history.pushState({},'', '/bangumi/play/ep1')); assert.equal(await key(p,'PageUp'),false); await p.waitForTimeout(900); assert.equal(await p.locator('#replacement').evaluate(v=>v.playbackRate),1.5);
 assert.equal(await p.evaluate(()=>requests.length),0); checks++; console.log('PASS Bilibili native keys, input, blur/focus release, replacement, media reload, part navigation and route exit');
 await p.close(); assert.deepEqual(errors,[]); console.log(`PASS ${checks} Chromium fixture groups; 0 page errors. NOT live Bilibili or Tampermonkey tests.`);
} finally { await browser.close(); }
