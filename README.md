# Playback Suite｜跨平台影片播放助手

**2.0.0 候選版 / MIT / 單檔 Userscript**  
由 Speed Pro 擴充而成：倍速、YouTube 自動續播、SponsorBlock（YouTube / Bilibili）、可選靜態廣告隱藏、PiP 與 PNG 截圖。

> **尚未發布**：本版本在堆疊 Draft PR 上。原始 main 安裝 URL 目前仍提供既有版本。Node 合成測試通過不代表真網站或 Tampermonkey 驗收通過；切勿將 Draft 當正式版安裝／更新。

## 功能與支援範圍

| 網站 | 倍速 / 快捷鍵 | 自動續播 | SponsorBlock | 廣告處理 |
|---|---|---|---|---|
| YouTube www（watch） | 既有功能 | **可選；預設關閉** | 既有功能擴充，雜湊查詢、可選標記 | 原生略過／靜音；可選靜態廣告 CSS |
| Bilibili www /video | 實驗性 | 未支援 | **可選；預設關閉；必須確認 BV + 本分 P CID** | 未支援 |
| Facebook / Instagram / Threads | 既有共用控制 | 未支援 | 未支援 | 未支援 |
| YouTube Music／手機版／嵌入頁 | **未納入本版匹配** | 未支援 | 未支援 | 未支援 |

Bilibili 主影片找不到即不控制。Bilibili 番劇／直播不在範圍；不繞過登入、付費或 DRM。廣告輔助不保證 100% 無廣告。

## 操作

| 操作 | 效果 |
|---|---|
| 按住 Backquote（`） | 暫用一般倍率，放開回復該影片基準倍率 |
| Shift + Backquote | 暫時啟用超速倍率 |
| 浮動倍率鈕 | 鎖定／解除；YouTube 按鈕用於開啟設定 |
| PageUp／PageDown | 每次 ±0.25× |
| Alt + 1–5 | 套用 1–5× |
| Alt + 滾輪 | 加減倍率 |
| Alt + S／Alt + P | PNG 截圖／子母畫面（視瀏覽器支援） |
| Tab／Enter | Bilibili 保留原生；其他網站沿用既有條件式快捷鍵 |

控制範圍 0.25×–16×，不保證每個平台都接受。若播放器持續重設倍率，最多校正三次後停止重試，直到明確重新選倍率。

## 續播與 SponsorBlock

**續播（關閉為預設）**：YouTube watch 頁面記錄影片時間；同一影片在一般播放與特定 playlist 中分開儲存。明確網址 `t`／`start`、手動尋找時間點與已看完影片優先；資料 90 天過期，最多保留約 2,000 筆。另有清除續播紀錄按鈕。播放清單上次影片跳轉是額外可關閉的實驗功能。

**SponsorBlock**：YouTube 原有功能擴充為 SHA-256 前四碼查詢與片段標記；Bilibili 另外使用 bsbsb.top，必須能從當前頁取得匹配的 BV、CID 才會跳段（否則不處理）。全片分類只顯示標籤，不直接跳掉整片；片段可透過提示按鈕返回。資料來自社群標記，可能有錯誤，隨時可關閉。

**廣告**：只在 YouTube 明確進入 ad-showing 狀態時點擊可見的原生略過按鈕或暫時靜音。新增 CSS 預設關閉，只隱藏已辨認的靜態廣告元素；**不會快轉整段廣告到影片結尾、強制播放或任意移除彈窗**。

## 安裝、更新與改名

正式安裝來源（**目前仍是 main 舊版**）：[speed-pro.user.js Raw](https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js)。

計畫中的顯示名稱為 **Playback Suite**、套件名稱為 playback-suite-userscript；為了維持更新，原始 `@namespace`、原始檔名、`@downloadURL` 與 `@updateURL` **暫不改動**。既有 Speed Pro 可能因 `@name` 改變被管理器視為新腳本。正式升級前需檢查只啟用一份，必要時先停用舊副本，絕不預設可無痛自動遷移。GitHub 儲存庫名稱也**尚未更改**。

## 隱私與權限

- 新版僅新增 `@connect bsbsb.top`，原有 SponsorBlock 網域為 `sponsor.ajay.app`；`GM_xmlhttpRequest` 仍是唯一宣告的 grant，沒有遠端 `@require` 或程式碼下載執行。
- **YouTube 與 Bilibili** SponsorBlock 使用影片 ID 的 SHA-256 前四碼查詢；回傳桶內需要再符合完整影片 ID（Bilibili 另比對 CID）。外部服務仍能看見 IP 等一般連線資訊；雜湊前綴不是完全匿名。
- **續播資料存在 YouTube 網頁的 localStorage**，前綴 `yt-speed-pro:resume:v1:`，同源網頁腳本可能讀取。這不是私有／加密 GM 儲存。預設關閉；開啟前請自行衡量。
- 舊的 `yt-speed-pro:settings` 與 `yt-speed-pro:channels` 保留，不做破壞性遷移。不同網域無跨站同步；沒有分析追蹤或外部帳號同步。
- Bilibili 可能因使用者腳本 sandbox 無法讀到頁面的 CID，導致安全地不執行跳段；此情境須真站驗證。

## 測試與限制

`npm test`：Node >=18，沒有 npm 相依，執行語法、metadata、16 組 production-function 合成 fixture（PR #7 上已通過 GitHub Actions）。**尚未**完成真 YouTube／Bilibili／FB／IG／Threads、Tampermonkey 及完整 DOM browser 驗收；Bilibili CID 相容性、續播跨分頁競態及進度縮圖同步仍為已知缺口。沒有宣布 release 或合併任何 PR。

[整合 SPEC](docs/PLAYBACK_SUITE_2.0_SPEC.md) · [原 Bilibili SPEC](SPEC.md) · [測試](docs/TESTING.md) · [已知限制](docs/KNOWN_ISSUES.md) · [來源與授權](docs/PROVENANCE.md) · [變更](CHANGELOG.md) · [安全](SECURITY.md) · [貢獻](CONTRIBUTING.md)
