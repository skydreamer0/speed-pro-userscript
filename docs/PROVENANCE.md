# 來源與授權狀態

## 2026-11-02 查核補充（目前狀態）

- 本次基底為 `503ab27737d0d925f3c35aef2309c9bf30406f2f`；新增 [第三方／資料 notices 與固定上游來源](THIRD_PARTY_NOTICES.md)。根目錄 LICENSE 不改；API／資料條款獨立於 MIT。
- `f0062fe20471c18047abfe043969b4b2b23f61a7` 是 1.1.0 原碼首次大量匯入；其 parent `ce2bda8ac9b1b129ac05164fe03747b738602bf0` 只有 README。以下附件 hash 是歷史紀錄，沒有更早寫作歷史或原附件即不能證明匯入前每段來源。仍待作者提供來源／版本／採用區塊，不捏造共同作者。
- 下列「原創實作／未複製」是當時實作者的來源聲明，不是完整相似性鑑定。本輪不將它升格成全原創或法律相容性已驗證。
- 2.0.0 YouTube 實際使用 SponsorBlock API／資料；Bilibili identity 固定 null，尚無連線或跳段。資料署名補到 userscript 註解及 YouTube 設定面板；現有廣告輔助／預設與權限不變。
- Greasy Fork 603328 的實際發行碼／頁面本輪未能讀回，比對 hash 與安裝／更新驗收仍待完成。Draft 分支的通知尚不等於既有已安裝版本已補齊。

## 匯入來源

作者提供的 Speed Pro 1.1.0 Userscript，2026-10-31 整理為專案。沒有附帶既有 Git 歷史、第三方來源清單或授權檔。

- 原始附件 SHA-256：`74659bd7b3b6a9069768b0862d9ffd161e04cb37419f09d8de2cb9177af162c9`
- 原始大小：50,986 bytes，1,462 行。
- 匯入檔案：`speed-pro.user.js`
- 匯入 SHA-256：`8827934b2c76f364a5bb1463dfd59d34aa09a8404b7e738e9ef3d6e109ed5f54`
- 轉換：CRLF 換行改為 LF；依作者明確同意新增 `@license MIT`。未變更執行邏輯、既有 metadata、註解或原始 namespace `george.youtube.speedpro`。

## 授權

作者於 2026-10-31 明確同意採用 MIT；專案附標準 [MIT LICENSE](../LICENSE)，著作權標示為 `2026 George (skydreamer0)`，並同步 metadata 與 package 宣告。

作者同意選用授權不等同完成第三方來源稽核。若日後發現既有第三方片段或其他授權要求，仍應確認權利並保留必要通知；不以本專案 MIT 宣告覆蓋他人的權利。

## 第三方服務與素材

此檔未宣告 `@require`、未夾帶 npm 套件或外部圖片／字型檔；樣式中的字型名稱是系統字型候選清單。原碼使用 SponsorBlock API，但沒有附上 SponsorBlock 程式庫。呼叫服務不表示 API 資料或服務本身由本專案授權，也不表示已完成其使用條件檢查。

本次僅檢查收到的檔案，無法證明沒有未標註的第三方片段。未發現明顯私鑰、API token、密碼、電子郵件、個人電話或私人端點；原 namespace 保留作者提供的 `george` 字串。這是有限範圍的人工與模式檢查，不是完整授權或安全稽核。

## 1.2.0 Bilibili candidate

原創實作，僅參考架構／相容性資訊，未搬入第三方程式片段：

- [Bilibili-Evolved player-agent](https://github.com/the1812/Bilibili-Evolved/tree/master/src/components/video/player-agent)：不同播放器分 adapter。
- [observer.ts](https://github.com/the1812/Bilibili-Evolved/blob/master/src/core/observer.ts)：路由與媒體識別是不同生命週期。
- [Bilibili-Evolved LICENCE.md](https://github.com/the1812/Bilibili-Evolved/blob/master/LICENCE.md)：MIT 敘述另帶再散布／支援渠道條件，沒有概括宣稱純 MIT。
- [h5player task configuration](https://github.com/xxxily/h5player/blob/master/src/h5player/h5PlayerTccInit.js)：站點與 live 分離、原生按鈕與彈幕焦點相容性思路；[原倉庫](https://github.com/xxxily/h5player) 標 GPL-3.0，沒有複製程式進 MIT 專案。
- [Bilibili-Evolved #5654](https://github.com/the1812/Bilibili-Evolved/discussions/5654)：原生長按方向鍵倍速的衝突風險，因此不劫持 Bilibili 方向鍵。

來源於 2026-10-31 查閱，不能替代真站版本驗收。詳見 SPEC.md。

## Playback Suite 2.0 candidate integration (2026-11-01)

User-provided references, checked as **design inputs** rather than vendored runtime code:

- ElectroKnight22 / YouTube Auto-Resume v2.8.1, MIT: https://greasyfork.org/scripts/526798-youtube-auto-resume . Reference for checkpoint, playlist identity and retention; no YouTube Helper API @require bundled or loaded.
- iamfugui / youtube-adb v6.21, MIT: https://github.com/iamfugui/youtube-adb . Reference for cosmetic ad selectors and ad detection; deliberately omits forced end-of-ad seek and arbitrary popup removal.
- hxueh / SponsorBlock Lite v1.2.0, LGPL-3.0-or-later: https://greasyfork.org/scripts/560869 . Reference for feature expectations, not copied source code. Do not mislabel its LGPL material as MIT.
- Public API descriptions: https://wiki.sponsor.ajay.app/w/API_Docs and https://github.com/hanydd/BilibiliSponsorBlock/wiki/API .

Implementation is original adaptations to existing project structure, with feature gates and bounded validation. API/database licenses and site terms remain independent of the repository's MIT declaration. Independent licensing review and real-site testing are NOT RUN; do not claim verified legal or behavioral equivalence with upstream.
