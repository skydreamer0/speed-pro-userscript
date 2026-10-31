# Bilibili adapter — 1.2.0 candidate specification

Base: GitHub main `0ad33ea4b8d102bcb78377e76eb81eb7a89155b7`, read back 2026-10-31. Local prep is an export, not a checkout; isolated snapshot branch `feat/bilibili-adapter` is for review, publication must use the actual GitHub base parent. No open PR found. Parent confirms this is the only product writer.

## Scope and architecture
- Add only `https://www.bilibili.com/video/*`; runtime hostname/path guard on every discovery/control action also prevents continued control after SPA leaves `/video/`. No bangumi, live, embed, mobile, closed shadow, or paid/DRM circumvention claims.
- Keep single userscript and existing generic core; small adapter supplies eligible video selector and route identity. Bilibili candidates only within `.bpx-player-video-wrap video` or legacy `.bilibili-player-video video`; rank visible candidates using existing scoring, never fall back to recommendation/preview videos outside these containers. Unknown player shape fails closed with no control.
- UI is existing floating control, not injected into undocumented player APIs. No new grants or network endpoint; SponsorBlock and ad helpers remain strictly YouTube-only.
- Route identity uses video pathname plus `p` query. Route change is not media change: bind media `emptied`, `loadstart`, `loadedmetadata`, and compare currentSrc/source as needed; cover reused nodes and replaced nodes. Avoid unsafeWindow/cid interception. Single existing document observer and watchdog remain, no per-navigation observers; detach old media listeners with explicit cleanup. Debounce navigation timeout, cancel on teardown. `pagehide` tears down observer/timers/listeners; `pageshow` resumes one lifecycle when BFCache restored.

## Rate and hold semantics
- Per-video state in WeakMap: baseline, source, retry count, blocked flag. Requested lock remains a session preference and transfers to next main player; temporary hold NEVER transfers between players/media. Restore held old video on switching, blur/hidden/pagehide/release even if keyboard focus moved into input. Never restore another video's baseline.
- Each explicit rate command starts a bounded enforcement budget: at most 3 corrective writes after initial write. A ratechange or watchdog shares this budget; neither replenishes it. No synchronous event recursion. Setter exceptions or readback rejection and exhausted budget cause visible conflict notice and suspend enforcement for that video until a new explicit user command (not navigation ticks). New media lifecycle gets a new baseline/budget after metadata; old timers cannot target new media. Do not claim stable success merely because setter returned.
- Existing four sites share safer lifecycle and input handling; YouTube-specific behavior remains intact. UI distinguishes actual current video rate from requested preset and conflict status.

## Keyboard and native player coexistence
- Ignore defaultPrevented, IME composing/keyCode 229, Ctrl/Meta combinations, composedPath editable/interactive targets. No hotkey/wheel hijack without eligible video. Input/select/textarea/contenteditable/ARIA textbox/searchbox/combobox and buttons/links are protected.
- On Bilibili leave Enter, arrows, Space, F, Esc, Tab to site/browser. In particular no replacement for native ArrowRight hold, or Up/Down adjustments during it. Use existing Backquote/Shift+Backquote hold, PageUp/Down, Delete, Alt+digits and floating lock; Tab lock remains existing four-site behavior only when not in interactive target. Bilibili panel documents its exception. No stopPropagation of unrelated keys.
- Hold release cleans active owned hold even if target becomes editable, but otherwise does not prevent default.

## Baseline repair and settings
- Optional listener for removed non-YouTube reset-channel button; non-YT settings open/close/reopen/reset works.
- Settings reset synchronizes inputs/checkboxes and ends lock/hold restoring own baseline; errors from unavailable localStorage are caught, playback still usable.
- Preserve namespace and existing script name identity where possible; update version/package/changelog/README to 1.2.0 candidate, explicit updateURL/downloadURL to verified repo raw main path. Draft branch does not mean main offers 1.2.0 or existing installed scripts discover migration automatically.

## Required repeatable acceptance
`npm test` must run syntax/static metadata checks plus no-account synthetic runtime fixtures (Node DOM harness or available browser). Fixtures execute actual userscript, not a second copy of production algorithms.
1. All five host fixtures initialize; non-YT panel open/close/reopen/reset no exception; YouTube controls and SponsorBlock guarded path retained.
2. Bilibili main vs playing preview, two candidate visibility cases, no-main fail closed; lock, hold baseline 1.25, release/blur/hidden; replacement while hold and while lock.
3. Same node source reload, p=1→2, different BV route, URL-stable metadata reload, unsupported SPA route exit/reenter. Listener/observer/timer counts bounded after repeated navigation.
4. Adversarial reset-on-write player yields after <= 3 corrections, including alternating ratechange and watchdog; no recursive/indefinite write loop; explicit user command resumes safely.
5. Keyboard event matrix for input/danmaku/comments/contenteditable/ARIA/interactive/composedPath/IME/defaultPrevented/modifiers/native arrows/Enter/Tab; release after focus change; no video no hijack.
6. Network spy: zero GM requests for Bilibili including p changes, panel switches and reloads. Existing YT fetch only when valid v and enabled.
7. Original four site selection/control smoke fixtures, metadata exact allowlist, version/URL consistency and no added permissions.
8. Browser/site live tests separately marked PASS/FAIL/NOT RUN. Synthetic is not real Bilibili/Tampermonkey validation. No install into user account.

## Research and provenance (architecture only; no source copied)
- Bilibili-Evolved player-agent separates bpx, legacy, bangumi and live implementations: https://github.com/the1812/Bilibili-Evolved/tree/master/src/components/video/player-agent . Adopt narrow adapter boundaries, not broad support claims.
- Observer implementation separately tracks URL and cid; cid can transiently be array. This demonstrates SPA URL alone is insufficient: https://raw.githubusercontent.com/the1812/Bilibili-Evolved/master/src/core/observer.ts . We instead use standard media lifecycle, no cid hook dependency.
- License states MIT with additional redistribution/support conditions; do not flatten to pure MIT or copy code: https://github.com/the1812/Bilibili-Evolved/blob/master/LICENCE.md .
- Native hold-speed arrow conflicts are documented by maintainer/community: https://github.com/the1812/Bilibili-Evolved/discussions/5654 . Treat as compatibility risk, not universal current UI guarantee.
- h5player task configuration distinguishes bilibili.com and live.bilibili.com, native fullscreen selectors and danmaku focus handling: https://github.com/xxxily/h5player/blob/master/src/h5player/h5PlayerTccInit.js . Keep site exceptions explicit; do not copy its control hooks or forcibly blur user's input.
- h5player is GPL-3.0, independently implement concepts for this MIT repository: https://github.com/xxxily/h5player .

## Review gate and delivery
SPEC approval from parent and independent reviewer required before product edits. Then independent tests/review at exact content hash; fix findings, retest; parent controls publication after final same-head review. Draft PR only, no merge/deploy. External main movement requires reconciliation before publication.
