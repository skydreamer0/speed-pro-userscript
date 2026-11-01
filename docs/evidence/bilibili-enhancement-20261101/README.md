# Bilibili enhancement evidence

[規格](../../../SPEC-BILIBILI-ENHANCEMENT.md)。只包含文件與診斷，不包含新產品實作。

## 固定對象

- 被診斷版本：PR #8 `e46f05cb170ebbb534341ea84cce442a7e6c16cb`。
- userscript Git blob：`b8bc7d28403bce4fb13961583670b0dd5a0e09cb`。
- userscript SHA-256：`4474d2f7ddb840861248af0fc25acdec6db3b5a5ec1aa65e4af65608a9174ea1`。
- Runtime：Node v24.22.1；診斷要求 Node >=18。

此文件分支以 main 為底，沒有 #8 產品變更。不要直接把 main 的 userscript 傳入診斷；hash guard 會拒絕。這是精確歷史版本的缺口重現，不是通用測試或已修復驗收。

## 重跑（在 repo 根目錄）

先取得該精確 commit（若本地尚無）：

```sh
git fetch origin e46f05cb170ebbb534341ea84cce442a7e6c16cb
```

以下 Python 只將 Git blob 原樣輸出為暫存檔，呼叫診斷後自動清除；避免 PowerShell 舊版文字 redirect 改變編碼／行尾：

```python
import pathlib, subprocess, tempfile
with tempfile.TemporaryDirectory() as temp:
    source = pathlib.Path(temp) / 'speed-pro.user.js'
    source.write_bytes(subprocess.check_output([
        'git', 'show',
        'e46f05cb170ebbb534341ea84cce442a7e6c16cb:speed-pro.user.js'
    ]))
    subprocess.run([
        'node', 'docs/evidence/bilibili-enhancement-20261101/diagnose-gaps.mjs', str(source)
    ], check=True)
```

也可執行 `node docs/evidence/bilibili-enhancement-20261101/diagnose-gaps.mjs <原樣匯出檔案路徑>`。
腳本不下載／安裝程式、不開瀏覽器、不連網站、不寫設定；先驗 SHA，再在 Node VM 內執行固定原碼函式。

預期 exit 0、列出 G1/G2/G3，代表缺口／限制成功重現，**不代表功能通過**。輸入別的版本應 exit 非 0。G2 是身分證據不足，不是已重現真站誤跳。

## 既有 baseline 與限制

`STACK-TEST.log.txt` 是固定 #8 完整匯出快照上的 `npm test`：metadata 與 16 組 production-function fixtures PASS。要重跑 baseline，另取得固定 #8 的完整乾淨 checkout 執行 `npm test`；本文件分支的 main 程式與測試不同，不能代替。

`GAP-DIAGNOSTICS.log.txt` 來自本次帶參數、強制 hash 的診斷腳本重跑。

沒有真站／Tampermonkey驗收，沒有新獨立 review。無產品變更、無合併／部署；既有堆疊需各自完成審查。

## Checksum

從 repo 根目錄執行 `sha256sum -c docs/evidence/bilibili-enhancement-20261101/SHA256SUMS`。
清單含本 PR 其他六檔，不含自身以避免循環；不包含 repo 原有檔案。Git commit 固定清單本身。
