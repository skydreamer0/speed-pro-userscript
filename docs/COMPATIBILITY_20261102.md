# 來源通知／相容性收尾驗證（2026-11-02）

## 範圍與精確版本
基底：`503ab27737d0d925f3c35aef2309c9bf30406f2f`（main 讀回；本輪開始無 open PR）。
本分支只補通知／文件及測試；不改播放邏輯、功能預設、metadata 權限、儲存鍵、MIT LICENSE、`2.0.0` 或更新 URL。**不是發行版或真站驗收結案**；Greasy Fork 現有發行頁／安裝碼此次無法讀回。

候選 userscript SHA-256：`cc68ebaa582784bfa2034835f79eb71e6c5ce0b7aa0da98f9fd954dba1726b3c`。測試檔 SHA 與 PR head 應以此提交的 Git tree／CI 讀回核對；以下結果不得轉貼為其他 runtime 版本的驗收。

## 本輪執行
環境：Node v24.22.1、npm 11.9.0，隔離 VM；不登入網站、不安裝擴充、不聯絡第三方。

| 命令／階段 | 結果 | 實際範圍 |
|---|---|---|
| 基底 `npm test` | PASS | 語法、metadata／權限、原 28 production-function groups |
| 基底 `node scripts/repair-negative-test.mjs` | PASS | 5 個刻意破壞護欄的版本均被測試拒絕 |
| 候選 `npm test` | PASS | 語法、metadata／完整 MIT／資料 notice、30 groups；新增 legacy 設定保留與明確預設兩組 |
| 候選 `node scripts/repair-negative-test.mjs` | PASS | 同 5 個負控；不是五種真站測試 |
| `node --check scripts/browser-test.mjs` | PASS | 只驗語法；新增來源區塊／連結契約未執行 DOM assertions |
| `npm run test:browser` | BLOCKED before assertions | 預設 ESM 找不到 Playwright；改用已存在模組的官方環境變數後，Chromium 啟動發生 `socket() failed: Operation not permitted` |
| 真站／管理器／視覺 QA | NOT RUN | YouTube、Bilibili、FB／IG／Threads、Tampermonkey、手機／Safari／Firefox及升級流程均不以 VM 代替 |

Playwright/Chromium 測試使用既有環境提供的路徑；未為通過測試而安裝依賴、升權、改安全限制或改用另一環境執行。既有 browser fixture 所有 URL 都 route 到自製 HTML，原本也不是真站驗收。

## 相容性矩陣
| 邊界 | 已執行的證據 | 仍待真站／管理器驗證 |
|---|---|---|
| YouTube watch／playlist／明確 t | VM 驗證 playlist key 隔離、時間網址優先、完成／過期處理、route-before-media、stale generation | 真播放器時序、thumbnail 同步未實作、跨分頁 last-write-wins、explicit index 等原生行為 |
| YouTube SponsorBlock | 真 SHA-256＋mock GET 正控；錯回應／換來源／換 video／A→B→A 拒絕；undo 完整區段豁免 | 真 API／真 DOM／真管理器、網路中斷與限流、進度條排版；不以 mock 當連線驗證 |
| 原生廣告／CSS | VM 確認 ad-showing gating、靜音所有權還原、可逆 opt-in CSS | 真廣告切換、不同 skip selector／使用者音量操作、平台條款；預設 skip/mute 仍 true |
| Bilibili 普通＋zh-Hant／分 P | strict parser、重複／錯誤 p、非支援路徑、主影片／preview 負控、換源／退出範圍 | URL 轉址、locale 注入、真多 P／合集、native long-press 衝突 |
| Bilibili SponsorBlock | 即使 opt-in、route CID、影片都存在仍 0 request/marker/seek；不接受假 active-media 身分 | 維持 disabled；不能把安全停用說成「已支援」 |
| 多 video／生命週期 | per-media baseline、hold 不轉移、lock 接續、重綁去重／卸載、重設倍率最多三次 | 無法涵蓋真站 feed 所有可見度／DOM 情況；BFCache／背景恢復與長時間資源曲線 |
| 鍵盤／輸入 | VM 檢查 composedPath、editable／互動目標、IME、defaultPrevented／modifiers；Bilibili 原生保留鍵有 browser fixture 但未執行 | 真鍵盤／focus／無障礙；非 Bilibili Tab 在加速時仍可能干擾普通頁面焦點 |
| 舊設定／升級 | 新 VM seed 讀回原 settings/channels keys，保留舊關閉選擇、其他站點 key、不自動開啟新模組 | 管理器改名造成重複安裝、來源 override、不同網域資料隔離／備份還原 |
| 新來源通知 | 靜態 full MIT／連結契約，無新的 grant/connect/require；browser assertions已備 | 面板高度／小視窗滾動／對比／連結點擊與關閉重開的真 DOM／視覺 QA |
| PiP／PNG／全螢幕 | 本輪未新增行為；既有呼叫保留 | 使用者啟動、瀏覽器權限／跨來源 Canvas、保護內容；不能宣稱全站可截圖 |

## 發行前仍需的短清單
1. 能執行 DOM fixture 的授權環境跑完整腳本及來源面板；不得將目前 BLOCKED 改寫為 PASS。
2. 以 exact SHA、瀏覽器／管理器版本，逐案記錄上述真站代表情境；每項列 PASS／FAIL／BLOCKED／NOT RUN。
3. 實際安裝／由 Speed Pro 升級／停用重啟／回復舊版；確認只啟用一份、settings/channels 保留，原 updateURL 不會意外把 Draft 覆寫成 main。
4. 讀回 Greasy Fork 發行碼及說明，與已核准 SHA／notice／權限比對。此 PR 不執行該發行。
5. 原 1.1.0 前史和指定附件來源仍待補；商業／資料再散布條件未結案。見 [來源與通知](THIRD_PARTY_NOTICES.md)。

獨立審查與遠端 CI：作者本地結果不冒充獨審，精確 head 的審查／CI 結果放 PR；不得因本文件寫了清單便標示 ready/merged/released。
