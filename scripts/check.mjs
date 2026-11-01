import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = readFileSync(new URL('../speed-pro.user.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert(!source.includes('\r'), 'Use LF line endings');
assert(source.startsWith('// ==UserScript==\n'), 'Metadata must start the file');
const block = source.match(/^\/\/ ==UserScript==\n([\s\S]*?)^\/\/ ==\/UserScript==$/m)?.[1];
assert(block, 'Metadata block must be closed');
const metadata = new Map();
for (const [, key, value] of block.matchAll(/^\/\/\s+@(\S+)\s+(.+)$/gm)) {
  metadata.set(key, [...(metadata.get(key) ?? []), value.trim()]);
}
const values = key => metadata.get(key) ?? [];
assert.deepEqual(values('version'), [pkg.version]);
assert.deepEqual(values('name'), ['Playback Suite - Cross-platform Video Companion']);
assert.equal(pkg.name, 'playback-suite-userscript');
assert.deepEqual(values('license'), ['MIT']);
assert.deepEqual(values('grant'), ['GM_xmlhttpRequest']);
assert.deepEqual(values('connect'), ['sponsor.ajay.app', 'bsbsb.top']);
assert.deepEqual(values('run-at'), ['document-idle']);
assert.deepEqual(values('require'), []);
for (const key of ['updateURL', 'downloadURL']) assert.deepEqual(values(key), ['https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js']);
assert.deepEqual(values('match').sort(), [
  'https://www.bilibili.com/video/*', 'https://www.youtube.com/*', 'https://www.instagram.com/*',
  'https://www.facebook.com/*', 'https://facebook.com/*',
  'https://m.facebook.com/*', 'https://web.facebook.com/*',
  'https://www.threads.com/*', 'https://www.threads.net/*'
].sort());
for (const file of ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md',
  'LICENSE', 'docs/PROVENANCE.md', 'docs/KNOWN_ISSUES.md', 'docs/TESTING.md']) {
  assert(existsSync(new URL(`../${file}`, import.meta.url)), `Missing ${file}`);
}
assert.deepEqual(pkg.dependencies ?? {}, {});
assert.deepEqual(pkg.devDependencies ?? {}, {});
console.log('PASS: metadata, version, permission allowlist, LF, documentation and zero dependencies');
console.log('LIMIT: static checks only; no browser, platform, network or security certification');
