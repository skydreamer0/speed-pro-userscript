# 從功能拼裝到可靠的 Playback Suite
2026-11-02；產品建議，不代表以下工作已實作或獲准合併／發布。Remix 先理解為產品重整，不擅自指定 Remix framework、MV3 或全面改寫。

## 先確定要贏在哪裡
倍速、續播、跳段、廣告輔助都已有專案提供。現有 [h5player](https://github.com/xxxily/h5player)偏跨站播放工具；[Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved)偏 Bilibili 模組生態；[YouTube Auto-Resume](https://greasyfork.org/en/scripts/526798-youtube-auto-resume/code)有更完整的續播／縮圖流程；[SponsorBlock](https://github.com/ajayyy/SponsorBlock)與[BilibiliSponsorBlock](https://github.com/hanydd/BilibiliSponsorBlock)有社群標記／投稿生態。這是定位比較，不是效能或可靠性排名，亦未安裝競品做對照測試。

Playback Suite 值得發展的承諾是：**常用播放操作放在同一處，跨站盡量一致，遇到不確定狀態少打擾、不亂跳。** 現有單檔／無遠端 runtime 相依、共用 media coordinator、暫時倍速／鎖定與有限重試提供基礎；真站穩定度、一致性與升級仍欠證據。不能把「多合幾個功能」當成熟度，也不以「全原創、完全匿名、100% 無廣告」招攬。

## 優先做五件事
以下人日是單一開發者的粗估，不是交期承諾；真站可及性、不同瀏覽器與缺陷修復可能擴大成本。先驗收上一階段，再決定下一階段範圍。

| 順序／使用者可感改善 | 最小交付與驗收 | 粗估／代價 |
|---|---|---|
| 1. 播放不中斷、切片不失控 | 先鎖定 YouTube watch＋Bilibili普通／繁中兩個主旅程；實站跑換片／分 P／快速後退／廣告／手動 seek／hold 放開／重開面板；版本矩陣可重跑。未知 CID 繼續停用跳段；不以增加 selector 掩蓋問題 | 3–5 人日＋站點阻擋時間；需授權測試環境，不能承諾一次涵蓋全部平台 |
| 2. 設定「看得懂、找得到」 | 同一處區分「目前站點可用／目前關閉／暫不可用」；依實際倍率顯示狀態，快捷鍵可關閉並先檢查原生衝突。小視窗可滾動、鍵盤能開關／離開，不搶輸入與一般 Tab 導覽 | 2–4 人日；調整快捷鍵有習慣遷移成本，須保留兼容與說明 |
| 3. 自動化由使用者掌控 | speed／resume／sponsor／ad 各模組獨立設定、狀態與復原；明示外連／本機資料及現有預設。關閉不得留下新 request、timer、marker 或 mute；現有預設是否改 opt-in 需另決策，不能偷改 | 2–4 人日；需要所有權／清理 regression；不增帳號同步或 analytics |
| 4. 安裝、更新、回復是一條完整路徑 | 固定測過的發行 artifact，統一 metadata/version/notice；實測新裝、從 Speed Pro 更新、duplicate 偵測提示及備份／回復；穩定與候選通道不能只靠 main Raw 的名稱區分 | 2–3 人日；先確認管理器 identity 規則，repo 改名另案，不在本輪更換更新鏈 |
| 5. 使用久了也低打擾、好修 | 自願產生去個資診斷（版本、能力、錯誤分類，不含影片ID／觀看史），明確 bug 範本；100次 SPA 的 listeners/timers/DOM數量測量、停止功能可清理。將媒體控制與顯示逐步拆測，避免重寫整個框架 | 2–4 人日；多一份可維護的 fixture/測量契約，先本機不加遠端收集 |

## 先不要加的東西
AI 摘要、字幕／ASR、跨裝置同步、首頁重設計、投稿／投票、大規模濾鏡或 MV3 都會增加權限、成本與支援面。現在先完成上述播放／更新閉環；尤其 BilibiliSponsorBlock 不可為了功能表好看而繞過 CID 驗證。

## 對開源使用者的呈現
- 首頁只承諾已實測的平台／情境，給 30 秒可照做的操作例、已知限制與一鍵停用各模組的方法。
- Release notes 分「做了什麼／在哪裡測了／還沒測什麼」，示範畫面需從真正已驗證版本產生，不用 mock 圖當真站證據。
- 公開來源紀錄與資料邊界，尊重上游且不暗示官方背書；優先處理可重現 bug，不靠功能數量競賽。
- 衡量標準：代表旅程通過率、每次導航留下的資源、誤跳／快捷鍵衝突回報、升級保留設定是否成功。尚無基準值，不虛構百分比或「比競品更快」。

本輪已做的是來源通知、設定回歸與證據整理；上述產品改善仍是建議，請用[相容性矩陣](COMPATIBILITY_20261102.md)作下一步驗收入口。
