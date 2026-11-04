# YouTube resume indicators and tab synchronization candidate

Base: `f3d8a4eb8d87cdaffad8c2fa4ab4c0f59f24feb7` (main, 2026-11-04 inspection).
This is an unreleased feature candidate. Existing README-only Draft PR #13 is not included or overwritten. Version, namespace, update/download URLs, host matches and grants remain unchanged.

## User-visible scope

Enable the existing **自動續播（YouTube）** setting. On desktop `www.youtube.com`, supported video thumbnails show a purple local progress bar; completed recordings show a full bar. Standalone links read only standalone checkpoints; playlist links read only that playlist's checkpoint. Watch Later continues to follow the existing standalone policy. Shorts, hover previews, Music, mobile, other browsers and account/cloud synchronization are not added.

Thumbnail links are never rewritten, clicked or intercepted. Native thumbnail content and YouTube's own indicator are preserved. An explicit `t`, `start`, `time_continue`, native selected position or manual seek still takes priority over automatic restore. Thumbnail UI does not seek any player.

Indicators update after local saves, same-origin `storage` events and dynamic thumbnail href/DOM changes, debounced by 250 ms. Disabling/resetting resume removes only owned indicators and stops thumbnail scans. Disconnected tracked nodes are released on the next pass. No new network requests, permissions, external scripts or packages are introduced.

## Cross-tab policy

- Same-origin localStorage remains the existing store. No migration or new browser/GM permission is required. YouTube page scripts can still read this storage.
- Storage notifications re-read current stored data instead of trusting queued event payloads. They repaint indicators but **never seek the current player**.
- Paused/background or stationary reattached players do not overwrite observed newer progress or recreate cleared history. The writer also checks storage immediately before saving, so delayed notification is not required for protection.
- A detected remote change invalidates older local seek intent. New visible playback or a new explicit local seek can take over, including intentional backward replay. Automatic seeks made through the media coordinator do not count as manual intent.
- A resumed/BFCache page must observe actual position movement or a new local seek before saving its retained position. A saved checkpoint at attachment also receives remote-change protection.
- History removal in another tab removes its indicators; stationary players do not recreate the record. New actual playback can create new history.
- **Not a transaction protocol:** simultaneous read/write operations in multiple active tabs can still race because localStorage has no compare-and-swap transaction. Last actual write can win. No cross-device, cross-profile or account-wide consistency is claimed.
- Settings remain per-tab loaded settings. Changing resume ON/OFF in one open tab does not automatically change the other tab's active setting. Shared progress and explicit history clearing are synchronized.

## Verification

Node v24.22.1:

- `npm test`: syntax/metadata/documentation checks; 30 existing production-function groups and 22 new resume-sync groups passed.
- `npm run test:resume-negative`: 7 deliberately broken variants rejected by behavioral assertions.
- `node scripts/repair-negative-test.mjs`: all 5 existing repair mutations rejected.
- Four additional regressions each failed against the pre-review implementation, then passed after correction: delayed-event stale seek; reattach update/clear; automatic/hidden seek; disabled scanning.
- `node --check scripts/resume-browser-test.mjs`: syntax passed. A two-tab real-DOM fixture is prepared under `npm run test:resume-browser`.
- Existing `npm run test:browser` launch was **BLOCKED BEFORE TEST**: Chromium `socket() failed: Operation not permitted`. No assertion, screenshot or visual result was produced. No escalation or alternative route was used to bypass it.
- New two-tab browser fixture: **NOT RUN** because of the same known launch restriction; it is prepared code, not browser evidence.
- Live YouTube, Tampermonkey install/upgrade, true multi-tab concurrency, BFCache behavior and accessibility in a screen reader: **NOT RUN**.

The VM tests use the actual production functions with a synthetic DOM/storage boundary. They are not full DOM or site acceptance. The existing candidate was already not release-verified; this PR does not change that status.

## Browser acceptance after review

1. Install exactly this candidate in one enabled script instance; record browser and manager versions.
2. Enable resume. Check home/search/recommendation/playlist thumbnails; confirm standalone and separate playlist indicators, completed state, preserved images/native overlays and unchanged timestamp URLs.
3. Open two tabs in one browser profile. Advance one, observe the other's thumbnail update without reloading or seeking its player.
4. Pause the older tab; advance the other; close/reopen or BFCache-restore the old one. The newer checkpoint must remain. Repeat with clear-history and delayed storage events.
5. Test visible backward replay versus hidden automatic SponsorBlock seek. Only deliberate visible activity can supersede observed newer progress.
6. Recycle an existing thumbnail's href, load more thumbnails, disable/reset resume, clear records, and navigate away/back. No duplicate indicators, stale link progress or disabled thumbnail scans.
7. Check live-ad transitions, explicit timestamps, manual seeking, playlists, and existing speed/SponsorBlock/PiP controls for regressions.

## Sources and license

See [PROVENANCE.md](PROVENANCE.md). ElectroKnight22's MIT [YouTube Auto-Resume 2.8.1](https://greasyfork.org/en/scripts/526798-youtube-auto-resume/code) is a design reference. Implementation here is original project code; no helper runtime or separately supplied AGPL multi-site code is imported. Existing MIT and source notices are preserved.
