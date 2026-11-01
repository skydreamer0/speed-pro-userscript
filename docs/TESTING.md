# Integrated repair candidate verification (2026-11-01)

Runtime base: PR #8 `e46f05cb170ebbb534341ea84cce442a7e6c16cb`, corrected by #10. The main-based integration preserves #3/#9 evidence and does not change the reviewed runtime or test scripts. See [repair evidence and integration plan](REPAIR_20261101.md).

- `npm test`: PASS locally, syntax/metadata/permissions plus 28 production-function fixture groups, including asynchronous real SHA-256 and mocked HTTP positive/negative cases.
- Chromium DOM fixture: BLOCKED BEFORE TEST. `/usr/bin/chromium` launch failed with `socket() failed: Operation not permitted`; no escalation or restriction bypass. Fixture paths were updated but the browser assertions did not run.
- Real Bilibili, YouTube, Facebook, Instagram, Threads and Tampermonkey install/upgrade: NOT_VERIFIED. No account interaction, DRM/login bypass or extension installation.
- Independent scope review: 28 repository groups, nine additional groups and five mutation negative controls passed against runtime SHA-256 `2de7e744cb59d0aba6e10f05728c81adb163196d214f56b6aaf3171d6199eead`. Final integration CI and merge evidence are recorded in [PR #10](https://github.com/skydreamer0/speed-pro-userscript/pull/10); code integration is not a release or a manager acceptance result.
- Historical evidence below remains tied to its original head; it is not final-candidate acceptance.

---

# Playback Suite 2.0 candidate testing status

**GitHub Actions (stacked PR #7 head, 2026-11-01):** npm test PASS. No external npm dependencies; static metadata allowlist and 16 production-function VM fixture groups passed. This is synthetic evidence, NOT real browser/site, legal, cross-tab, or Tampermonkey certification.

New fixtures cover generation-scoped seek rejection, standalone vs playlist checkpoints, explicit URL timestamps, Bilibili BV/CID page validation, segment invalid-range/full-action filtering, ad-state-gated skip/mute, and reversible cosmetic CSS. Existing Bilibili main video and four-site control regression fixtures remain.

**Outstanding required real tests:** YouTube watch/playlist, ad transitions, manual seeks, navigation/thumbnail changes; Bilibili p=1 -> p=2 on live DOM and sandbox CID exposure; social-site playback controls; Tampermonkey installation/upgrade/duplicate-script identity; Chromium full DOM, multi-tab races and restored BFCache sessions. Show PASS/FAIL/BLOCKED/NOT RUN per case.

Existing 1.2.0 testing notes retained below for history.

---

# 測試 — 1.2.0 candidate

## 可重跑

`npm test`（Node >=18，無相依套件）執行語法、metadata 精確 allowlist/version/update URL，以及 9 組 production-function VM fixtures。VM 使用實際 userscript 函式，僅在測試環境注入 private seam、stub UI；不是第二份演算法，亦不是完整 DOM 測試。

涵蓋：主片排除預覽、路徑守門、每片 hold/lock 基準與換片、listener 去重／卸載、同步惡意 ratechange reset 有限寫入、媒體事件不得補重試預算、四站速度回歸、非 YT SponsorBlock 0 requests、輸入/IME/composedPath guard。

## 真 DOM fixture（需 Playwright 與 Chromium）

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chromium npm run test:browser
```

或在已有 Playwright 模組與其 Chromium 的環境直接 `npm run test:browser`。本儲存庫不捆綁瀏覽器、沒有 runtime 套件依賴。測試所有 URL 都 route 到自製 HTML，沒有真站流量／帳戶／擴充安裝。

包含五站完整腳本啟動、面板開關／重設／重開、按鍵避讓、hold blur／焦點轉移 release、替換 video、media reload、分 P 與退出 scope、network spy／pageerror。

## 作者實際結果（2026-10-31）

- Node v24.22.1 `npm test`：PASS，9 fixture groups，語法／metadata PASS。
- Chromium 155 fixture：**BLOCKED BEFORE TEST**。一般 sandbox 啟動發生 `socket() failed: Operation not permitted`；一次工具升權執行在 wrapper 發生 `bwrap: Can't create file at /home/agent/.codex/sessions: Read-only file system`。未讀取該路徑、未繞過限制，未把 fixture 當成通過。
- 真 Bilibili、多 P／合集實片、Tampermonkey、Firefox／Safari、原生全螢幕/PiP/截圖：**NOT RUN**。
- CI 的 `npm test` 是 Node fixture，不代表任何真站或瀏覽器驗收。

獨立評審需對精確最終 head 另記結果；發布 Draft PR 不表示 ready to merge。
