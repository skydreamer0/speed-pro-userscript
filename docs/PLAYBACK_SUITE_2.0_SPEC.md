# Playback Suite 2.0 — Integration & Rebrand SPEC (Draft)

Status: SPEC only; implementation, installation, release and repository rename are NOT done.
Date: 2026-11-01 (Asia/Taipei).
Baseline: main at review time; current Speed Pro 1.2.0, single speed-pro.user.js, MIT, Node synthetic tests and optional browser fixture.
Source material: user-provided YouTube Auto-Resume 2.8.1 (MIT), youtube-adb 6.21 (MIT), SponsorBlock Lite 1.2.0 (LGPL-3.0-or-later), plus the project's existing original code. Source versions describe supplied attachments, not a guarantee of latest releases.

## 1. Decision and name

**Proposed product name: Playback Suite｜跨平台影片播放助手.**
Suggested eventual repository slug: playback-suite-userscript; suggested package name: playback-suite-userscript.
Rationale: no longer just a speed tool; unified speed / resume / sponsor skipping / visual ad cleanup / playback utilities.
**Do not rename the GitHub repository or the existing raw filename during feature PRs.** The existing main raw URL is a live update channel. GitHub redirects, userscript manager identity, old install metadata and cross-origin storage cannot be assumed to migrate. Rebrand user-facing labels only in a dedicated compatibility PR; keep current @namespace, main URL and internal storage keys unless migration tests explicitly cover the change. Final repository rename requires a separate approved release/rollback gate.

## 2. Existing vs incoming capability

| Module | Current code | Incoming source | Target behavior |
|---|---|---|---|
| Speed / control | 1.2.0 supports www.youtube.com, Bilibili /video, FB, IG, Threads; holds, locks, presets, PiP, screenshots | none | Preserve behavior, one current player owner, bounded rate enforcement |
| Resume | no persistent playback timestamp | YouTube Auto-Resume 2.8.1 | YouTube video + playlist-specific checkpoints, safe restore, expiration and storage cleanup |
| Sponsor | YouTube only, full videoID query, timeupdate seek, toast/undo | SponsorBlock Lite 1.2.0 adds Bilibili, categories, visual progress markers, full-video labels | Single unified Sponsor engine with per-platform adapter, one skip writer, visualization and user override |
| Ads | YouTube native skip-button click + ad mute | youtube-adb 6.21 adds CSS selectors and aggressive seeking/popup handling | Narrow, reversible cosmetic filters and conservative native skip / mute logic. No forced seeking to duration or forced autoplay |
| Settings | localStorage keys yt-speed-pro:settings and :channels; non-YT panel guards | three independent systems | One panel, site-aware toggles; settings migration with same legacy keys and no data loss |

No verbatim transplant of the SponsorBlock Lite source into the MIT runtime. Independently implement functionality against public API descriptions and retain acknowledgements/provenance. Do not adopt its LGPL snippets without a deliberate licensing decision.

## 3. Supported platform matrix (2.0)

| Capability | YouTube www/watch | Bilibili www/video | FB / IG / Threads | YouTube mobile / Music / embed |
|---|---|---|---|---|
| Existing speed / shortcuts / PiP | preserve | preserve, experimental | preserve | not promised |
| Resume | yes (new, opt-in initial release) | defer | defer | defer |
| Sponsor skip / progress markers | yes | yes with verified BV + CID/page identity; opt-in | no | defer |
| Video ad skip, mute | yes, only when ad state is certain | no | no | defer |
| Cosmetic ad filtering | YouTube only; separately toggled | no | no | defer |

YouTube Shorts and preview playback must not overwrite regular-video checkpoints. The source scripts have a wider site match, but new @match permissions are NOT silently widened to music.youtube.com, m.youtube.com, youtube-nocookie.com or embedded pages. Those are follow-on compatibility PRs after real manager testing. Bilibili episodes/live/bangumi, paid-content/DRM bypass and aggressive anti-adblock popup manipulation are out of scope.

## 4. Architecture — single ownership of playback state

One app bootstrap + one route observer/watchdog, not three copied bootstraps.

- MediaCoordinator: detects current eligible video and route/media change; owns a generation token; cancels timers, aborts stale requests, disconnects old listeners, prevents late writes to a replaced video.
- RateController (existing): owns playbackRate. Hold/lock and bounded retries are unchanged.
- ResumeController: owns only checkpoint storage and *initial* currentTime restore; never takes ownership after a manual user seek or explicit URL time.
- SegmentController: merges platform API data and user configuration into one normalized list; is the **only** segment-based currentTime writer. Existing checkSponsorSkip must not run independently after migration.
- AdController: reads only reliable YouTube ad state; may click a visible enabled native skip button and temporarily mute; never jumps currentTime to video.duration.
- UIController: single settings panel, progress overlay, toast and undo; no duplicate DOM IDs, MutationObservers or history.pushState patches.

Playback order: validate current video + route -> explicit URL timestamp / manual seek wins -> resume at most once when metadata is ready -> segment scheduler may skip after resume settles -> ad assist only in confirmed ad state -> rate control independently. When ad starts, pause resume and segment seeks. When navigation, source swap, BFCache, pause/close or manual seek occurs, cancel stale timers and pending seek callbacks.

No manager API @require from another GreasyFork script. External network services are data-only (SponsorBlock, BilibiliSponsorBlock); no runtime JavaScript fetch/eval.

## 5. Resume details

- Key identity: YouTube 11-character video ID; standalone and playlist list=ID are separate buckets. WL (Watch Later) treated as standalone unless verified otherwise. Explicit t/start time and live/ad sessions are never overridden.
- Save a checkpoint only for an eligible, user-watched non-ad video with finite duration and time >= 5 seconds. Throttle writes (at most once / 5 seconds) plus pause/pagehide best-effort flush; do not save preview/hover playback as a regular watch session.
- Restore only when enabled, no explicit timestamp, no intervening manual seek, seekable metadata loaded, saved time <= duration - 15s and >= 5s. Avoid repeated seek loops; latest matching video generation wins.
- Completion: near-end threshold max(15s, 1% of duration) capped appropriately, with special handling for very short videos. Completed does not auto-resume to near-end. Playlist last-watched jump needs explicit enable and confirmed membership; default just restore same selected item to avoid unexpected navigation.
- Retention initial default: regular 90 days; Shorts 1 day if later supported; previews 10 minutes if later supported. Periodic cleanup, bounded entry count and writes; user controls clear playback history. Legacy speed/channel keys untouched.
- Privacy/storage: prefer userscript-manager GM storage for progress if compatibility proven; otherwise same-origin localStorage only behind explicit opt-in and a warning that page scripts may access it. Cross-tab updates must be monotonic and never let older checkpoints overwrite newer after race; use storage events/manager listeners only if supported. Test on Tampermonkey, do not claim manager parity without evidence.

## 6. SponsorBlock and Bilibili details

- API sources: https://wiki.sponsor.ajay.app/w/API_Docs and https://github.com/hanydd/BilibiliSponsorBlock/wiki/API ; fixed connect allowlist sponsor.ajay.app and bsbsb.top only. New domain requires @connect update, privacy disclosure and CI allowlist adjustment.
- Prefer SHA-256 4-hex prefix endpoint on both services, then filter returned bucket against the **exact videoID**. Do not send complete video IDs by default in a new privacy mode; migration from existing full-ID YouTube requests must be explicit and tested. Network errors, 404, invalid JSON, 429 -> fail open: do not skip.
- Strict parse: whitelist category and actionType=skip; enforce finite 0 <= start < end <= plausible media duration, max segments, dedup and sort. actionType=full is a label, NEVER an auto-seek. Music-only category is not skipped on ordinary YouTube.
- Bilibili identifier: BV ID plus verified current page CID. A BVID alone is not sufficient for a multi-P video. If CID cannot be verified, visual markers and auto-skip must fail closed; never apply a segment from a different P or duration. Clear on p, BV, video source, route and tab changes.
- Single time writer; suppress repeated skip loops and stale async returns. Undo jumps back once and exempts the segment during the current viewing pass. Color overlay must not intercept pointer interactions, must be removable/reattachable on SPA, and must not permanently edit site CSS/layout.

## 7. YouTube ad handling

- Separate toggles for native ad skip, mute-during-ads and cosmetic ad CSS. Preserve a user's manual mute/volume changes; restore only values actually modified by this script.
- Do not seek advertisement video to the end; do not force .play() when the user paused; do not remove arbitrary overlays or account/consent dialogs. Hide narrowly confirmed ad/promo renderers only and remove our style when disabled.
- Ad detection requires confirmed player ad state. If uncertain, do nothing. A hidden ad may still exist; don't promise 100% ad-free.

## 8. Settings, identity and security

- Keep existing @namespace george.youtube.speedpro for update identity. Persist old localStorage keys unchanged in interim; version new settings with defaults and validate migrations, preserving custom speed/channel values.
- New network/GM permissions added only in the feature PR that uses them, documented and tested. No cookies, credential interception, remote code, sensitive account data or telemetry.
- Feature flags make new resume/Bilibili/filters **off by default in the first candidate**; existing SponsorBlock and ad skip settings keep their current user-selected behavior.
- A version bump is required only for the final release candidate, not each stacked draft. On release verify @version, package version, README, CHANGELOG, metadata URL and only-one-installed-copy instructions.
- Keep source documents and license declarations: base MIT; Auto-Resume MIT; youtube-adb MIT; SponsorBlock Lite LGPL-3.0-or-later; derivative code cannot be silently relicensed MIT. Document clean implementation and API/data attribution.

## 9. PR sequence (stacked Draft PRs; no auto-merge)

| Order | Branch / target | Deliverable | Required gate |
|---|---|---|---|
| PR-A | docs/playback-suite-2.0-spec -> main | This SPEC, feature matrix, provenance/privacy/risks and acceptance | SPEC review; no runtime changes |
| PR-B | feat/playback-suite-core -> PR-A head | Shared route/media lifecycle, feature flag settings, branding preparation, API/test seams; preserve 1.2.0 behavior | npm test + baseline regression, no widened permissions |
| PR-C | feat/playback-suite-resume -> PR-B head | Standalone/playlist resume, checkpoints, cleanup, cross-tab race control, opt-in panel | synthetic + browser fixtures, no ad/explicit-t seek |
| PR-D | feat/playback-suite-sponsor -> PR-C head | Unified Sponsor engine, Bilibili BV/CID scoped adapter, progress overlay, undo, hash-prefix queries and @connect | API parser fuzz fixtures, two-P tests, 0 requests non-target |
| PR-E | feat/playback-suite-ads -> PR-D head | Conservative cosmetic cleanup and existing ad-assist refinement | no forced seek/play, no removal of generic dialogs, toggle reversible |
| PR-F | docs/playback-suite-release -> PR-E head | Final user-facing name/version, docs, install migration, source/license acknowledgements and release checklist | independent review + real-browser validation; separate repo-rename decision |

Stacked PRs must target their immediate predecessor branch. Do not mark later PRs as independently ready to merge. Rebase or re-target in order after predecessor merges; never force update a running user's main installation during validation.

## 10. Acceptance checklist (must be independently repeatable)

1. npm test passes on production code under Node >=18; no duplicate simulated algorithm. Exact metadata allowlist, license, URLs and legacy settings migration are checked.
2. Existing five hosts: hold/lock, rate conflict 3-write budget, old/new video replacement, SPA, BFCache, keyboard/input exemptions, panel, PiP/screenshot smoke; no behavior regression.
3. Resume: YouTube standalone / playlist collision, WL, exact URL t, explicit manual seek, pause/seek/replay, completed, short/video live, seeking during ad, concurrent tabs and timeout/error, 90-day cleanup.
4. Sponsor: invalid/missing BV or CID, p=1->2, stale response A->B->A, malicious segment ranges, full-video flag, rapid seeks, return/undo, multiple progress bar implementations; no Bilibili wrong-page skip.
5. Ads: skip button only when ad confirmed; CSS only for known ad renderers; user pause and audio unchanged after ad; no generic modal removal, no forced video.duration jump.
6. Performance: one active observer family, limited timers and listeners after 100 SPA navigations; bounded storage size and request rate.
7. Manual matrix: Chromium + Tampermonkey on YouTube and Bilibili, then FB/IG/Threads smoke; mobile/Music NOT SUPPORTED until separately tested. Browser fixture vs real website explicitly distinguished.
8. Security/provenance: no pasted LGPL code, review new @connect/grants, privacy and third-party API terms. Installation/upgrade/rollback documented and tested.

PASS / FAIL / BLOCKED / NOT RUN recorded separately. No PR merge, release, user installation or repo rename merely from synthetic pass.

## 11. Risks and rollback

- Changing @name may make a userscript manager treat it as another script even with stable @namespace; verify an upgrade path before shipping and warn users to disable duplicate installs.
- Renaming repository or moving speed-pro.user.js can break hard-coded raw update URLs despite GitHub redirect behavior. Keep old file as stable forwarding artifact or keep it canonical until migration is demonstrated; external GitHub Settings rename is not part of a code PR.
- Bilibili API/CID and UI internals are fragile. Fail closed; availability does not imply correct-page matching.
- Background resume and ad controls can compete with native YouTube play state; manual action and explicit URLs always win.
- Rollback: disable each new module independently without touching legacy speed state; revert PR stack in reverse order, and keep existing raw update channel working.

## 12. Source attribution / external references

- User attachment: ElectroKnight22, YouTube Auto-Resume 2.8.1 (MIT), https://greasyfork.org/scripts/526798-youtube-auto-resume
- User attachment: iamfugui/youtube-adb 6.21 (MIT), https://github.com/iamfugui/youtube-adb
- User attachment: hxueh, SponsorBlock Lite 1.2.0 (LGPL-3.0-or-later), https://greasyfork.org/scripts/560869
- SponsorBlock API: https://wiki.sponsor.ajay.app/w/API_Docs
- BilibiliSponsorBlock API: https://github.com/hanydd/BilibiliSponsorBlock/wiki/API
- Existing project contracts: SPEC.md, docs/TESTING.md, docs/PROVENANCE.md, README.md and AGENTS.md.

This specification describes intended implementation, not completed or verified functionality.
