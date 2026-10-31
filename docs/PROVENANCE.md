# 來源與授權狀態

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
