# Playback Suite

**在 YouTube、Bilibili 與社群網站，用同一套操作控制影片播放。**

Playback Suite（原 Speed Pro）是一支單檔 Userscript，提供倍速、快捷鍵、子母畫面與截圖，並整合 YouTube 續播和 SponsorBlock。

[安裝](#安裝) · [使用方式](#使用方式) · [支援範圍](#支援範圍) · [常見問題](#常見問題) · [回報問題](https://github.com/skydreamer0/speed-pro-userscript/issues)

> **目前為 2.0.0 候選版。** main 已包含來源通知與相容性修正，但尚未完成真實網站、Tampermonkey 安裝及升級驗收。下方安裝入口會跟隨 main 原碼更新，不是已驗收的穩定版；尚未建立 GitHub Release，這批變更也未發布至 Greasy Fork。

## 功能

- **倍速控制**：按住快捷鍵暫時加速、鎖定倍率，或微調速度；設定範圍為 0.25×–16×，實際可用倍率受播放器限制。
- **YouTube 續播**：選擇開啟後記錄觀看位置，一般影片與不同播放清單分開儲存；桌面版縮圖顯示進度與看完標記，同一瀏覽器的 YouTube 分頁會更新指示。
- **YouTube SponsorBlock**：依社群資料略過贊助等片段，可選擇顯示標記；跳過後可透過提示返回。
- **YouTube 廣告輔助**：點擊可見的原生略過按鈕、暫時靜音廣告，並可選擇隱藏已辨認的靜態廣告。
- **子母畫面與 PNG 截圖**：透過快捷鍵或設定面板操作，能否使用取決於瀏覽器、影片來源與保護政策。

## 安裝

需要可執行 Userscript 的瀏覽器與腳本管理器。以下以 [Tampermonkey](https://www.tampermonkey.net/) 為例；各瀏覽器與管理器組合仍待實測。

1. 安裝 Tampermonkey。Chrome／Edge 若提示腳本無法執行，請依[官方權限說明](https://www.tampermonkey.net/faq.php?q=Q209)設定。
2. 開啟 **[安裝 Playback Suite 候選版（main）](https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js)**，在管理器中確認來源、權限與內容後安裝。
3. 若曾安裝 Speed Pro，確認管理器中只啟用一份腳本，再重新整理影片頁面。
4. 在 YouTube 播放器控制列點擊倍率按鈕開啟設定；其他匹配網站使用浮動控制列的 **⚙**。

安裝使用者不需要 Node.js、npm 或建置步驟。若連結只顯示原始碼，請參考 [Tampermonkey 安裝說明](https://www.tampermonkey.net/faq.php?q=Q102)。

### 從 Speed Pro 更新

顯示名稱已改為 Playback Suite，但儲存庫名稱、`speed-pro.user.js` 檔名、`@namespace`、`@downloadURL` 與 `@updateURL` 保持不變。部分管理器可能因改名建立新副本，**不能假設會自動取代舊腳本**；若出現兩份，先停用舊副本，避免重複控制。

既有設定鍵保留，不做破壞性遷移。更新來源指向 main，更新檢查依管理器設定；目前沒有獨立的穩定發行通道。

## 使用方式

### 快捷鍵

| 操作 | 效果 |
| --- | --- |
| 按住 Backquote（反引號） | 暫用一般加速倍率，放開回復該影片的基準倍率 |
| 按住 Shift + Backquote | 暫用超速倍率，放開回復基準倍率 |
| PageUp／PageDown | 每次增加／減少 0.25× |
| Alt + 1–5 | 套用 1–5× |
| Alt + 滾輪 | 增加／減少倍率 |
| Delete | 套用 3× |
| Alt + S／Alt + P | PNG 截圖／切換子母畫面 |
| Tab | 非 Bilibili：在暫時加速或鎖定時切換鎖定狀態 |
| Enter | 非 Bilibili：符合焦點條件時切換全螢幕 |

一般加速倍率預設 **3×**，超速倍率預設 **5×**，可在設定中調整。Bilibili 的 Tab、Enter 與方向鍵保留原生操作，使用浮動倍率按鈕鎖定／解除；YouTube 的倍率按鈕用於開啟設定。

快捷鍵會避開輸入與互動元素；非 Bilibili 頁面在加速時仍可能影響 Tab 導覽。播放器若持續重設倍率，最多校正三次後停止重試，需明確重新選擇倍率才會再嘗試。

### 預設開關

以下是新設定的預設值；既有安裝會保留已儲存的選擇。

| 功能 | 預設 |
| --- | --- |
| YouTube SponsorBlock | 開啟 |
| 原生廣告略過、廣告靜音 | 開啟，可分別關閉 |
| YouTube 續播、實驗性播放清單上次影片跳轉 | 關閉 |
| SponsorBlock 片段標記、靜態廣告隱藏 | 關閉 |
| Bilibili SponsorBlock | 停用，即使設定開啟也不會執行 |

續播會尊重網址的 `t`／`start` 時間、手動跳轉與已看完狀態。紀錄保留 90 天、最多約 2,000 筆，可在設定中清除。縮圖進度會隨同源分頁的儲存通知更新，不會改寫時間戳連結或跳動正在播放的影片。暫停、背景或返回舊分頁會對已觀察到的新進度退讓；但 localStorage 並非交易式鎖定，兩個活躍分頁同時寫入仍可能競爭。沒有跨瀏覽器、跨裝置或帳號同步；各已開啟分頁的設定開關仍各自保留。詳見[續播同步範圍與驗證](docs/RESUME_SYNC_20261104.md)。

## 支援範圍

下表描述目前原碼的功能範圍，**不代表已通過真站驗收**。

| 網站／頁面 | 目前範圍 |
| --- | --- |
| YouTube `www.youtube.com/watch`；桌面站內影片縮圖 | 播放頁倍速、續播、SponsorBlock、廣告輔助與共用操作；支援的縮圖顯示續播進度 |
| Bilibili `/video/BV…`、`/zh-Hant/video/BV…` | 實驗性倍速與共用操作；找不到已辨識的主影片就不控制 |
| Facebook／Instagram／Threads | 既有倍速與共用操作；不提供續播、SponsorBlock 或廣告輔助 |
| YouTube Music／手機版／外部嵌入頁 | 未納入匹配範圍 |
| Bilibili 番劇／直播／AV 路徑 | 不在支援範圍 |

Bilibili 尚無通過驗證的實際媒體 CID adapter，因此 SponsorBlock **不送請求、不跳段、不畫標記**。YouTube 同一播放器換片時，若無法確認網址與媒體已對齊，也會停止續播及 SponsorBlock，避免操作錯誤影片。

## 隱私與權限

- **本機資料**：設定與 YouTube 續播紀錄使用網站的 `localStorage`。續播鍵前綴為 `yt-speed-pro:resume:v1:`；同源網頁腳本可能讀取，不是私有或加密的 GM 儲存。既有 `yt-speed-pro:settings` 與 `yt-speed-pro:channels` 保留，不同網域不會同步。
- **外部連線**：YouTube SponsorBlock 向 `sponsor.ajay.app` 查詢影片 ID 的 SHA-256 前四碼，再核對回傳的完整 ID。服務仍可看到 IP 等連線資訊，雜湊前綴不等於匿名。沒有分析追蹤或外部帳號同步。
- **宣告權限**：唯一 grant 為 `GM_xmlhttpRequest`；`@connect` 包含 `sponsor.ajay.app` 與目前未使用的 `bsbsb.top`。沒有遠端 `@require`、遠端程式碼載入或 runtime npm 相依。

## 常見問題

**為什麼沒有自動續播？**  
預設未開啟，請先在 YouTube watch 頁面的設定開啟。網址指定時間、手動跳轉、已看完影片或無法確認目前媒體時，不會強行恢復舊位置。

**能完全擋住廣告嗎？**  
不能。略過與靜音只在 YouTube 明確進入廣告狀態時運作；靜態廣告隱藏另需開啟。不會快轉整段廣告到結尾、強制播放或任意移除彈窗，也不繞過登入、付費或 DRM。

**SponsorBlock 跳錯了怎麼辦？**  
使用提示中的返回按鈕，或在設定關閉該功能。社群片段可能缺漏或誤標；全片分類只顯示標籤，不會直接跳掉整部影片。

**截圖或子母畫面無法使用？**  
瀏覽器支援、使用者操作要求、跨來源限制與受保護影片都可能影響結果。請確認目前有可控制的主影片，並查看[已知限制](docs/KNOWN_ISSUES.md)。

## 回報與開發

請先查看[已知限制](docs/KNOWN_ISSUES.md)，再[建立 Issue](https://github.com/skydreamer0/speed-pro-userscript/issues/new/choose)，附上腳本、瀏覽器、管理器版本、頁面類型與重現步驟。移除帳號、私人影片連結、Cookie 和 token；安全漏洞請依 [SECURITY.md](SECURITY.md) 回報。

開發檢查需要 **Node.js 18 以上**，沒有 npm 相依套件：

```sh
npm test
npm run test:resume-negative
node scripts/repair-negative-test.mjs
```

`npm test` 執行語法、metadata／文件檢查及 52 組 production-function 合成 fixture（原 30 組加續播同步 22 組）；另外兩個指令分別檢查 7 個續播負控與 5 個既有防護負控。這些不等於瀏覽器、真站或管理器驗收。完整狀態見[測試說明](docs/TESTING.md)與[相容性紀錄](docs/COMPATIBILITY_20261102.md)。

[貢獻指南](CONTRIBUTING.md) · [變更紀錄](CHANGELOG.md) · [產品方向](docs/PRODUCT_DIRECTION.md) · [整合規格](docs/PLAYBACK_SUITE_2.0_SPEC.md)

## 授權與致謝

本專案程式碼採用 [MIT License](LICENSE)。SponsorBlock 社群資料依其 [API／資料條款](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License)使用，授權為 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)，另有明確許可者除外；不因本專案採 MIT 而變更。其擴充程式的 GPL 授權與 API／資料條款不同，本腳本未載入該擴充程式。

設計參考與來源待查項目見[來源紀錄](docs/PROVENANCE.md)及[第三方通知](docs/THIRD_PARTY_NOTICES.md)。商業整合或資料再散布須另核適用條件；開源授權與致謝不代表各平台允許所有使用方式。
