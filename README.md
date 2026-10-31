# Speed Pro

影片倍速 Userscript：YouTube、Facebook、Instagram、Threads，加上 **Bilibili 普通影片頁實驗性適配**。

**1.2.0 候選版 · MIT · 無建置步驟**

> 這是開發分支候選版。未合併到 main 前，正式安裝／自動更新來源仍是 main 上的版本。Node 合成測試不是 Bilibili 真站或 Tampermonkey 驗收；瀏覽器 fixture 在目前執行環境啟動受阻，詳見 [測試紀錄](docs/TESTING.md)。

## 本次改動

- 新增 `www.bilibili.com/video/*`：主播放器限定選片、分 P／SPA／播放器替換與 media reload 生命週期處理。
- Bilibili 不攔截 Tab、Enter、方向鍵、Space、F、Esc，保留網站原生操作；用浮動倍率按鈕鎖定。
- 每個 video 保存自身原速；長按失焦、隱藏、切換媒體時恢復，短暫加速不帶到下一片。鎖定可延續到新播放器，舊片恢復自身原速。
- 播放器重設倍率時最多校正 3 次；仍衝突便退讓，顯示實際倍率，需明確重新選倍率才重試。媒體事件與 watchdog 不會補充預算。
- 修復非 YouTube 設定面板 `null.addEventListener`；重設時同步欄位與開關、恢復原速；儲存不可用不再阻止控制。

## 使用範圍

| 網站 | metadata 範圍 | 狀態 |
|---|---|---|
| Bilibili | `https://www.bilibili.com/video/*` | 實驗性；只找已辨識主播放器，找不到就不控制 |
| YouTube | `https://www.youtube.com/*` | 既有控制列、頻道記憶、SponsorBlock 與廣告輔助 |
| Facebook | HTTPS `www.facebook.com`、`facebook.com`、`m.facebook.com`、`web.facebook.com` 全路徑 | 既有浮動控制與多片評分 |
| Instagram | `https://www.instagram.com/*` | 既有浮動控制 |
| Threads | HTTPS `www.threads.com`、`www.threads.net` 全路徑 | 既有浮動控制 |

Bilibili 番劇、直播、embed、手機版、App **不在本次範圍**。已注入頁面 SPA 離開 `/video/` 時停止控制；從未匹配頁面直接 SPA 進入影片可能需要重新整理以讓管理器注入。沒有繞過登入、付費、DRM 或網站政策。

## 安裝與更新

1. 使用提供 `GM_xmlhttpRequest` 的 Userscript 管理器，例如 Tampermonkey。
2. 先讀 [原碼](speed-pro.user.js)、[隱私](#隱私)及[限制](docs/KNOWN_ISSUES.md)。
3. 正式入口：[main 的 Raw userscript](https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js)。**此候選版未合併時，該入口不是 1.2.0。**
4. 檢查管理器顯示版本與網站權限，再安裝或更新，不要同時啟用重複副本。

候選 metadata 的 `@updateURL`／`@downloadURL` 均指向上述 main Raw 路徑。舊腳本沒有這兩欄；既有安裝來源或管理器 override 可能影響更新，需要核對或手動更新一次。合併後也不能保證所有既有安裝立即自動更新。

## 快速操作

| 操作 | 效果 |
|---|---|
| 按住 Backquote（`） | 暫用設定倍率，預設 3×；放開還原該播放器原速 |
| Shift + Backquote | 暫用超速倍率，預設 5× |
| 浮動倍率按鈕 | 鎖定／解除；YouTube 按鈕改為開設定面板 |
| PageUp／PageDown | 加減預設 0.25× 並套用 |
| Alt + 1～5 | 設定並套用整數倍率 |
| Delete | 設定 3×，不是重設全部設定 |
| Alt + 滾輪 | 調整倍率 |
| Alt + S／Alt + P | 嘗試 PNG 截圖／PiP，受 API 與來源政策限制 |
| Tab | **Bilibili 保留原生**；其餘站點加速中切換鎖定 |
| Enter | **Bilibili 保留原生**；其餘站點嘗試全螢幕 |

輸入欄、彈幕、留言、可編輯區、ARIA 輸入與按鈕／連結不處理快捷鍵；IME、Ctrl／Meta、已被處理事件也略過。沒有可控制影片不攔截鍵盤或 Alt 滾輪。若在長按期間焦點移入輸入欄，放鍵仍會結束這次長按。

設定範圍 0.25×–16× 不代表瀏覽器接受全部倍率，高倍率可能無音訊。按鈕／面板顯示目前影片讀回的倍率；設定欄是請求值。預設倍率依各 origin 的 localStorage 保存，鎖定不跨重新整理保存。YouTube 額外有頻道倍率記憶；Bilibili 沒有頻道記憶或 SponsorBlock。

## 隱私

- Bilibili 與其他非 YouTube 站點不發出 SponsorBlock 請求；沒有新增 `@grant` 或 `@connect`，只新增窄範圍 Bilibili `@match`。
- YouTube SponsorBlock **預設開啟**，URL 有 `v` 參數且功能開啟時，向 `https://sponsor.ajay.app/api/skipSegments` 傳完整 YouTube 影片 ID 與分類。伺服器也收到一般連線資訊；程式未指定匿名模式。
- 如不願送出，首次使用前將 `DEFAULTS.sponsorBlock` 設為 false；既有 localStorage 會覆蓋預設，也可先在沒有 `v` 的 YouTube 頁面關閉設定。
- 本機設定 key 為 `yt-speed-pro:settings` 與 `yt-speed-pro:channels`；各來源分開保存，同源網頁可能讀寫，並非私有加密儲存。
- PNG 在瀏覽器下載，不上傳。廣告輔助只嘗試點擊 YouTube 已提供的略過按鈕／暫時靜音，不是廣告阻擋器。

## 開發

```sh
npm test
```

零套件相依，執行語法、metadata 與 production-function VM 合成測試。另有 `npm run test:browser`，需自行提供 Playwright 與 Chromium；參見 [測試說明](docs/TESTING.md)。

[規格及研究來源](SPEC.md) · [測試紀錄](docs/TESTING.md) · [已知限制](docs/KNOWN_ISSUES.md) · [變更](CHANGELOG.md) · [貢獻](CONTRIBUTING.md) · [安全](SECURITY.md) · [來源及授權](docs/PROVENANCE.md)
