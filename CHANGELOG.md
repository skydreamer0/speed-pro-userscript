# Changelog

## 2.0.0 — Playback Suite candidate (stacked Draft PRs, NOT RELEASED)

- Rename candidate display name from Speed Pro to Playback Suite while retaining the existing namespace, stable raw path and localStorage settings keys.
- Generation-scoped media seek coordinator; reject stale route/media and out-of-range feature seeks.
- Opt-in YouTube checkpoint auto-resume, standalone vs playlist separation, completed/expired records and clear-history UI (YouTube-origin localStorage).
- Unified SponsorBlock parser: hash-prefix requests, exact ID and Bilibili current-page CID validation, optional timeline markers, full-video label.
- Conservative YouTube ad improvement: native visible skip button, improved ad mute ownership and reversible static-ad CSS; no forced skip to end, no forced autoplay.
- New @connect bsbsb.top; no external @require or additional GM grants.
- Extended production-function VM test suite (16 fixture groups at PR #7); real-site/Tampermonkey/complete-DOM validation NOT RUN.
- Known gaps: Bilibili sandbox CID visibility; thumbnail/cross-tab progress sync not yet implemented; localStorage is site-readable; package and display branding are not a repository rename.

## 1.2.0 — candidate, not released on main

- Experimental Bilibili `/video/*` main-player adapter; native key preservation and media lifecycle handling.
- Per-player baseline/hold cleanup and bounded rate-reset correction with conflict feedback.
- Non-YouTube settings null-listener fix, safe storage writes and reset field synchronization.
- Explicit main raw update/download URLs; no claim of availability before merge.
- Node production-function fixtures; optional Chromium fixtures (author launch blocked).


## 1.1.0 — 專案匯入整理（2026-10-31）

- 匯入作者提供、metadata 已標記為 1.1.0 的 Userscript；這不是重新宣稱原功能的開發或發布日期。
- 將腳本 CRLF 換行轉為 LF，並依作者同意新增 `@license MIT`；保留所有功能原碼及既有 metadata。
- 加入作者同意的 MIT LICENSE。
- 補上安裝、快捷鍵、隱私、相容性限制、開發、安全回報與來源文件。
- 加入無外部相依的靜態檢查、CI 與 Issue／PR 範本。
- 記錄非 YouTube 面板初始化等已知問題，未在本次整理中修復。

未提供更早版本歷史，因此不推測 1.0.x 的變更內容。
