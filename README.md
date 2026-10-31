# Speed Pro

**Control video speed without leaving the player.**

YouTube、Facebook、Instagram 與 Threads 的影片倍速 Userscript。按住快捷鍵暫時加速，或鎖定常用倍率；YouTube 另提供每頻道速度記憶、SponsorBlock 跳段與廣告輔助。

**版本 1.1.0 · [MIT](LICENSE) · 單檔 JavaScript，無建置步驟**

> [!WARNING]
> **本版保留原始功能程式碼，尚未完成真實網站與瀏覽器驗收。** Facebook／Instagram／Threads 設定面板首次開啟會因 `null.addEventListener` 初始化錯誤中斷；再次開啟也不會補齊遺漏的事件。請先閱讀[已知限制](#已知限制)，不要將下方「有實作」視為測試通過。

[安裝](#安裝) · [功能矩陣](#功能矩陣) · [快速上手](#快速上手) · [快捷鍵](#快捷鍵) · [設定與記憶](#設定與記憶) · [隱私與權限](#隱私與權限) · [開發與貢獻](#開發與貢獻)

## 功能重點

- **暫時加速與鎖定**：按住 Backquote 使用預設 3×，加上 Shift 使用預設 5×；放開恢復先前速度，也能鎖定持續播放。
- **細調與預設倍率**：設定範圍 0.25×–16×，步進預設 0.25×。面板提供 1×、1.5×、2×、2.5×、3×、4×。
- **配合網站的控制介面**：YouTube 使用播放器控制列；Facebook、Instagram、Threads 使用左下角浮動倍速按鈕。
- **速度記憶**：設定依網站來源儲存；YouTube 可依取得的頻道識別資訊記憶倍率。
- **YouTube 跳段與廣告輔助**：查詢 SponsorBlock 社群標記；嘗試點擊已出現的略過廣告按鈕，並在偵測到廣告時靜音。
- **播放工具**：畫中畫（PiP／子母畫面）、PNG 截圖、全螢幕。是否成功取決於瀏覽器 API、權限與影片來源。

0.25×–16× 是程式允許的設定範圍，不保證播放器接受每個倍率。Speed Pro 不是廣告攔截器，也不是 YouTube、Meta 或 SponsorBlock 的官方產品。

## 功能矩陣

**「有」表示原碼有對應分支，不表示已在真實網站驗收。** 四個平台目前皆未實測。

| 功能／介面 | YouTube | Facebook | Instagram | Threads |
| --- | --- | --- | --- | --- |
| 倍率調整、暫時加速、鎖定、快捷鍵 | 有 | 有，共用影片控制 | 有，共用影片控制 | 有，共用影片控制 |
| 主要按鈕 | 播放器控制列，點擊開設定 | 左下浮動按鈕，點擊切換鎖定 | 同 Facebook | 同 Facebook |
| 設定面板 | 有，未實測 | 有，**初始化有已知錯誤** | 同 Facebook | 同 Facebook |
| 當前影片選取 | 優先主播放器，再使用通用評分 | 播放狀態、可見面積、位置評分 | 同 Facebook | 同 Facebook |
| 網站來源內設定儲存 | 有 | 有 | 有 | 有 |
| 每頻道倍率記憶 | 有，須取得頻道識別 | 無 | 無 | 無 |
| SponsorBlock 社群跳段 | 有，須網址含 `v` 參數 | 無 | 無 | 無 |
| 廣告略過按鈕／廣告靜音 | 有，最佳努力 | 無 | 無 | 無 |
| PiP、PNG 截圖、全螢幕 | 有，受 API／權限限制 | 同左 | 同左 | 同左 |
| 真實網站功能驗收 | 未執行 | 未執行 | 未執行 | 未執行 |

通用影片選取會排除可見面積小於 100 px² 的候選影片，再依播放狀態、可見面積與距離視窗中心的位置評分。多支影片同時出現時，仍可能選錯目標。程式也監聽 DOM、播放、捲動和導航事件，搭配 800 ms 定時檢查，嘗試在換片後延續鎖定倍率；這不是無縫切換保證。

## 安裝

1. 先安裝 **Userscript 管理器**，例如 Tampermonkey 或 Violentmonkey。所選管理器須提供本腳本使用的 `GM_xmlhttpRequest` API；本專案尚未驗收任何瀏覽器／管理器組合。
2. 閱讀[隱私與權限](#隱私與權限)與[原始碼](speed-pro.user.js)。**SponsorBlock 預設開啟**，符合條件的 YouTube 頁面可能在載入時送出影片 ID。
3. 開啟 **[安裝 Speed Pro（Raw userscript）](https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js)**，確認管理器顯示的腳本名稱、版本與權限後安裝。
4. 若沒有出現安裝提示，在管理器建立新腳本，將 [speed-pro.user.js](speed-pro.user.js) **全部內容，包括頂端 metadata** 貼上、儲存並啟用。
5. 重新整理符合下方網址範圍的影片頁，先以一支影片測試。若出現快捷鍵衝突或播放異常，停用腳本後重新整理。


不需要執行 `npm install` 或建立帳號。腳本未宣告 `@updateURL`／`@downloadURL`，不要假設已建立自動更新管道；手動更新前請比對版本與差異，避免同時啟用多個副本。

### 匹配網址

腳本只在以下 HTTPS 主機的 `/*` 路徑載入：

| 平台 | 主機 |
| --- | --- |
| YouTube | `www.youtube.com` |
| Facebook | `www.facebook.com`、`facebook.com`、`m.facebook.com`、`web.facebook.com` |
| Instagram | `www.instagram.com` |
| Threads | `www.threads.com`、`www.threads.net` |

網域匹配不代表所有頁面、行動瀏覽器或裝置都能使用。原生 App 不在範圍內；`m.youtube.com` 與沒有 `www` 的 Instagram／Threads 網域也未列入 metadata。

## 快速上手

以下是依程式行為整理的操作範例，並非真實網站測試結果。

### 暫時快轉一段，接著恢復原速

1. 播放影片，讓焦點離開文字輸入區。
2. 按住 <code>`</code>（`Backquote`），使用設定倍率，初始為 3×。
3. 放開後恢復按下前記錄的速度。例如原本是 1.5×，就恢復 1.5×，不一定是 1×。

需要更快時，以 <code>Shift + `</code> 開始長按，使用超高速設定，初始為 5×。這是**鍵盤長按**，不是觸控長按影片的手勢。

### 固定使用 2×，之後再解除

- 按 `Alt + 2`，立即設定並套用 2×。若當下是待命狀態，會同時啟用鎖定。
- 已鎖定時按 `Tab` 解除，恢復記錄的基準速度。
- Facebook／Instagram／Threads 也可點左下方倍率按鈕切換鎖定；YouTube 的倍率按鈕則是開啟設定面板，從面板操作鎖定。

也能在按住加速時按 `Tab` 鎖定，再放開 Backquote。進入鎖定會改用一般設定倍率，**不會保留 Shift 超高速倍率**。

### 在 YouTube 設定常看的頻道倍率

保持「每頻道記憶」開啟，透過預設倍率、`Alt + 數字`、`PageUp`／`PageDown` 或 `Alt + 滾輪` 調整速度。取得頻道識別時，這些操作會記錄該頻道倍率。再次識別同一頻道時，程式讀回其設定。

**記住倍率不等於開頁即自動加速。** 重新整理後鎖定狀態不保留；需長按、鎖定或使用倍率快捷鍵才會套用。直接修改面板「預設加速倍率」數字欄位不會走同一條頻道記憶寫入流程。

## 快捷鍵

鍵位依 `KeyboardEvent.code` 判斷，實際操作會受鍵盤配置、作業系統與網站快捷鍵影響。

| 按鍵／操作 | 行為 |
| --- | --- |
| 按住 <code>`</code>（`Backquote`） | 未鎖定時，以設定倍率暫時加速；放開恢復基準速度 |
| 按住 <code>Shift + `</code> | 未鎖定時，以超高速倍率暫時加速 |
| `Tab` | **僅暫時加速中或已鎖定時**切換鎖定；待命時保留一般 Tab 行為 |
| `PageUp`／`PageDown` | 設定倍率增加／減少 `step`，預設 0.25×，並立即套用 |
| `Alt + 滾輪` | 向上增加、向下減少倍率；會攔截該次滾動 |
| `Alt + 1`～`Alt + 5` | 主鍵盤 `Digit1`～`Digit5`，設定並套用 1×～5×；不含數字鍵盤 |
| `Delete` | 設定並套用 3×，**不是重設所有設定** |
| `Alt + S` | 將目前影片畫面下載為 PNG，不是錄影 |
| `Alt + P` | 嘗試進入／離開 PiP |
| `Enter` | 有可控制影片，且焦點不在輸入區、按鈕、連結等互動元件時，切換全螢幕 |

倍率調整在待命時會啟用鎖定；若已在長按加速中，則不一定新建鎖定。面板預設按鈕含半倍速級距，與 `Alt + 1`～`5` 的整數倍率不同。

`keydown` 與 Alt 滾輪會避開文字輸入區、可編輯區及部分 ARIA 輸入元件；只有 Enter 額外避開按鈕、連結等互動元件。加速時 Tab 會被攔截，可能影響鍵盤焦點導覽。Backquote 的 `keyup` 與失焦處理另有[已知問題](docs/KNOWN_ISSUES.md)。

## 設定與記憶

YouTube 點擊播放器上的倍率按鈕開啟面板。其他網站的齒輪按鈕也有設定入口，但本版初始化有錯誤，不能視為完整可用。

| 設定 | 預設值 | UI 與行為 |
| --- | --- | --- |
| 一般加速倍率 `speed` | 3× | 面板數字欄位，0.25×–16×；已加速／鎖定時修改會套用 |
| 超高速倍率 `turboSpeed` | 5× | 面板數字欄位，0.25×–16×；供 Shift + Backquote 使用 |
| 步進 `step` | 0.25× | 用於 PageUp／PageDown／Alt 滾輪；**沒有面板設定項** |
| 每頻道記憶 `rememberChannel` | 開啟 | YouTube 專屬面板開關；需能取得頻道識別 |
| SponsorBlock `sponsorBlock` | 開啟 | YouTube 專屬總開關；沒有分類選擇器 |
| 自動略過廣告 `autoSkipAds` | 開啟 | YouTube 專屬；只嘗試點擊已提供的略過按鈕 |
| 廣告靜音 `muteAds` | 開啟 | YouTube 專屬；結束後恢復先前的 `muted` 狀態，不是音量數值 |
| 提示訊息 `showToasts` | 開啟 | 面板開關；部分錯誤／操作訊息會強制顯示 |
| `rememberGlobal` | `true` | 無 UI；**不是停止儲存設定的總開關** |
| `showControlButton` | `true` | 無 UI；控制建立按鈕的流程 |

只有程式設定、沒有 UI 的欄位，不應解讀為已有對應的偏好設定頁。面板中顯示的 3× 是加速設定，不一定代表影片當下正在以 3× 播放。

### 清除與重設

- **清除頻道速度**：刪除目前識別到的 YouTube 頻道記憶，不會清空全部頻道，也不會立即恢復播放器速度。
- **重設設定**：恢復預設設定並清空所有頻道記憶。現有數字欄位／開關未完整同步，鎖定及當前速度也不會明確重設；詳見[已知問題](docs/KNOWN_ISSUES.md)。
- **解除鎖定**：恢復程式記錄的基準速度。若已換到另一個 `<video>`，基準值來自新影片，不一定是最初那支影片的倍率。

## YouTube 跳段與廣告輔助

### SponsorBlock

預設查詢八種社群分類：贊助（`sponsor`）、自我宣傳（`selfpromo`）、互動提醒（`interaction`）、片頭（`intro`）、片尾（`outro`）、預告（`preview`）、非音樂內容（`music_offtopic`）與填充內容（`filler`）。

取得區段後，程式在播放進入區段時跳到結尾，並顯示分類與略過秒數。提示中的「返回」可回到先前位置，但**不是永久略過該標記的排除開關**，後續仍可能再次跳段。關閉一般提示時，也不會顯示這個返回按鈕。

目前影片 ID 僅取自網址 `v` 參數，因此一般 Shorts／embed 路徑不在這套查詢流程的涵蓋範圍。沒有社群標記、API 失敗或逾時時，不會取得可用跳段資料。

### 廣告輔助

程式依 YouTube 播放器的 `ad-showing` class 判斷廣告，再嘗試點擊已存在且未停用的略過按鈕；若開啟廣告靜音，則暫時設定 `video.muted = true`，結束後恢復先前的靜音狀態。

這是依 DOM 的最佳努力輔助，**不阻擋廣告請求、不繞過不可略過廣告，也不保證每則廣告都能處理**。網站改版可能使偵測或按鈕選擇器失效。

## 隱私與權限

### 外部請求

`@grant GM_xmlhttpRequest` 與 `@connect sponsor.ajay.app` 用於查詢：

```text
https://sponsor.ajay.app/api/skipSegments?videoID=…&categories=…
```

請求含**完整 YouTube 影片 ID**及分類清單，不是雜湊前綴查詢。伺服器也會收到一般網路連線資訊，例如來源 IP。原碼未指定匿名模式，因此不能保證管理器不附帶 Cookie 或其他請求中繼資料。

SponsorBlock 預設開啟，首次載入符合條件的影片頁就可能送出請求。若不希望送出，請在首次啟用前將原碼 `DEFAULTS.sponsorBlock` 改為 `false`；既有儲存值仍可能覆蓋預設值。

### 本機儲存與截圖

設定存在各網站來源的 `localStorage`，不是 Userscript 管理器的私有儲存空間：

| Key | 內容 |
| --- | --- |
| `yt-speed-pro:settings` | 倍率、功能開關、分類等設定 |
| `yt-speed-pro:channels` | 頻道路徑／識別值及對應倍率 |

不同主機不會自動同步；同來源的網頁程式可能讀取或修改這些資料。停用或移除腳本通常不會刪除資料；需要時可在瀏覽器網站儲存工具只移除上述 key。清除整個網站資料可能同時登出其他服務。

PNG 截圖在瀏覽器產生並下載，原碼沒有上傳截圖的流程。檢閱中未見分析追蹤 SDK、帳號登入、API 金鑰或額外遙測端點；這不等同完整安全稽核，也不涵蓋網站、管理器與 SponsorBlock 的資料處理。

## 已知限制

- **非 YouTube 面板初始化錯誤**：程式先移除「清除頻道速度」按鈕，卻繼續對查詢結果綁定事件，造成 `TypeError`。第一次開啟中斷；第二次可能顯示已建立的面板，但「重設設定」與點擊外部關閉事件不會補回。此版尚未修復。
- **未完成真站驗收**：YouTube、Facebook、Instagram、Threads，以及 Chromium／Firefox／Safari、各 Userscript 管理器和行動裝置均未驗收。不能由網域匹配或響應式 CSS 推定支援。
- **平台與權限限制**：倍率、PiP、全螢幕與截圖可能被瀏覽器／網站拒絕。跨來源 canvas 可能無法匯出 PNG。
- **鍵盤與換片邊界**：失去焦點時可能漏接放鍵事件；多影片選取、SPA 導航、廣告途中換片與鎖定恢復仍需測試。
- **設定與跳段邊界**：儲存寫入沒有例外保護；SponsorBlock 區段驗證與請求競態、重設設定 UI 同步仍有待改善。

完整項目與可重現方向見 [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)，測試範圍見 [TESTING.md](docs/TESTING.md)。

## 開發與貢獻

主程式為單一 [speed-pro.user.js](speed-pro.user.js)，沒有建置步驟或 npm 相依套件。靜態檢查需要 Node.js 18 以上：

```sh
git clone https://github.com/skydreamer0/speed-pro-userscript.git
cd speed-pro-userscript
npm test
```

`npm test` 執行 JavaScript 語法、metadata、版本、權限白名單、LF 換行、必要文件及零相依檢查；不會自動比對原始附件的雜湊。**此命令不會執行 Userscript，也不連線影片網站或 SponsorBlock**；通過不代表平台功能可用。

回報問題時，請附上平台與頁面類型、瀏覽器／管理器版本、操作步驟、預期與實際結果，並先移除 Cookie、帳號資料和私人網址。歡迎補充最小重現案例、隔離測試與真實環境測試紀錄；請勿把未測試的平台標示為已支援。

- [貢獻指南](CONTRIBUTING.md)
- [安全回報](SECURITY.md)
- [版本記錄](CHANGELOG.md)
- [來源與整理記錄](docs/PROVENANCE.md)

## 授權

[MIT License](LICENSE) © 2026 George (skydreamer0)。提交貢獻前，請確認你有權以 MIT 授權提供相關程式碼與文件。
