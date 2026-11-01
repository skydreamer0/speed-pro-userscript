# Speed Pro — Bilibili Enhancement SPEC

狀態：**差額規格草稿；不是功能完成或正式驗收**。研究日期：2026-11-01。

## 1. 本輪決策與範圍

依使用者要求，以一名工作者完成現況盤點、官方來源研究、可重跑缺口診斷與分批規格。先維持 Tampermonkey userscript；不全面改寫成 MV3，不自動合併、不發布正式版本、不操作使用者電腦。

**已存在另一組實作，不能當作尚未開工：** PR #3–#8 已建立 Playback Suite 2.0 堆疊。因此本文件是該規格的 Bilibili 專項補充，不另建第二套 Coordinator / Sponsor engine，不改名，不重做其 PR。實作前由既有作者確認接手點及確切 parent SHA。本輪不修改產品程式；研究交付後使用者明確要求推送，故另建只含規格與診斷證據的文件分支／Draft PR，以 main 為基底，不更改 #3–#8。

| 檢查對象 | 精確版本／結果 |
|---|---|
| main | `de5e0641d99ff5a22d7a4d059720bcc6c5fa567e`，package 1.2.0 |
| PR #3 SPEC | `b98990531490e6d4c10db0a9901e66e336329666`，`docs/PLAYBACK_SUITE_2.0_SPEC.md` |
| PR #4 Core | `6f89234c508406eb981af70f0f74fff4f3efd938` |
| PR #6 Sponsor | `726fd08cdf17d9446bb9af9070dcd73eb7423a19` |
| PR #8 累積候選 | `e46f05cb170ebbb534341ea84cce442a7e6c16cb`，package 2.0.0 |
| PR 狀態 | 上述 #3/#4/#6/#8 讀回為 OPEN、Draft、未合併；作者均 skydreamer0，無 requested reviewer |
| SPEC 驗收 | #3 reviews、conversation comments 均空；不能據此宣稱 SPEC 已獨立核准 |
| 本次新文件路徑 | main 與固定 #8 皆查無 `SPEC-BILIBILI-ENHANCEMENT.md`；此新檔為專項補充，非重建既有實作堆疊 |

已讀 main AGENTS.md、README.md、SPEC.md、package.json、兩版 userscript；#8 SPEC、測試腳本、發布／來源／限制文件。main `.agents/skills` 查無；本輪套用 software-engineering 與 pstack-core（來源、重現、差額、驗收及寫入者協調）工作原則。repo issue 搜尋本次回傳 0 筆，不表示其他對話沒有進行中的工作。

## 2. 已重現與尚未證明的缺口

### G1 — 語系網址仍不支援（已重現）

main 與 #8 `@match` 只含 `https://www.bilibili.com/video/*`。`inScope()` 要求 pathname 以 `/video/` 開頭；#8 `getBilibiliSponsorIdentity()` 亦獨立使用該格式。

診斷直接呼叫 #8 生產函式：一般 `/video/BV1abcdEFGH2/` 回傳 true；`/zh-Hant/video/BV1abcdEFGH2/` 回傳 false，Sponsor identity 為 null。這證明**現有程式不支援該路徑**，不是已完成真站 URL 轉址／播放器驗證。

### G2 — route CID 不等於 active-media CID（可證實設計缺口，未證實真站誤跳）

#8 由 URL 的 `p` 讀 `window.__INITIAL_STATE__.videoData.pages[p-1].cid`。沒有 active-player/media CID 的一致性證據；診斷甚至沒有媒體元素仍可取得 CID 202。SPA 分 P 切換期間「網址已換、媒體未換」或 userscript sandbox 看不到頁面狀態，必須 fail closed。既有規格要求 verified current-page CID，現有測試只證明陣列索引與範圍，不證明媒體身分。

### G3 — 忽略來源影片長度，接受過期片段（已重現）

官方 BilibiliSponsorBlock API 把 `videoDuration` 用於換源／過期識別，已知長度要求 ±2 秒內。#8 `normalizeSponsorBucket` 僅檢查 segment 邊界與 CID，未檢查 `videoDuration`。

診斷輸入：目前 120 秒、相同 BV/CID、片段 `[5,12]`、`videoDuration:999`；仍接受 1 個片段。應拒絕已知長度不符；`0`（未知）的政策須明文決定，初期保守採僅提示、不自動跳過。這不是說所有片段都錯，而是反例已被接受。

### G4 — 驗收缺口（不是產品失敗）

本輪 `npm test` 在 #8 匯出內容上 PASS，包含 metadata 與 16 組 production-function VM fixtures。沒有真實 Chromium + Tampermonkey + Bilibili 證據；DOM fixture、網站、管理器注入是三個不同層級。既有 PR 的瀏覽器限制不得被合成測試掩蓋。單一工作者沒有新獨立審查，保留待審，不自稱獨審。

## 3. 功能矩陣：以 main 為基線，另列 #8 進展

Existing = 已有原碼，不代表真站通過；Partial = 部分有；Missing = 此範圍未有；Conflict = 和既有工作重疊或契約不一致。

| 功能 | main | #8／本輪判斷 | 優先／下一步 |
|---|---|---|---|
| 普通影片、主播放器與 preview 區別 | Existing | Existing，限定主容器，不明則不控制 | P0 保留、多播放器負控 |
| 語系 URL、BV、分 P、SPA 一致性 | Partial | Partial + G1/G2 | P0 統一 parser + context；不只加 @match |
| 倍率預設／記憶 | Partial | global + YouTube channel；Bilibili per-video/UP 主缺 | P0/P1 明確持久化範圍 |
| 可自訂快捷鍵與衝突 | Partial | 輸入／IME 避讓已有，按鍵仍寫死 | P0 設計、P1 registry；原生快捷鍵優先 |
| 逐格、進度跳轉 | Missing | Missing 通用使用者控制；Sponsor seek 不算 | P1；逐格 API 精度限制需揭露 |
| 畫質／字幕快捷切換 | Missing | Missing | P1 獨立 adapter，可用才顯示 |
| 濾鏡與截圖增強 | Partial | PNG/PiP 已有；濾鏡與精確輸出未有 | P2；跨來源 Canvas 失敗降級 |
| 社群 Smart Skip | Missing（Bilibili） | Partial/Conflict：#6 已做 opt-in，G2/G3 未解 | P1 修現有引擎，不重做 |
| 本機自訂跳過區間 | Missing | Missing | P1 先本機再社群，不提交社群資料 |
| 劇院／純淨／深色 | Missing | YouTube 廣告 CSS 不等於 Bilibili 模式 | P1 模式範圍、P2 視覺整合 |
| 首頁重設計 | Missing | Missing | P3 獨立選配，非核心依賴 |
| 標題／UP 主／分區卡片過濾 | Missing | Missing | P2；可復原，勿刪資料 |
| 彈幕／留言過濾 | Missing | Missing | P2 高成本，後置 |
| 字幕擷取與 TXT/SRT | Missing | Missing | P1 合法可讀來源，登入／無字幕清楚降級 |
| 時間戳筆記／章節 | Missing | Missing | P2 本機，BV/CID 綁定 |
| AI 摘要／追問 | Missing | Missing | P2 主動觸發，先確認傳輸內容及目的地 |
| 無字幕 ASR | Missing | Missing | P3 另案授權與成本／資料流 |
| 觀看進度、設定匯入匯出 | Partial | #5 僅 YouTube opt-in resume；Bilibili／匯入匯出缺 | P1 復用儲存邊界，schema 驗證 |
| 跨裝置同步 | Missing | Missing | P3 本輪不加服務／憑證／權限 |

## 4. 架構：接到既有 Coordinator，不再建第二套

```text
Tampermonkey shell（現行）                   MV3 shell（未來另案）
          \                                 /
           Media Core / MediaCoordinator（唯一生命週期）
               ├─ VideoContext + generation
               ├─ Hotkey Registry + Storage interface
               ├─ Rate / seek arbitration
               └─ Bilibili Adapter（Route / Player / Identity / capability）
                    ├─ Player Tools
                    ├─ SegmentController（local + community）
                    ├─ Subtitle / Notes / AI（逐步啟用）
                    └─ Optional scoped UI filters
```

### VideoContext 契約

`{platform, routeKey, bvid, page, cid, identityStatus, media, mediaSource, generation, capabilities}`。
- `identityStatus` 至少區分 route-only、media-confirmed、unknown/conflict；CID 不能因 URL 合法便升格為 confirmed。
- Route parser 不做網路；驗證 HTTPS、精確 www.bilibili.com、普通影片路徑、BV 格式與正整數 p。只明列測得的 locale；第一批 `/video/` 與 `/zh-Hant/video/`，其他語系經測試後才列入，不用任意 `/*/video/*`。
- 缺 p → 1；重複 p、非數字、0、負數、超限、編碼混淆等政策固定；未知路徑或 bangumi/live/embed 不控制。AV 舊網址若要支援，另訂 canonical BV 解析，不能猜 BV。
- URL、p、currentSrc、media replacement、emptied/loadstart/loadedmetadata 共同推進 generation。URL 與媒體狀態未對齊時只可保留安全倍速操作，不啟用 CID-dependent skip/subtitle/note restore。
- 所有非同步結果帶 generation + 完整身分；回來時重核。A→B→A 不可讓舊 A 結果套到新 A generation。
- 只有既有 Coordinator 管 currentTime；RateController 管 playbackRate。手動 seek、明確 URL timestamp、原生操作優先，manual skip undo 有當次豁免，不能無限回跳。
- 單一 observer family、導航訊號和 watchdog；各功能訂閱 context，不再 patch history 或自行全頁輪詢。停用／導航／pagehide 取消 timer、abort request、解除 listener、移除自家 DOM；pageshow 恢復一次。
- 保留現有最多 3 次倍率校正，不由 watchdog 補預算；使用者新命令才重試。

### Hotkey 與播放器工具

保留原生 Space/方向鍵/Tab/Enter/F/Esc；自訂鍵先檢查站點保留鍵、內部重複與瀏覽器常用組合。editable、ARIA 輸入、IME、defaultPrevented、Ctrl/Meta、未有可控媒體時不攔截。快捷鍵可逐項關閉／重設。逐格不得把 1/30 秒宣稱所有影片都一格；可用 requestVideoFrameCallback 時仍須界定 seek 精度，無法精確則顯示近似步進。

### Storage、Smart Skip 與資料隱私

本機區間以 platform/BV/CID 儲存，不與 YouTube video ID 共用；限制區間數、檔案大小、有限數值與版本，拒絕 prototype-pollution 欄位，匯入先預覽、可取消、保留備份。

復用 #6 SegmentController，但各平台 adapter、API base、cache identity 和 category 分開。讀 Bilibili API 不等於能套用 YouTube segment；未知／錯 CID、已知長度不符、未知 action、無限數值一律不自動 seek。社群 API opt-in，不送使用者 cookie／私人 ID，不投稿／投票。Hash prefix 降低辨識精度，不是匿名保證；披露 IP、請求時間與 prefix。

字幕只用使用者合法可讀的資料，對登入限制／無字幕／限流給清楚狀態；不繞過網站限制。TXT/SRT 處理編碼、時間重疊與 HTML，輸出文字不執行。筆記先本機；AI 每次顯示要傳的字幕範圍、服務與金鑰儲存方式，明確同意後才傳送。不能把「送到另一 AI 分頁」宣稱未送第三方；點擊該站送出仍是外部傳輸。不在頁面 localStorage 放 API key，不自動總結／掃描／刪除外部 AI 歷史。

## 5. 五個工作包：整合現有 PR，不重建五個重複 PR

| 包 | 依賴與變更 | 必要驗收 |
|---|---|---|
| B1 P0 路由／身分 | 接 #4/#6 實際整合 head；統一 parser，窄 metadata，G1/G2；禁止另建 coordinator | URL/主預覽/分 P/SPA/回上一頁/同 node 換源負控；未知 CID 0 跳轉；真站 + TM |
| B2 播放控制 | B1；hotkey registry，倍率記憶範圍，seek／逐格；獨立 adapter 品質／字幕可用性 | 輸入與 IME、原生衝突、來源切換、偏好儲存失敗與遷移；四站回歸 |
| B3 Smart Skip | B1；先本機 CRUD/undo，再接 #6 社群引擎並修 G3；不能重複另一時序 writer | malformed/overlap/out-of-bounds/stale duration/wrong CID/actionType/full label；API 失敗無跳轉；切換 opt-in 無殘留請求 |
| B4 字幕與知識 | B1；字幕 TXT/SRT → 本機筆記 → AI；每段可分小 PR | 無字幕／未登入／限流、亂碼與時間戳、過期 callback；拒絕 AI 同意時零外部請求、明確同意目的地 |
| B5 UI 與內容過濾 | B1/B2；只改自家 scoped CSS 和可復原隱藏；首頁另案 | 開／關／回復、100 次 SPA listener/DOM 無成長；不遮原生重要控制，停用其他功能不受影響 |

每包產品實作之前確認既有作者是否已接手、基底與檔案歸屬；可單獨測試不等於可越過前置 PR 合併。逐包附 exact SHA、測試、限制、權限 diff、獨立 review；全程 Draft。B1 是建議下一包，不是本輪已實作。

## 6. 驗收門檻與可重跑證據

### 自動化（生產函式，不複製演算法）

1. URL 表：正常、zh-Hant、額外 query、p 省略/1/2/0/-1/NaN/過大/重複、錯 host、錯 scheme、bangumi/live/embed；locale 正規化不改影片身分。
2. 主影片 vs preview、兩主容器、隱藏影片、沒有 main → 無控制；SPA 同 BV 換 P、換 BV、URL 先換、媒體先換、同節點換 source。
3. 未證實 CID / 舊 initial state / 異步晚到 / A→B→A → 0 skip/marker；確認後才啟用。
4. Segment 長度已知差 >2 秒拒絕，0 未知按明訂降級；跨平台 cache 不混；negative-control 故意回傳錯 CID 必須失敗。
5. keyboard registry、hold release、3 次校正預算、設定讀寫不可用、取消/重入、100 次導航資源數量不增長。
6. 保持 YouTube/FB/IG/Threads 控制；YouTube SponsorBlock 不被 Bilibili 改壞。新增 grants/@connect/@match 精確對照；預設關閉的新網路功能零請求。

### 真站與管理器（本輪 NOT RUN）

記錄瀏覽器／Tampermonkey／userscript 版本與 SHA、入口 URL（去個資）、測試步驟、預期／實際、console error、network 目標與 CID 證據。至少一般影片、繁中入口、兩 P、快速切換、preview、倍速衝突、原生鍵、頁面重整、BFCache、停用／再啟用；其他四站按原授權可及範圍 smoke。未登入／風控阻擋即 BLOCKED，不換路繞過，不把空白畫面當通過。

### 本輪執行

以下診斷及 16 組結果綁定固定 #8 SHA `e46f05cb170ebbb534341ea84cce442a7e6c16cb`，不是本文件分支 main 基底的測試結果，也不代表後續浮動 head 仍有相同問題。重跑方式見 [證據 README](docs/evidence/bilibili-enhancement-20261101/README.md)。

- 研究時以固定 SHA 的完整匯出快照執行測試；本 PR 不重複提交該 userscript 或快照。
- 測試用 userscript Git blob SHA `b8bc7d28403bce4fb13961583670b0dd5a0e09cb` 與遠端固定 #8 SHA 回傳一致；SHA-256 `4474d2f7ddb840861248af0fc25acdec6db3b5a5ec1aa65e4af65608a9174ea1`。
- `cd stack && npm test`：PASS（Node v24.22.1，metadata + 16 組），原始輸出 `docs/evidence/bilibili-enhancement-20261101/STACK-TEST.log.txt`。
- 診斷腳本（現改為顯式原碼路徑並強制 SHA-256）重跑：PASS = 成功重現 G1/G3、證實 G2 證據缺口；**不是功能驗收 PASS**。輸出 `docs/evidence/bilibili-enhancement-20261101/GAP-DIAGNOSTICS.log.txt`。
- 未安裝任何競品程式；未跑真站、未安裝管理器、未更改 runtime、只發布規格與診斷文件 Draft PR，未合併／部署／新增 Issue。

## 7. 研究來源、授權與適用性

以下只參考概念／API，不複製第三方實作。觀察日 2026-11-01；浮動 upstream 需在真正引入依賴時再固定 commit/license。Stars 不作決策依據。這是工程來源控管，不是法律相容性保證。

| 專案／一手來源 | 查證結果與借鏡範圍 | 採用限制 |
|---|---|---|
| [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved)、[license](https://github.com/the1812/Bilibili-Evolved/blob/master/LICENCE.md)、[player-agent](https://github.com/the1812/Bilibili-Evolved/tree/master/src/components/video/player-agent) | 模組／播放器 adapter；license 是 MIT 描述加再散布／支援條件 | 不簡寫純 MIT，不移植原碼，不預設其全部站型適用 |
| [h5player](https://github.com/xxxily/h5player) | 跨站播放器工具；GPL-3.0；功能概念參考 | 不將 GPL 原碼／衍生碼標成 MIT，獨立實作標準 API |
| [BilibiliSponsorBlock](https://github.com/hanydd/BilibiliSponsorBlock)、[API](https://github.com/hanydd/BilibiliSponsorBlock/wiki/API) | GPL-3.0 應用；公開 API 提供 BV bucket、segment CID、來源長度欄位 | API 整合與抄應用原碼是不同事；API/資料使用條件發布前另審，不把公開 API 當無限制授權 |
| [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly)、[license](https://github.com/BewlyBewly/BewlyBewly/blob/main/LICENSE) | MIT；官方頁明列 2025-02-26 archived/read-only；UI 概念參考 | 不當持續維護依賴，獨立且可關閉美化模組 |
| [guobaren/BiliSummary](https://github.com/guobaren/BiliSummary)、[專案網站](https://guobaren.github.io/BiliSummary/) | 與使用者描述相符：字幕、摘要、追問、SRT、自訂 OpenAI-compatible；MIT 標示 | 不承接自動送出或第三方歷史清理；同名 `lxfater/BilibiliSummary` 是另一 BSD-3-Clause 專案，不能混為一個 |
| [zanmeidalao/bilibili-ai-summary](https://github.com/zanmeidalao/bilibili-ai-summary) | 與「B站 AI 總結助手」功能吻合的候選：MV3、字幕／SRT、右側 AI 分頁送出 | 使用者原文未給唯一 URL，因此僅候選識別；license 未確認，不複製。跨分頁非 userscript 必須新增權限的理由 |

一般 HTML media API 與瀏覽器限制在實作時用平台文件再次核對；競品宣稱的功能不等於我們已驗證其可靠性。不要為了「研究」安裝可執行的競品或引入遠端腳本。

## 8. 收尾與接手

本輪有實際文件、基線測試與缺口診斷，不是再開一張空派工票。下一步是將本文件交既有 #3–#8 作者協調：先處理 G1/G2/G3，確認接手 head 後才改同一 userscript。若整合已變更，重新讀 head 與差異，不能覆寫別人修改。

本文件本身待 SPEC review。16 組合成測試通過、既有 Draft PR、或本文件完成，均不代表新功能可發布、正式版本已更新、或全部 Bilibili 驗收通過。
