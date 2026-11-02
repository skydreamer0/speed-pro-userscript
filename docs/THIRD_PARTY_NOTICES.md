# 第三方來源、資料與授權通知
查核日：2026-11-02。這是來源紀錄及使用邊界，不是法律合規保證。程式碼仍依根目錄 [MIT LICENSE](../LICENSE)；不藉此重新授權第三方程式、資料、影片或商標。

## 正在使用的外部資料：YouTube SponsorBlock
本工具使用 [SponsorBlock 社群資料](https://sponsor.ajay.app/)。其官方 [API／資料授權](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License) 指向 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)；另外取得明確許可的情形除外。本專案沒有記錄任何特別授權。

- 資料依使用者類別設定篩選，顯示標記／分類或控制本機播放；不修改遠端資料庫、不投稿／投票、不捆綁完整資料庫。
- 標示資料來源與授權，不代表非商用、相同方式分享或其他適用條件可省略。商業整合、資料再散布、建立衍生資料庫或其他超出條款的使用，須先釐清條件／取得必要許可；這不是把整個 MIT 程式自動改成 CC 授權。
- 依官方 [attribution template](https://gist.github.com/ajayyy/4b27dfc66e33941a45aeaadccb51de71)，本分支在腳本註解與 YouTube 設定面板提供 SponsorBlock／授權連結。簡短模板也允許功能旁來源連結；模板不是一般性商業豁免。
- 官方 wiki [history](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License/_history) 指向最新修訂 `aec38630e67309f9a89f4e7d0563dbe2a49995ae`（2021-06-22）；該固定頁此次讀取 cache miss，因此內容查核依當日可讀的官方頁，不謊稱固定頁已成功取回。
- SponsorBlock **擴充程式原碼**另有 [GPL v3 license](https://github.com/ajayyy/SponsorBlock/blob/454c2d8545d52107de6edbc14e24a67af6c35fb3/LICENSE)，[README](https://github.com/ajayyy/SponsorBlock/blob/454c2d8545d52107de6edbc14e24a67af6c35fb3/README.md) 標示 v3 或更新版。本腳本呼叫 API，沒有載入該擴充套件；程式碼、API 和資料授權須分開檢查。

## 設計參考：不是打包依賴清單
以下記錄能證實的來源聲明與當日上游授權。沒有將「參考」當作「複製」；也不以作者自述或未找到同文推定整個專案已證明原創。若未來真正引入片段，須另記原檔、commit、採用行段、修改、完整通知和相容性判斷。

| 來源／固定版本 | 上游可查標示 | 本專案的紀錄與限制 |
|---|---|---|
| [Bilibili-Evolved LICENCE.md](https://github.com/the1812/Bilibili-Evolved/blob/12319cb19e84809ddc7742077e1f68e8fa1934e8/LICENCE.md) | MIT 敘述外另加轉散布／安裝入口或獨立支援條件 | adapter、route/media 分離概念。不能簡稱無附加條件的 MIT；本案不是其重新發布版 |
| [h5player LICENSE](https://github.com/xxxily/h5player/blob/e5a7d2b33b950e014f041ff74c44cb615392a3e5/LICENSE) | GPL v3 license 文字 | 站點例外與原生焦點相容性參考；未引入其 TCC/library，不把 GPL 實作貼進 MIT |
| [YouTube Auto-Resume](https://greasyfork.org/en/scripts/526798-youtube-auto-resume/code), ElectroKnight22，2.8.1 | metadata MIT | checkpoint／playlist／retention 設計參考；不載入它的 YouTube Helper API。公開頁本次可讀 2.8.1，但原 supplied attachment 尚未重取／hash 比對 |
| [youtube-adb index.user.js](https://github.com/iamfugui/youtube-adb/blob/ddceb665747980df3411e9081fda9286d53ccea5/index.user.js), iamfugui，6.21 | metadata MIT | 有共用的網站 ad/skip selectors；本案採可逆 CSS 與 native skip/mute，不移入強制結束廣告／移除 popup 的流程。selector 相同本身不能證實受保護表達被複製 |
| [SponsorBlock Lite](https://greasyfork.org/en/scripts/560869-sponsorblock-lite/code), hxueh | metadata LGPL-3.0-or-later | 歷史 supplied 版本記為 1.2.0；此次公開頁 cache 顯 1.1.1，不能宣稱已核實精確 1.2.0 全碼。作功能需求參考，歷史 PR 聲明未貼 LGPL 原碼 |
| [BilibiliSponsorBlock LICENSE](https://github.com/hanydd/BilibiliSponsorBlock/blob/4a5c756d24143c157ef5ebc353be40fae1512ad2/LICENSE) | GPL v3 license 文字 | 參考其 [API](https://github.com/hanydd/BilibiliSponsorBlock/wiki/API) schema；**目前停用**，保留 `@connect bsbsb.top` 不等於有請求。不得從 GPL 推定資料／API 的全部使用條件；重啟前另核服務／資料條款與 client headers |
| [BewlyBewly LICENSE](https://github.com/BewlyBewly/BewlyBewly/blob/d42143547bf4e9cc6864f227fcbcbd396bbff25b/LICENSE) | MIT | 只在 Bilibili enhancement SPEC 作 UI 研究，未引入其重設首頁功能 |
| [guobaren/BiliSummary LICENSE](https://github.com/guobaren/BiliSummary/blob/15fd23d0bba2e913512dfa81c07021fb0b89e935/LICENSE) | MIT | 字幕／摘要的未來需求研究；目前沒有 AI／字幕匯出 runtime。不與另一個 lxfater/BilibiliSummary 混用 |
| [zanmeidalao/bilibili-ai-summary](https://github.com/zanmeidalao/bilibili-ai-summary) | 本輪未確認授權，且仍非使用者唯一指認 | 只作「B站 AI 總結助手」候選識別，未引入、不捏造其允許條款 |

本案無 runtime npm dependencies、`@require`、外部圖片／字型資產。CSS 字型名稱不等於捆綁字型；使用者截取影片畫面的權利不由本程式 MIT 提供。上表不是逐行法證鑑定；最初 1.1.0 匯入之前的來源仍待作者補件，見 [PROVENANCE](PROVENANCE.md)。

## 法務／平台邊界（待具體情境審查）
- 臺灣[著作權法第 10-1 條](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=J0070017&flno=10-1)區分表達與概念；功能相似不直接等於侵權，但改名或重寫部分文字也不自動消除衍生問題。不能以「有署名」替代授權。
- [著作權法第 80-2 條](https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=J0070017)涉及防盜拷措施，是否適用要看實際措施與行為。本案不以開源授權取得繞過登入、付費或 DRM 的權利；也不把所有廣告處理一律定性為規避防盜拷。
- [YouTube 使用條款](https://www.youtube.com/static?template=terms)對服務干預、自動化存取等有獨立限制。本案有自動點原生略過、廣告靜音及選配 CSS 隱藏；較保守不表示平台允許。其他網站需分別查其適用條款，不能以 YouTube 或 MIT 推及全部平台。
- 如計畫商業化、散布第三方影片／字幕、加入資料匯出或改變廣告策略，先取得適用法域的專業意見與必要許可。當前查核不是無侵權或服務不封鎖的保證。
