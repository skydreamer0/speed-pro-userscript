# Speed Pro

跨 YouTube、Facebook、Instagram 與 Threads 的影片倍速 Userscript。以快捷鍵切換播放速度，搭配 YouTube 控制列或社群網站的浮動按鈕。

**目前版本：1.1.0 · MIT 授權 · 尚未完成瀏覽器／平台實測**

> 此版本保留原始功能程式碼，已有[已知問題](docs/KNOWN_ISSUES.md)，包括非 YouTube 設定面板首次開啟時的錯誤。本專案採 [MIT 授權](LICENSE)，來源與整理記錄見 [授權與來源](docs/PROVENANCE.md)。

## 功能

| 功能 | 原碼實作範圍與限制 |
| --- | --- |
| 倍速與鎖定 | 設定範圍 0.25×–16×，瀏覽器與播放器不一定接受全範圍；預設加速 3×、超高速 5× |
| 暫時加速 | 按住 Backquote 加速，放開時恢復先前速度；鎖定時不適用 |
| 控制介面 | YouTube 播放器控制列；其他站點左下方浮動倍速按鈕與設定按鈕 |
| 影片選取 | 依播放狀態、可見面積與位置選擇影片，不保證多影片頁面一定選中預期目標 |
| 速度記憶 | 各網站來源分開保存設定；YouTube 另依可取得的頻道識別資訊記憶倍率。重新整理後不會自動恢復「鎖定」狀態 |
| SponsorBlock | 僅 YouTube，預設開啟；依社群標記跳段，不是廣告攔截器 |
| 廣告輔助 | 僅 YouTube，預設自動點擊已出現的略過按鈕並在偵測到廣告時靜音。不是阻擋廣告請求，也不保證每則廣告都能跳過 |
| 播放工具 | 子母畫面、PNG 畫面截圖與全螢幕；取決於瀏覽器 API、頁面政策及跨來源限制 |

本專案不是 YouTube、Meta 或 SponsorBlock 的官方產品，也不表示與其有合作或背書。

## 安裝

1. 使用支援 Userscript 的瀏覽器與管理器。管理器需要提供同步命名的 `GM_xmlhttpRequest` API；目前沒有任何瀏覽器／管理器組合完成本專案驗收。
2. 閱讀本頁的隱私說明、[已知問題](docs/KNOWN_ISSUES.md)，並檢查 [speed-pro.user.js](speed-pro.user.js) 原碼。
3. 在管理器建立新腳本，完整貼上 `speed-pro.user.js` 的內容（包含頂端 metadata），儲存並啟用。若從 GitHub 檢視檔案，可用 **Raw** 取得純文字；是否直接出現安裝提示取決於管理器。
4. 在下列匹配網址開啟或重新整理影片頁。YouTube 使用播放器內的倍速按鈕；其他網站使用左下角浮動按鈕。
5. 先以單一影片測試快捷鍵。若發生衝突或播放異常，停用腳本後重新整理頁面。

腳本沒有宣告 `@updateURL` 或 `@downloadURL`；不要假設已建立自動更新管道。手動更新前請檢查版本與差異，不要同時啟用多個副本。

### 網址範圍

Metadata 僅匹配 HTTPS 的以下主機，路徑為 `/*`：

- `www.youtube.com`
- `www.facebook.com`、`facebook.com`、`m.facebook.com`、`web.facebook.com`
- `www.instagram.com`
- `www.threads.com`、`www.threads.net`

匹配網域只代表腳本會被載入，不代表所有頁面或行動裝置都能使用；原生 App 不在範圍內。YouTube 的 SponsorBlock 影片 ID 目前只從網址 `v` 參數取得，未涵蓋一般 Shorts／embed 路徑。

## 快捷鍵

以下依原碼的 `KeyboardEvent.code` 說明，鍵盤配置與系統快捷鍵可能影響實際操作。文字輸入區、可編輯區與部分 ARIA 輸入元件會略過 `keydown` 處理；不是所有快捷鍵都避開按鈕或連結。

| 操作 | 行為 |
| --- | --- |
| 按住 <code>`</code>（`Backquote`） | 未鎖定時，暫用設定倍率，預設 3×；放開恢復原速 |
| 按住 <code>Shift + `</code> | 未鎖定時，暫用超高速倍率，預設 5× |
| `Tab` | **僅暫時加速中或已鎖定時**切換鎖定；進入鎖定會改用一般設定倍率，不是保留超高速倍率 |
| `PageUp` / `PageDown` | 設定倍率增減 `step`（預設 0.25×）並套用 |
| `Alt + 滾輪` | 向上增加、向下減少設定倍率，預設每次 0.25×；會攔截該次滾動 |
| `Alt + 1`～`Alt + 5` | 主鍵盤 `Digit1`～`Digit5`，設定並套用 1×～5×；不是數字鍵盤 |
| `Delete` | 設定並套用 3×，不是重設全部設定 |
| `Alt + S` | 將目前影片畫面下載為 PNG，不是錄影 |
| `Alt + P` | 嘗試進入／離開子母畫面 |
| `Enter` | 有可控制影片且焦點不在輸入區、按鈕、連結等互動元件時，切換全螢幕 |

倍率快捷鍵在待命時會啟用鎖定；若正處於按住加速狀態，則不一定新建鎖定。面板預設按鈕為 1×、1.5×、2×、2.5×、3×、4×，與 `Alt + 1`～`5` 不同。解除鎖定會恢復記錄的基準速度；換影片後的基準速度來自新影片。

## 隱私與權限

- `@grant GM_xmlhttpRequest` 與 `@connect sponsor.ajay.app` 用於跨來源查詢 SponsorBlock。啟用時向 `https://sponsor.ajay.app/api/skipSegments` 發出 GET，查詢參數包含**完整 YouTube 影片 ID**及選取的分類清單；不是雜湊前綴查詢。伺服器也會收到一般網路連線資訊，例如來源 IP。程式未指定匿名模式，因此不能保證管理器不附帶 Cookie 或其他請求中繼資料。
- SponsorBlock **預設開啟**，首次載入符合條件的 YouTube 影片頁就可能發出請求。若不希望送出，請在首次啟用前把原碼 `DEFAULTS.sponsorBlock` 改為 `false`；若曾使用此腳本，既有儲存值會覆蓋預設值。也可先在不含 `v` 參數的 YouTube 頁面關閉設定後，再進入影片頁。
- 預設查詢分類：`sponsor`、`selfpromo`、`interaction`、`intro`、`outro`、`preview`、`music_offtopic`、`filler`。目前 UI 只有總開關，沒有分類選擇器。
- 設定存在網站來源的 `localStorage`：`yt-speed-pro:settings` 與 `yt-speed-pro:channels`。後者包含頻道路徑／頻道識別值與倍率。不同主機不會自動同步；這不是加密或 Userscript 私有儲存空間，同來源網頁程式可能讀取或修改。
- 截圖在瀏覽器產生並下載，原碼沒有將截圖上傳的流程。原碼未見分析追蹤 SDK、帳號登入、API 金鑰或額外遙測端點；這不等同完整安全稽核，也不涵蓋網站、管理器或 SponsorBlock 的資料處理。
- 停用或移除腳本通常不會清除網站 `localStorage`。需要移除設定時，可在瀏覽器網站儲存工具刪除上述兩個 key；清除整個網站資料可能同時登出其他服務。

## 相容性與已知限制

目前完成的是語法、metadata 與來源一致性檢查，**不是**四個平台的功能驗收。未在真實帳號、瀏覽器或手機執行此腳本。

| 項目 | 驗證狀態 |
| --- | --- |
| JavaScript 語法與 metadata | 可用 `npm test` 重跑靜態檢查 |
| YouTube / Facebook / Instagram / Threads | 未實測 |
| Chromium / Firefox / Safari 與各 Userscript 管理器 | 未實測 |
| 行動瀏覽器、PiP、截圖、全螢幕與無障礙操作 | 未實測 |

網站 DOM 改版、權限限制、鍵盤衝突、跨來源影片、背景分頁與多影片切換都可能影響功能。詳見[已知問題](docs/KNOWN_ISSUES.md)與[測試計畫](docs/TESTING.md)。

## 開發與貢獻

單一 JavaScript 檔，沒有建置步驟，也沒有 npm 相依套件。檢查需要 Node.js 18 以上：

```sh
npm test
```

此命令不執行 Userscript，也不連線到影片網站或 SponsorBlock。請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)、[安全回報方式](SECURITY.md)及 [CHANGELOG.md](CHANGELOG.md)。提交程式碼時，請確認你有權以 MIT 授權貢獻。
