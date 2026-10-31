# 參與開發

目前先保留 1.1.0 匯入基準，採用 [MIT 授權](LICENSE)。提交程式碼時請確認你有權以 MIT 授權貢獻；不要貼入不明來源、受限或含私人資料的程式碼。

## 回報問題

使用 bug report 範本，附上腳本版本、OS、瀏覽器／管理器版本、網站與頁面類型、最小重現步驟、預期與實際結果。請先查閱 [已知問題](docs/KNOWN_ISSUES.md)。移除截圖與日誌中的帳號、私人影片 ID、Cookie、token 和私人連結。

安全漏洞不要透過公開 Issue 回報細節，請閱讀 [SECURITY.md](SECURITY.md)。

## 修改與檢查

1. 以小範圍分支修改 `speed-pro.user.js`，避免把格式重排和功能變更混在同一 PR。
2. 先說明要修復的行為，補上適當回歸測試；沒有做過的瀏覽器測試明列「未測」。
3. 執行 `npm test`，依 [測試計畫](docs/TESTING.md) 記錄適用的手動結果。
4. 版本變更需同步 `@version`、`package.json`、README 與 CHANGELOG；metadata 權限擴張需解釋用途與隱私影響。
5. 開 Draft PR，列出變更、測試結果、已知限制與程式碼來源。不要加入憑證、真實帳號資料或生成的 `node_modules`。

目前沒有打包、npm 發布或部署流程。安裝入口就是儲存庫中的 `.user.js` 檔。
