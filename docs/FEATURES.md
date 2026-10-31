> 歷史文件：以下分析只描述 1.1.0 匯入基準，不代表 1.2.0 候選現況；請以 README、SPEC 與測試紀錄為準。

# Speed Pro 1.1.0 功能分析與 README 編輯報告

## 結論

Speed Pro 是跨四個網站的 HTML `<video>` 倍速控制 Userscript，核心是暫時加速／鎖定狀態機、影片選取、鍵盤與浮動 UI。YouTube 才有每頻道記憶、SponsorBlock 和廣告輔助。Facebook、Instagram、Threads 共用非 YouTube 分支，並非三套獨立驗收的播放器整合。

功能說明見 [README](../README.md)。本報告依原始碼靜態分析整理，未修改 runtime，也未操作真實帳號。

**阻礙完整功能宣稱的首要問題**：非 YouTube 面板先刪除頻道重設按鈕，再對 null 綁定事件；不能以「有設定面板程式」宣稱面板可正常使用。

## 審閱範圍與證據基準

- 原碼：[`speed-pro.user.js`](../speed-pro.user.js)，共 1,463 行，已完整閱讀（包含樣式與初始化）。
- 原碼 SHA-256：`8827934b2c76f364a5bb1463dfd59d34aa09a8404b7e738e9ef3d6e109ed5f54`。
- 原 README SHA-256：`4238e228342cb3aa075041ef311b14fe6087007fbe1dd2c5fb4b7c1c25f69e50`。
- 比對文件：原 README、`docs/KNOWN_ISSUES.md`、`package.json`、`LICENSE`。
- 下列行號全部相對於上述原碼，不對應改寫後 README。
- 方法：靜態逐項讀碼與文件比對。未執行瀏覽器、Userscript 或網站 API；未聲稱 Chrome、Safari、手機或任何平台功能通過。

## 功能證據清單

| 功能 | 程式依據 | 精確行為與文件處理 |
| --- | --- | --- |
| 版本與授權 | L5–6 | 1.1.0、MIT；與 package.json／LICENSE 一致，不添加星數或 build-pass 徽章 |
| 載入網站 | L8–18 | 8 個 HTTPS `@match`，document-idle；只有 www.youtube.com，沒有 m.youtube.com |
| 外部權限 | L16–17、L1110–1141 | GM_xmlhttpRequest，只宣告 sponsor.ajay.app；請求為完整 videoID，不是 hash prefix |
| 設定預設值 | L29–41 | speed 3、turbo 5、step 0.25；功能布林預設皆 true；分類共 8 種 |
| 來源內設定儲存 | L24–27、L43–46、L70–85 | localStorage；設定與頻道兩個 key；不是 GM 私有儲存，也不是跨站同步 |
| 倍率範圍 | L87–93、L167–177、L262–264 | round 到小數兩位，套用限制 0.25–16；播放例外會提示，不保證全範圍成功 |
| 影片選取 | L95–128 | YouTube 優先 video.html5-main-video；否則所有 video 依播放、可見比例／面積、中心距離評分；排除 visibleArea < 100 |
| 影片 ID | L130–138 | YouTube 只讀 v；其他站只解析 reel/reels 數字路徑；不能把 Shorts 宣稱為 SponsorBlock 完整支援 |
| YouTube 頻道識別 | L140–152 | 依 owner link href，再 fallback meta channelId；其他站回 null |
| 長按一般／超速 | L162–165、L196–220 | 沒有影片或已鎖定則不開始；初次按住記錄 baseRate；keyup 還原，超速是鍵盤 Shift 狀態，不是觸控手勢 |
| 鎖定與解除 | L222–245 | 進鎖定設 holdActive true、turbo false，用一般 settings.speed；解除還原 baseRate，不保證是 1× |
| 倍率快捷鍵立即生效 | L247–292 | adjustSpeed/setPreset 會儲存、寫頻道記憶、套用目前影片；待命時啟鎖定，長按中不一定啟鎖定 |
| 設定記憶與啟動狀態 | L51–54、L294–309 | locked 初始 false；頻道記憶覆寫 settings.speed，但只有 locked/holdActive 才套用影片，不能說載入就自動 3× |
| YouTube 控制列 | L659–683 | 在 .ytp-right-controls 前插按鈕；點擊 togglePanel，不是直接切鎖定 |
| 社群浮動按鈕 | L685–725 | 左下浮動倍率與齒輪；倍率 toggleLock，齒輪 togglePanel；找不到影片時隱藏 |
| 按鈕顯示倍率 | L727–739 | 顯示 effectiveSpeed 或 settings.speed，不是直接讀 video.playbackRate，故待命 3× 不等於正在 3× |
| 面板外觀 | L312–616、L790–846、L1003–1037 | 深色固定面板、狀態、preset、設定與工具；有窄視窗 CSS，不等於手機實測 |
| 面板倍率預設 | L853–862 | 1、1.5、2、2.5、3、4，不同於 Alt 數字的整數 1–5 |
| 面板一般倍率 | L864–875 | 數字 0.25–16、欄位 step 0.25；儲存一般設定；活動時套用，但不寫 channelSpeeds |
| 面板超速倍率 | L877–884 | 數字 0.25–16；更新設定與標籤，沒有立即 setVideoRate 呼叫 |
| 每頻道設定開關 | L886–893 | 有 UI；只有 YouTube 展示，且需要頻道識別 |
| 自動化開關 | L896–932 | SponsorBlock、略過廣告、廣告靜音、提示訊息；沒有分類選單 |
| 非 YouTube 面板錯誤 | L934–946 | L940 remove reset-channel，L946 未判空 addEventListener；導致初始化例外，後續 reset-all／outside-click 綁定不執行 |
| 清除頻道記憶 | L946–952 | 只刪 currentChannelKey 的紀錄；不變更現在倍率，不清空其他頻道 |
| 全部重設 | L954–962、L974–1001 | 重設 settings/channelSpeeds 並儲存；renderPanelValues 只更新文字／preset，不同步數字及 checkbox，也未明確重設鎖定／當前速度 |
| 面板開關 | L964–969、L1039–1056 | close、點外部關閉、定位；非 YouTube 錯誤使 outside-click 綁定缺失 |
| 提示訊息 | L618–657 | showToasts 可停用一般提示；force 例外仍顯示；支援 action 按鈕和自動淡出 |
| PiP | L1058–1071 | requestPictureInPicture／exitPictureInPicture，失敗顯示訊息；沒有 Safari 專屬 API 分支 |
| PNG 截圖 | L1073–1108 | canvas 依影片尺寸 drawImage，toBlob image/png，使用 object URL 下載後回收；不是影片下載或錄影 |
| 截圖命名 | L1095–1104 | youtube/social + currentVideoId 或 video + floor(currentTime)s.png；沒有上傳流程 |
| SponsorBlock 查詢 | L1110–1169 | GET，8 秒 timeout；只 YouTube + 開啟 + 有 v；失敗／非 2xx／404 清空區段 |
| SponsorBlock 分類 | L36、L1171–1183 | sponsor/selfpromo/interaction/intro/outro/preview/music_offtopic/filler；UI 只總開關 |
| 自動跳段 | L1185–1219、L1258–1262 | timeupdate 觸發，跳到 end + 0.03；顯示約略秒數與返回；返回沒有永久排除區段機制 |
| 廣告偵測與略過 | L1221–1245、L1452–1453 | YouTube #movie_player 的 ad-showing class；三個按鈕 selector 擇一，存在且未 disabled 就 click；800 ms 檢查 |
| 廣告靜音恢復 | L1230–1234、L1246–1249 | volumeBeforeAd 實際記錄 muted 布林，恢復的是靜音狀態，不是 volume |
| 換片與鎖速 | L1253–1293 | 綁定新 video 取得新 baseRate；ratechange 時嘗試重套 desired；導航 450 ms 後重抓資料 |
| 鍵盤輸入防護 | L154–160、L1295–1296、L1350–1355 | keydown 避開文字輸入；只有 Enter 再避開 button/link 等互動元件 |
| Alt 快捷鍵 | L1298–1315 | Digit1–5、KeyS、KeyP；不含 Numpad |
| Backquote／Tab | L1317–1331、L1395–1400 | Backquote 非 repeat 且未鎖定才開始；Tab 僅 hold/locked 時攔截；keyup 未檢查輸入目標或 holdActive |
| PageUp／PageDown／Delete | L1333–1348 | 步進設定 ±step；Delete 固定 setPreset(3)，不等於 reset-all |
| Enter 全螢幕 | L1350–1387 | 已全螢幕則離開；先找 YouTube 原生按鈕，否則依影片、父元素、dialog 順序嘗試 API |
| Alt 滾輪 | L1402–1407 | 非輸入區才攔截；deltaY < 0 增加，否則減少；passive false |
| 動態頁面刷新 | L1409–1453 | yt-navigate-finish、MutationObserver、play/playing/scroll；requestAnimationFrame 合併刷新；800 ms watchdog |
| 載入初始化 | L1455–1463 | 樣式、影片綁定、控制按鈕、導航流程；沒有登入或外部設定服務 |

## 相較原 README 的主要增補

1. **入口與閱讀導覽**：加上簡短英文 tagline、版本／MIT／單檔架構資訊，以及章節導覽。
2. **四站功能矩陣**：把 YouTube 專屬整合與三站共用分支分開，單列設定面板缺陷與「全部未實測」。原 README 只有一張功能概覽表。
3. **直接安裝入口**：明列 Userscript manager 名稱範例與 API 要求，提供 Raw URL 和手動貼上 fallback。Raw URL 已讀回確認；這不代表瀏覽器安裝流程已驗收。
4. **具體操作範例**：長按恢復、Alt+2 鎖定／Tab 解除、每頻道記憶三種情境，均標示來自讀碼而非真站驗收。
5. **設定表**：逐列預設值、UI 是否存在、YouTube 專屬範圍；避免讓 step、rememberGlobal、showControlButton 看起來都有面板開關。
6. **記憶語意釐清**：不自動恢復鎖定；記住倍率不等於開頁即加速；面板數字輸入與 preset／快捷鍵的頻道寫入流程不同。
7. **按鈕行為釐清**：YouTube 按鈕開面板，社群倍率按鈕直接切鎖定；待命顯示值不是影片即時播放倍率。
8. **播放工具與自動化展開**：SponsorBlock 分類、返回限制、API 失敗行為；廣告 muted 恢復而非音量；PNG 不是錄影。
9. **限制不藏在深層連結**：頁首醒目指出非 YouTube null 例外，保留完整已知問題連結，不把再次開啟描述成完整 workaround。
10. **開源專案結構**：安裝、使用、設定、隱私、限制、開發、貢獻、安全、版本、來源、MIT 各有入口；未添加未驗證的下載數／星數／CI 徽章。

## 驗證邊界

- 安裝來源為 `https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js`；發布時已讀回確認內容一致，基準 commit 為 `f0062fe20471c18047abfe043969b4b2b23f61a7`。
- 本報告的功能結論來自讀碼，不是瀏覽器安裝測試或真實網站驗收。
- 已知缺陷尚未在本次文件整理中修復。修復應另附回歸測試，並更新 [已知問題](KNOWN_ISSUES.md) 與 [測試計畫](TESTING.md)。
