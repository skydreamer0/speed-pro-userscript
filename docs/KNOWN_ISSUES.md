# Playback Suite 2.0 candidate — Known issues

- **Draft only**: no release, real YouTube/Bilibili/Tampermonkey/FB/IG/Threads acceptance or independent code/security review. GitHub CI runs 16 synthetic groups, NOT full browser tests.
- YouTube resume uses site-readable **localStorage**, not GM private storage. Cross-tab writes are last-write-wins and not transactional; original Auto-Resume's live thumbnail bar sync is not implemented. Not full feature parity.
- Bilibili sponsor skipping requires matching BV + per-page CID from window.__INITIAL_STATE__, which may be hidden in a userscript manager sandbox or changed by Bilibili. Fail closed, don't claim unconditional working support.
- New static ad CSS is opt-in and conservative. Does not seek to duration, force play or remove anti-adblock/consent dialogs; cannot guarantee an ad-free player.
- SponsorBlock's SHA-256 prefix reduces exposed ID specificity but does not make network access anonymous; Bilibili new host permission is bsbsb.top. Data may be incomplete or incorrect.
- Metadata @name rebrand with unchanged @namespace/raw URL might still be recognized as a new script by some managers. Verify no duplicate enabled installs before user migration. GitHub repo slug is unchanged.
- New settings flags default OFF; users who only update a Draft branch do not gain production availability. Full-site match extension to YouTube Music/mobile/embed remains out of scope.

Original 1.2.0 candidate notes (historical) follow.

---

# 已知限制 — 1.2.0 候選

- 尚未做真實 Bilibili／既有四站＋Tampermonkey 驗收。合成 fixture 不能證明真站 DOM、影片傳輸或 manager sandbox 相容。
- Chromium fixture 腳本已備，但作者執行環境在瀏覽器啟動前因 socket sandbox 及 escalation wrapper 錯誤受阻；不是已通過瀏覽器測試。
- Bilibili 僅普通 `/video/*` 的已辨識 bpx／legacy 主影片容器；未知 DOM 不控制。bangumi、live、embed、App 不支援宣稱。
- 原生 ArrowRight 長按等功能可能改速並令 Speed Pro 鎖速預算耗盡。腳本最多校正 3 次後退讓；重新明確選倍率可重試。沒有修改原生按鍵或私有 API。
- 同一 video 換來源保留已耗用校正預算；不把媒體事件當成無限續試機制。讀回速度不是長期播放成功保證。
- 影片載入時機會影響可觀察到的基準速度，腳本只能還原它實際記錄的值，不知道平台未暴露的預期值。
- 既有四站依可見幾何評分仍可能誤選；未加入通用 shadow/frame 支援。
- PiP、全螢幕、截圖受瀏覽器、使用者啟動、跨來源與保護政策限制；未做真站驗收。
- 非 Bilibili 站點仍在加速時使用 Tab 鎖定快捷鍵；輸入與互動元素會避開，但普通頁面 Tab 導覽可能受影響。
- main 未合併候選前不提供 1.2.0 自動更新；舊安裝的來源/override 需個別核對。

VM 合成驗證通過：長按取消／換播放器原速、同節點換源基準保護、有限校正及輸入 guard 函式。非 YouTube reset-channel null listener、設定重設欄位同步已修改程式，但 VM 測試 stub 了 UI，完整面板／真實事件綁定的 browser 驗收仍為 BLOCKED，不能視為已驗證。
