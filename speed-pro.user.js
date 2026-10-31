// ==UserScript==
// @name         Speed Pro - YouTube / Facebook / Instagram / Threads
// @name:zh-TW   Speed Pro｜YouTube、FB Reels、IG 倍速工具
// @namespace    george.youtube.speedpro
// @version      1.1.0
// @license      MIT
// @description  跨平台影片倍速：FB/IG/Threads 浮動控制、YouTube 控制列、快捷鍵、SponsorBlock (YouTube)、PiP
// @match        https://www.youtube.com/*
// @match https://www.instagram.com/*
// @match        https://www.facebook.com/*
// @match        https://facebook.com/*
// @match        https://m.facebook.com/*
// @match        https://web.facebook.com/*
// @match https://www.threads.com/*
// @match https://www.threads.net/*
// @grant        GM_xmlhttpRequest
// @connect      sponsor.ajay.app
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const APP = 'yt-speed-pro';
    const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
    const STORAGE_KEY = `${APP}:settings`;
    const CHANNEL_KEY = `${APP}:channels`;

    const DEFAULTS = {
        speed: 3.0,
        turboSpeed: 5.0,
        step: 0.25,
        rememberGlobal: true,
        rememberChannel: true,
        sponsorBlock: true,
        sponsorCategories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic', 'filler'],
        autoSkipAds: true,
        muteAds: true,
        showToasts: true,
        showControlButton: true
    };

    let settings = loadJSON(STORAGE_KEY, DEFAULTS);
    settings = { ...DEFAULTS, ...settings };

    let channelSpeeds = loadJSON(CHANNEL_KEY, {});
    let currentVideo = null;
    let currentVideoId = null;
    let currentChannelKey = null;

    let holdActive = false;
    let locked = false;
    let turboActive = false;
    let baseRate = 1.0;

    let sponsorSegments = [];
    let sponsorFetchToken = 0;
    let lastSponsorSkip = null;

    let adWasMuted = false;
    let volumeBeforeAd = null;

    let controlButton = null;
    let floatControls = null;
    const boundVideos = new WeakSet();
    let panel = null;
    let toastRoot = null;
    let panelOpen = false;

    function loadJSON(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : structuredClone(fallback);
        } catch {
            return structuredClone(fallback);
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function saveChannelSpeeds() {
        localStorage.setItem(CHANNEL_KEY, JSON.stringify(channelSpeeds));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function roundRate(value) {
        return Math.round(value * 100) / 100;
    }

    function getVideo() {
        // Facebook/Instagram 的 feed 可以同時有多個 video；不能拿第一個。
        return (isYouTube && document.querySelector('video.html5-main-video')) || getActiveVideo();
    }

    function getActiveVideo() {
        const videos = [...document.querySelectorAll('video')];
        if (!videos.length) return null;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = vw / 2;
        const cy = vh / 2;

        const candidates = videos.map(video => {
            const rect = video.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
            const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
            const visibleArea = visibleWidth * visibleHeight;
            const ownArea = Math.max(1, rect.width * rect.height);
            const playing = !video.paused && !video.ended;
            const distance = Math.hypot(rect.left + rect.width / 2 - cx, rect.top + rect.height / 2 - cy);
            const normalizedDistance = distance / Math.max(1, Math.hypot(cx, cy));
            // 優先正在播放且顯示在視窗內的片；面積與中央位置負責排除背景影片。
            const score = (playing ? 10 : 0)
                + Math.min(1, visibleArea / ownArea) * 5
                + Math.min(1, visibleArea / Math.max(1, vw * vh)) * 5
                - normalizedDistance * 3;
            return { video, visibleArea, score };
        }).filter(item => item.visibleArea >= 100);

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0]?.video || null;
    }

    function getVideoId() {
        try {
            return isYouTube
                ? new URL(location.href).searchParams.get('v')
                : (location.pathname.match(/\/(?:reel|reels)\/(\d+)/)?.[1] || null);
        } catch {
            return null;
        }
    }

    function getChannelKey() {
        if (!isYouTube) return null;
        const ownerLink =
            document.querySelector('ytd-video-owner-renderer a.yt-simple-endpoint') ||
            document.querySelector('#owner a[href^="/@"]') ||
            document.querySelector('#owner a[href^="/channel/"]');

        const href = ownerLink?.getAttribute('href');
        if (href) return href;

        const metaChannel = document.querySelector('meta[itemprop="channelId"]')?.content;
        return metaChannel ? `channel:${metaChannel}` : null;
    }

    function isTypingTarget(target) {
        return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="searchbox"], [role="combobox"]') || target?.isContentEditable);
    }

    function isInteractiveTarget(target) {
        return isTypingTarget(target) || Boolean(target?.closest?.('button, a, [role="button"], [role="link"], [role="menuitem"], [role="option"]'));
    }

    function effectiveSpeed() {
        if (turboActive) return settings.turboSpeed;
        return settings.speed;
    }

    function setVideoRate(rate, { persist = false, toast = false } = {}) {
        const video = getVideo();
        if (!video) return;

        const next = clamp(roundRate(rate), 0.25, 16);
        try {
            video.playbackRate = next;
        } catch {
            showToast('此播放器目前不支援這個倍速', { force: true });
            return;
        }

        if (persist) {
            settings.speed = next;
            saveSettings();

            if (settings.rememberChannel && currentChannelKey) {
                channelSpeeds[currentChannelKey] = next;
                saveChannelSpeeds();
            }
        }

        updateControlUI();

        if (toast) {
            showToast(`播放速度 ${next.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}×`);
        }
    }

    function startHold(turbo = false) {
        const video = getVideo();
        if (!video || locked) return;

        if (!holdActive) {
            baseRate = video.playbackRate;
        }

        holdActive = true;
        turboActive = turbo;
        setVideoRate(effectiveSpeed());
        updateControlUI();
    }

    function stopHold() {
        if (locked) return;

        const video = getVideo();
        if (!video) return;

        holdActive = false;
        turboActive = false;
        video.playbackRate = baseRate;
        updateControlUI();
    }

    function toggleLock() {
        const video = getVideo();
        if (!video) {
            showToast('找不到可播放的影片，請先開啟 Reel 並播放', { force: true });
            return;
        }

        if (!locked) {
            if (!holdActive) baseRate = video.playbackRate;
            locked = true;
            holdActive = true;
            turboActive = false;
            setVideoRate(settings.speed);
            showToast(`已鎖定 ${settings.speed}×`);
        } else {
            locked = false;
            holdActive = false;
            turboActive = false;
            video.playbackRate = baseRate;
            showToast('已恢復原速');
        }
        updateControlUI();
        renderPanelValues();
    }

    // 快捷鍵、預設速度不只修改記憶值：現在會立即設定正在觀看的影片。
    function enableSpeedForCurrentVideo() {
        const video = getVideo();
        if (!video) {
            showToast('沒有可控制的影片', { force: true });
            return;
        }
        if (!locked && !holdActive) {
            baseRate = video.playbackRate;
            locked = true;
            holdActive = true;
        }
        setVideoRate(settings.speed);
    }

    function adjustSpeed(delta) {
        settings.speed = clamp(roundRate(settings.speed + delta), 0.25, 16);
        saveSettings();

        if (settings.rememberChannel && currentChannelKey) {
            channelSpeeds[currentChannelKey] = settings.speed;
            saveChannelSpeeds();
        }

        enableSpeedForCurrentVideo();

        showToast(`加速倍率 ${settings.speed}×`);
        updateControlUI();
        renderPanelValues();
    }

    function setPreset(rate) {
        settings.speed = rate;
        saveSettings();

        if (settings.rememberChannel && currentChannelKey) {
            channelSpeeds[currentChannelKey] = rate;
            saveChannelSpeeds();
        }

        enableSpeedForCurrentVideo();

        showToast(`加速倍率 ${rate}×`);
        updateControlUI();
        renderPanelValues();
    }

    function restoreRememberedSpeed() {
        if (!currentVideo) return;

        currentChannelKey = getChannelKey();

        if (settings.rememberChannel && currentChannelKey && channelSpeeds[currentChannelKey]) {
            settings.speed = channelSpeeds[currentChannelKey];
        }

        if (settings.rememberGlobal) {
            saveSettings();
        }

        if (locked || holdActive) setVideoRate(effectiveSpeed());
        updateControlUI();
        renderPanelValues();
    }

    function ensureStyles() {
        if (document.getElementById(`${APP}-style`)) return;

        const style = document.createElement('style');
        style.id = `${APP}-style`;
        style.textContent = `
            #${APP}-button {
                min-width: 48px;
                height: 40px;
                padding: 0 8px;
                border: 0;
                background: transparent;
                color: #fff;
                font: 600 13px/40px Roboto, Arial, sans-serif;
                cursor: pointer;
                opacity: .9;
                border-radius: 8px;
                transition: background .15s ease, opacity .15s ease, transform .15s ease;
            }
            #${APP}-button:hover {
                background: rgba(255,255,255,.12);
                opacity: 1;
            }
            #${APP}-button[data-locked="true"] {
                background: rgba(255,255,255,.18);
            }
            #${APP}-panel {
                position: fixed;
                z-index: 2147483646;
                width: min(360px, calc(100vw - 24px));
                max-height: min(620px, calc(100vh - 24px));
                overflow: auto;
                border-radius: 16px;
                background: rgba(22, 22, 22, .96);
                color: #fff;
                box-shadow: 0 18px 60px rgba(0,0,0,.42);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                border: 1px solid rgba(255,255,255,.10);
                padding: 14px;
                font-family: Roboto, Arial, sans-serif;
                display: none;
            }
            #${APP}-panel * {
                box-sizing: border-box;
            }
            .${APP}-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
            }
            .${APP}-title {
                font-size: 16px;
                font-weight: 700;
            }
            .${APP}-sub {
                margin-top: 3px;
                font-size: 12px;
                color: rgba(255,255,255,.58);
            }
            .${APP}-close {
                width: 32px;
                height: 32px;
                border: 0;
                border-radius: 9px;
                color: #fff;
                background: rgba(255,255,255,.08);
                cursor: pointer;
                font-size: 18px;
            }
            .${APP}-hero {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 10px;
                align-items: center;
                padding: 12px;
                border-radius: 13px;
                background: rgba(255,255,255,.065);
                margin-bottom: 10px;
            }
            .${APP}-rate {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: -1px;
            }
            .${APP}-lock {
                border: 0;
                border-radius: 10px;
                background: rgba(255,255,255,.10);
                color: #fff;
                padding: 9px 12px;
                cursor: pointer;
                font-weight: 600;
            }
            .${APP}-lock[data-active="true"] {
                background: #fff;
                color: #111;
            }
            .${APP}-presets {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 6px;
                margin-bottom: 12px;
            }
            .${APP}-preset {
                border: 0;
                border-radius: 9px;
                padding: 9px 4px;
                background: rgba(255,255,255,.08);
                color: #fff;
                cursor: pointer;
                font-size: 12px;
            }
            .${APP}-preset:hover,
            .${APP}-preset[data-active="true"] {
                background: rgba(255,255,255,.18);
            }
            .${APP}-section {
                margin-top: 12px;
            }
            .${APP}-section-title {
                margin: 0 0 7px;
                color: rgba(255,255,255,.56);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .08em;
            }
            .${APP}-row {
                display: flex;
                min-height: 42px;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 7px 2px;
                border-bottom: 1px solid rgba(255,255,255,.065);
            }
            .${APP}-row:last-child {
                border-bottom: 0;
            }
            .${APP}-label {
                min-width: 0;
            }
            .${APP}-label-main {
                font-size: 13px;
                font-weight: 600;
            }
            .${APP}-label-sub {
                margin-top: 3px;
                color: rgba(255,255,255,.48);
                font-size: 11px;
            }
            .${APP}-toggle {
                appearance: none;
                width: 40px;
                height: 23px;
                border-radius: 999px;
                background: rgba(255,255,255,.16);
                position: relative;
                cursor: pointer;
                flex: 0 0 auto;
                transition: background .18s ease;
            }
            .${APP}-toggle::after {
                content: "";
                position: absolute;
                width: 17px;
                height: 17px;
                top: 3px;
                left: 3px;
                border-radius: 50%;
                background: #fff;
                transition: transform .18s ease;
            }
            .${APP}-toggle:checked {
                background: #3ea6ff;
            }
            .${APP}-toggle:checked::after {
                transform: translateX(17px);
            }
            .${APP}-number {
                width: 66px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 9px;
                background: rgba(255,255,255,.07);
                color: #fff;
                padding: 7px 8px;
                text-align: center;
                outline: none;
            }
            .${APP}-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-top: 10px;
            }
            .${APP}-action {
                border: 0;
                border-radius: 10px;
                padding: 10px 9px;
                color: #fff;
                background: rgba(255,255,255,.085);
                cursor: pointer;
                font-weight: 600;
                font-size: 12px;
            }
            .${APP}-action:hover {
                background: rgba(255,255,255,.15);
            }
            #${APP}-toasts {
                position: fixed;
                z-index: 2147483647;
                left: 50%;
                top: 72px;
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                pointer-events: none;
                max-width: calc(100vw - 24px);
            }
            .${APP}-toast {
                pointer-events: auto;
                display: flex;
                gap: 10px;
                align-items: center;
                max-width: 520px;
                padding: 10px 13px;
                border-radius: 11px;
                background: rgba(20,20,20,.93);
                color: #fff;
                box-shadow: 0 10px 35px rgba(0,0,0,.3);
                font: 500 13px/1.35 Roboto, Arial, sans-serif;
                animation: ${APP}-in .18s ease-out;
            }
            .${APP}-toast button {
                border: 0;
                background: rgba(255,255,255,.12);
                color: #fff;
                border-radius: 8px;
                padding: 5px 8px;
                cursor: pointer;
                white-space: nowrap;
            }
            @keyframes ${APP}-in {
                from { opacity: 0; transform: translateY(-6px) scale(.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            #${APP}-float {
                position: fixed;
                left: 18px;
                bottom: 18px;
                z-index: 2147483645;
                display: flex;
                align-items: center;
                padding: 5px;
                gap: 3px;
                border-radius: 13px;
                background: rgba(22, 22, 22, .9);
                border: 1px solid rgba(255,255,255,.20);
                box-shadow: 0 8px 25px rgba(0,0,0,.25);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }
            #${APP}-float #${APP}-button {
                color: #fff;
                background: rgba(255,255,255,.13);
                height: 36px;
                line-height: 36px;
            }
            #${APP}-float #${APP}-button[data-locked="true"] {
                color: #111;
                background: #fff;
            }
            #${APP}-settings-button {
                border: 0;
                border-radius: 9px;
                width: 35px;
                height: 36px;
                background: transparent;
                color: #fff;
                cursor: pointer;
                font-size: 18px;
            }
            #${APP}-settings-button:hover { background: rgba(255,255,255,.14); }
            @media (max-width: 700px) {
                #${APP}-panel[data-site="social"] {
                    bottom: 76px !important;
                    max-height: calc(100vh - 96px);
                }

                #${APP}-panel {
                    left: 12px !important;
                    right: 12px !important;
                    bottom: 12px !important;
                    top: auto !important;
                    width: auto;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureToastRoot() {
        ensureStyles();
        if (!toastRoot) {
            toastRoot = document.createElement('div');
            toastRoot.id = `${APP}-toasts`;
            document.body.appendChild(toastRoot);
        }
    }

    function showToast(message, options = {}) {
        if (!settings.showToasts && !options.force) return;

        ensureToastRoot();

        const toast = document.createElement('div');
        toast.className = `${APP}-toast`;

        const text = document.createElement('span');
        text.textContent = message;
        toast.appendChild(text);

        if (options.actionText && typeof options.onAction === 'function') {
            const button = document.createElement('button');
            button.textContent = options.actionText;
            button.addEventListener('click', () => {
                options.onAction();
                toast.remove();
            });
            toast.appendChild(button);
        }

        toastRoot.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-4px)';
            toast.style.transition = 'opacity .18s ease, transform .18s ease';
            setTimeout(() => toast.remove(), 190);
        }, options.duration ?? 1600);
    }

    function ensureControlButton() {
        if (!settings.showControlButton || !document.body) return;

        if (isYouTube) {
            const controls = document.querySelector('.ytp-right-controls');
            if (!controls) return;
            const existing = document.getElementById(`${APP}-button`);
            if (existing && controls.contains(existing)) {
                controlButton = existing;
                return;
            }

            ensureStyles();
            controlButton = document.createElement('button');
            controlButton.id = `${APP}-button`;
            controlButton.type = 'button';
            controlButton.title = 'Speed Pro 設定';
            controlButton.addEventListener('click', event => {
                event.stopPropagation();
                togglePanel();
            });
            controls.prepend(controlButton);
            updateControlUI();
            return;
        }

        // FB / IG / Threads 沒有 YouTube 的 .ytp-right-controls。
        const existing = document.getElementById(`${APP}-float`);
        if (existing) {
            floatControls = existing;
            controlButton = existing.querySelector(`#${APP}-button`);
            updateControlUI();
            return;
        }

        ensureStyles();
        floatControls = document.createElement('div');
        floatControls.id = `${APP}-float`;
        floatControls.setAttribute('aria-label', '影片播放倍速控制');

        controlButton = document.createElement('button');
        controlButton.type = 'button';
        controlButton.id = `${APP}-button`;
        controlButton.title = '按一下鎖定／取消倍速';
        controlButton.addEventListener('click', event => {
            event.stopPropagation();
            toggleLock();
            controlButton.blur?.();
        });

        const settingButton = document.createElement('button');
        settingButton.type = 'button';
        settingButton.id = `${APP}-settings-button`;
        settingButton.textContent = '⚙';
        settingButton.title = '開啟 Speed Pro 設定';
        settingButton.setAttribute('aria-label', '開啟 Speed Pro 設定');
        settingButton.addEventListener('click', event => {
            event.stopPropagation();
            togglePanel();
            settingButton.blur?.();
        });

        floatControls.append(controlButton, settingButton);
        document.body.appendChild(floatControls);
        floatControls.style.display = getVideo() ? 'flex' : 'none';
        updateControlUI();
    }

    function updateControlUI() {
        if (!controlButton) return;

        const shownRate = locked || holdActive
            ? effectiveSpeed()
            : settings.speed;

        controlButton.textContent = `${shownRate.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}×`;
        controlButton.dataset.locked = String(locked);
        controlButton.title = locked
            ? `已鎖定 ${shownRate}×`
            : `加速倍率 ${settings.speed}×`;
    }

    function panelRow(title, subtitle, control) {
        const row = document.createElement('div');
        row.className = `${APP}-row`;

        const label = document.createElement('div');
        label.className = `${APP}-label`;

        const main = document.createElement('div');
        main.className = `${APP}-label-main`;
        main.textContent = title;

        label.appendChild(main);

        if (subtitle) {
            const sub = document.createElement('div');
            sub.className = `${APP}-label-sub`;
            sub.textContent = subtitle;
            label.appendChild(sub);
        }

        row.append(label, control);
        return row;
    }

    function makeToggle(checked, onChange) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = `${APP}-toggle`;
        input.checked = checked;
        input.addEventListener('change', () => onChange(input.checked));
        return input;
    }

    function makeNumber(value, min, max, step, onChange) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = `${APP}-number`;
        input.value = value;
        input.min = min;
        input.max = max;
        input.step = step;
        input.addEventListener('change', () => {
            const next = clamp(Number(input.value), min, max);
            input.value = next;
            onChange(next);
        });
        return input;
    }

    function ensurePanel() {
        if (panel) return panel;

        ensureStyles();

        panel = document.createElement('div');
        panel.id = `${APP}-panel`;
        panel.dataset.site = isYouTube ? 'youtube' : 'social';

        panel.innerHTML = `
            <div class="${APP}-header">
                <div>
                    <div class="${APP}-title">Speed Pro</div>
                    <div class="${APP}-sub">速度、跳段與播放工具</div>
                </div>
                <button class="${APP}-close" type="button">×</button>
            </div>

            <div class="${APP}-hero">
                <div>
                    <div class="${APP}-rate" data-role="rate">3×</div>
                    <div class="${APP}-sub" data-role="state">待命</div>
                </div>
                <button class="${APP}-lock" data-role="lock" type="button">鎖定</button>
            </div>

            <div class="${APP}-presets" data-role="presets"></div>

            <div class="${APP}-section">
                <div class="${APP}-section-title">速度</div>
                <div data-role="speed-settings"></div>
            </div>

            <div class="${APP}-section">
                <div class="${APP}-section-title">自動化</div>
                <div data-role="automation-settings"></div>
            </div>

            <div class="${APP}-section">
                <div class="${APP}-section-title">工具</div>
                <div class="${APP}-actions">
                    <button class="${APP}-action" data-action="screenshot">截圖 Alt+S</button>
                    <button class="${APP}-action" data-action="pip">子母畫面 Alt+P</button>
                    <button class="${APP}-action" data-action="reset-channel">清除頻道速度</button>
                    <button class="${APP}-action" data-action="reset-all">重設設定</button>
                </div>
            </div>

            <div class="${APP}-section">
                <div class="${APP}-section-title">快捷鍵</div>
                <div class="${APP}-sub" style="line-height:1.8">
                    <b>\`</b> 按住加速　<b>Shift+\`</b> 5×超速<br>
                    <b>Tab</b> 鎖定　<b>Alt+滾輪</b> ±0.25×<br>
                    <b>Alt+1～5</b> 快速設 1×～5×
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        panel.querySelector(`.${APP}-close`).addEventListener('click', closePanel);
        panel.querySelector('[data-role="lock"]').addEventListener('click', toggleLock);

        const presetWrap = panel.querySelector('[data-role="presets"]');
        [1, 1.5, 2, 2.5, 3, 4].forEach(rate => {
            const btn = document.createElement('button');
            btn.className = `${APP}-preset`;
            btn.type = 'button';
            btn.dataset.rate = rate;
            btn.textContent = `${rate}×`;
            btn.addEventListener('click', () => setPreset(rate));
            presetWrap.appendChild(btn);
        });

        const speedSettings = panel.querySelector('[data-role="speed-settings"]');
        speedSettings.append(
            panelRow(
                '預設加速倍率',
                '按住 ` 時使用',
                makeNumber(settings.speed, 0.25, 16, 0.25, value => {
                    settings.speed = value;
                    saveSettings();
                    if (locked || holdActive) setVideoRate(value);
                    updateControlUI();
                    renderPanelValues();
                })
            ),
            panelRow(
                '超高速倍率',
                'Shift + `',
                makeNumber(settings.turboSpeed, 0.25, 16, 0.25, value => {
                    settings.turboSpeed = value;
                    saveSettings();
                    renderPanelValues();
                })
            ),
            panelRow(
                '每頻道記憶',
                '同一頻道沿用上次倍率',
                makeToggle(settings.rememberChannel, value => {
                    settings.rememberChannel = value;
                    saveSettings();
                })
            )
        );

        const automationSettings = panel.querySelector('[data-role="automation-settings"]');
        automationSettings.append(
            panelRow(
                'SponsorBlock',
                '跳過贊助、片頭、片尾等社群標記',
                makeToggle(settings.sponsorBlock, value => {
                    settings.sponsorBlock = value;
                    saveSettings();
                    if (value) fetchSponsorSegments();
                    else sponsorSegments = [];
                })
            ),
            panelRow(
                '廣告可跳過時自動略過',
                '只點擊 YouTube 已提供的略過按鈕',
                makeToggle(settings.autoSkipAds, value => {
                    settings.autoSkipAds = value;
                    saveSettings();
                })
            ),
            panelRow(
                '廣告期間自動靜音',
                '廣告結束後恢復原音量',
                makeToggle(settings.muteAds, value => {
                    settings.muteAds = value;
                    saveSettings();
                })
            ),
            panelRow(
                '提示訊息',
                '顯示速度與跳段提示',
                makeToggle(settings.showToasts, value => {
                    settings.showToasts = value;
                    saveSettings();
                })
            )
        );

        if (!isYouTube) {
            // 跨站控制只展示真正支援的功能，避免 FB 顯示 YouTube 專屬設定。
            const youtubeOnly = ['每頻道記憶', 'SponsorBlock', '廣告可跳過時自動略過', '廣告期間自動靜音'];
            panel.querySelectorAll(`.${APP}-row`).forEach(row => {
                if (youtubeOnly.some(label => row.textContent.includes(label))) row.remove();
            });
            panel.querySelector('[data-action="reset-channel"]')?.remove();
        }

        panel.querySelector('[data-action="screenshot"]').addEventListener('click', takeScreenshot);
        panel.querySelector('[data-action="pip"]').addEventListener('click', togglePiP);

        panel.querySelector('[data-action="reset-channel"]').addEventListener('click', () => {
            if (currentChannelKey) {
                delete channelSpeeds[currentChannelKey];
                saveChannelSpeeds();
                showToast('已清除這個頻道的速度記憶', { force: true });
            }
        });

        panel.querySelector('[data-action="reset-all"]').addEventListener('click', () => {
            settings = structuredClone(DEFAULTS);
            channelSpeeds = {};
            saveSettings();
            saveChannelSpeeds();
            renderPanelValues();
            updateControlUI();
            showToast('設定已重設', { force: true });
        });

        document.addEventListener('mousedown', (event) => {
            if (!panelOpen) return;
            if (panel.contains(event.target)) return;
            if (controlButton?.contains(event.target)) return;
            closePanel();
        });

        return panel;
    }

    function renderPanelValues() {
        if (!panel) return;

        const rateEl = panel.querySelector('[data-role="rate"]');
        const stateEl = panel.querySelector('[data-role="state"]');
        const lockEl = panel.querySelector('[data-role="lock"]');

        const shown = locked || holdActive ? effectiveSpeed() : settings.speed;

        if (rateEl) rateEl.textContent = `${shown}×`;

        if (stateEl) {
            stateEl.textContent = locked
                ? '已鎖定'
                : holdActive
                    ? (turboActive ? '超高速中' : '暫時加速中')
                    : '待命';
        }

        if (lockEl) {
            lockEl.dataset.active = String(locked);
            lockEl.textContent = locked ? '解除' : '鎖定';
        }

        panel.querySelectorAll(`.${APP}-preset`).forEach(btn => {
            btn.dataset.active = String(Number(btn.dataset.rate) === Number(settings.speed));
        });
    }

    function positionPanel() {
        if (!panel || !controlButton) return;

        if (!isYouTube) {
            const rect = controlButton.getBoundingClientRect();
            panel.style.left = `${clamp(rect.left, 12, Math.max(12, innerWidth - 360 - 12))}px`;
            panel.style.right = 'auto';
            panel.style.bottom = `${Math.round(innerHeight - rect.top + 8)}px`;
            panel.style.top = 'auto';
            if (innerWidth <= 700) {
                panel.style.left = '12px';
                panel.style.right = '12px';
                panel.style.bottom = '76px';
            }
            return;
        }

        if (innerWidth <= 700) {
            panel.style.left = '12px';
            panel.style.right = '12px';
            panel.style.bottom = '12px';
            panel.style.top = 'auto';
            return;
        }

        const rect = controlButton.getBoundingClientRect();
        const width = 360;
        const left = clamp(rect.right - width, 12, innerWidth - width - 12);
        const top = clamp(rect.top - Math.min(600, innerHeight - 24) - 8, 12, innerHeight - 220);

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function togglePanel() {
        ensurePanel();
        panelOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        ensurePanel();
        positionPanel();
        renderPanelValues();
        panel.style.display = 'block';
        panelOpen = true;
    }

    function closePanel() {
        if (!panel) return;
        panel.style.display = 'none';
        panelOpen = false;
    }

    async function togglePiP() {
        const video = getVideo();
        if (!video) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch {
            showToast('這個瀏覽器目前無法進入子母畫面', { force: true });
        }
    }

    function takeScreenshot() {
        const video = getVideo();
        if (!video || !video.videoWidth || !video.videoHeight) {
            showToast('目前沒有可截取的影片畫面', { force: true });
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => {
                if (!blob) {
                    showToast('截圖失敗', { force: true });
                    return;
                }

                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                const time = Math.floor(video.currentTime);

                a.href = url;
                a.download = `${isYouTube ? 'youtube' : 'social'}-${currentVideoId || 'video'}-${time}s.png`;
                a.click();

                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showToast('已截圖');
            }, 'image/png');
        } catch {
            showToast('此影片受到瀏覽器跨來源限制，無法截圖', { force: true });
        }
    }

    function gmGet(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                timeout: 8000,
                onload: response => resolve(response),
                onerror: reject,
                ontimeout: reject
            });
        });
    }

    async function fetchSponsorSegments() {
        if (!isYouTube || !settings.sponsorBlock) {
            sponsorSegments = [];
            return;
        }

        const videoId = getVideoId();
        if (!videoId) {
            sponsorSegments = [];
            return;
        }

        const token = ++sponsorFetchToken;
        currentVideoId = videoId;

        try {
            const categories = encodeURIComponent(JSON.stringify(settings.sponsorCategories));
            const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${categories}`;
            const response = await gmGet(url);

            if (token !== sponsorFetchToken) return;

            if (response.status === 404) {
                sponsorSegments = [];
                return;
            }

            if (response.status < 200 || response.status >= 300) {
                sponsorSegments = [];
                return;
            }

            const data = JSON.parse(response.responseText);
            sponsorSegments = Array.isArray(data)
                ? data
                    .filter(item => Array.isArray(item.segment) && item.segment.length === 2)
                    .map(item => ({
                        start: Number(item.segment[0]),
                        end: Number(item.segment[1]),
                        category: item.category || 'segment',
                        uuid: item.UUID || ''
                    }))
                : [];
        } catch {
            sponsorSegments = [];
        }
    }

    function sponsorLabel(category) {
        const labels = {
            sponsor: '贊助',
            selfpromo: '自我宣傳',
            interaction: '互動提醒',
            intro: '片頭',
            outro: '片尾',
            preview: '預告',
            music_offtopic: '非音樂內容',
            filler: '填充內容'
        };
        return labels[category] || category;
    }

    function checkSponsorSkip() {
        if (!settings.sponsorBlock || !currentVideo || sponsorSegments.length === 0) return;

        const t = currentVideo.currentTime;

        const segment = sponsorSegments.find(seg =>
            t >= seg.start &&
            t < seg.end - 0.08 &&
            (!lastSponsorSkip || lastSponsorSkip.uuid !== seg.uuid || Math.abs(t - lastSponsorSkip.at) > 2)
        );

        if (!segment) return;

        const from = t;
        currentVideo.currentTime = segment.end + 0.03;

        lastSponsorSkip = {
            uuid: segment.uuid,
            start: segment.start,
            end: segment.end,
            at: from
        };

        const seconds = Math.max(1, Math.round(segment.end - from));

        showToast(`已跳過 ${sponsorLabel(segment.category)} ${seconds} 秒`, {
            duration: 3200,
            actionText: '返回',
            onAction: () => {
                if (currentVideo) {
                    currentVideo.currentTime = Math.max(segment.start, from);
                }
            }
        });
    }

    function handleAdAssist() {
        if (!isYouTube) return;
        const player = document.querySelector('#movie_player');
        const video = getVideo();
        if (!player || !video) return;

        const isAd = player.classList.contains('ad-showing');

        if (isAd) {
            if (settings.muteAds && !adWasMuted) {
                volumeBeforeAd = video.muted;
                video.muted = true;
                adWasMuted = true;
            }

            if (settings.autoSkipAds) {
                const skipButton =
                    document.querySelector('.ytp-ad-skip-button-modern') ||
                    document.querySelector('.ytp-ad-skip-button') ||
                    document.querySelector('.ytp-skip-ad-button');

                if (skipButton && !skipButton.disabled) {
                    skipButton.click();
                }
            }
        } else if (adWasMuted) {
            video.muted = Boolean(volumeBeforeAd);
            adWasMuted = false;
            volumeBeforeAd = null;
        }
    }

    function bindVideo(video) {
        if (!video || video === currentVideo) return;
        currentVideo = video;
        baseRate = video.playbackRate;

        if (!boundVideos.has(video)) {
            boundVideos.add(video);
            video.addEventListener('timeupdate', () => {
                if (video === currentVideo && isYouTube) checkSponsorSkip();
            }, { passive: true });

            video.addEventListener('ratechange', () => {
                if (video !== currentVideo) return;
                if (locked || holdActive) {
                    const desired = effectiveSpeed();
                    if (Math.abs(video.playbackRate - desired) > 0.01) {
                        try { video.playbackRate = desired; } catch { /* 網站或瀏覽器禁止 */ }
                    }
                }
                updateControlUI();
                renderPanelValues();
            });
        }
        restoreRememberedSpeed();
        // 換到下一支 Reel 時，舊的 lock 必須自動套用到新 <video>。
        if (locked || holdActive) setVideoRate(effectiveSpeed());
    }

    function onNavigation() {
        currentVideoId = getVideoId();
        currentChannelKey = null;
        sponsorSegments = [];
        lastSponsorSkip = null;

        setTimeout(() => {
            bindVideo(getVideo());
            ensureControlButton();
            restoreRememberedSpeed();
            if (isYouTube) fetchSponsorSegments();
        }, 450);
    }

    document.addEventListener('keydown', event => {
        if (isTypingTarget(event.target)) return;

        if (event.altKey && /^Digit[1-5]$/.test(event.code)) {
            event.preventDefault();
            const rate = Number(event.code.slice(-1));
            setPreset(rate);
            return;
        }

        if (event.altKey && event.code === 'KeyS') {
            event.preventDefault();
            takeScreenshot();
            return;
        }

        if (event.altKey && event.code === 'KeyP') {
            event.preventDefault();
            togglePiP();
            return;
        }

        switch (event.code) {
            case 'Backquote': {
                event.preventDefault();
                if (event.repeat || locked) return;
                startHold(event.shiftKey);
                break;
            }

            case 'Tab': {
                if (!holdActive && !locked) return;
                event.preventDefault();
                if (event.repeat) return;
                toggleLock();
                break;
            }

            case 'PageUp': {
                event.preventDefault();
                if (!event.repeat) adjustSpeed(settings.step);
                break;
            }

            case 'PageDown': {
                event.preventDefault();
                if (!event.repeat) adjustSpeed(-settings.step);
                break;
            }

            case 'Delete': {
                event.preventDefault();
                if (!event.repeat) setPreset(3);
                break;
            }
            case 'Enter': {
                // 不搶 Facebook 搜尋/按鈕/留言的 Enter 鍵與鍵盤無障礙操作。
                if (isInteractiveTarget(event.target) || !getVideo()) return;
                event.preventDefault();

                if (event.repeat) return;

                // 已經全螢幕 → 離開
                if (document.fullscreenElement) {
                    document.exitFullscreen?.();
                    break;
                }

                // YouTube 優先使用原生播放器按鈕
                const youtubeFullscreen =
                      document.querySelector('.ytp-fullscreen-button');

                if (youtubeFullscreen) {
                    youtubeFullscreen.click();
                    break;
                }

                // FB / IG / Threads：先全螢幕影片本體，失敗才退回播放器容器。
                const video = getActiveVideo();
                if (video) {
                    (async () => {
                        const targets = [video, video.parentElement, video.closest('[role="dialog"]')];
                        for (const target of targets) {
                            if (!target?.requestFullscreen) continue;
                            try {
                                await target.requestFullscreen();
                                return;
                            } catch { /* 試下一個容器 */ }
                        }
                        showToast('這個 Reel 目前不允許全螢幕', { force: true });
                    })();
                }
                break;
            }

            default:
                break;
        }
    }, true);

    document.addEventListener('keyup', event => {
        if (event.code === 'Backquote' && !locked) {
            event.preventDefault();
            stopHold();
        }
    }, true);

    document.addEventListener('wheel', event => {
        if (!event.altKey || isTypingTarget(event.target)) return;

        event.preventDefault();
        adjustSpeed(event.deltaY < 0 ? settings.step : -settings.step);
    }, { passive: false, capture: true });

    document.addEventListener('yt-navigate-finish', onNavigation);

    function refreshActiveVideo() {
        const video = getVideo();
        if (video && video !== currentVideo) bindVideo(video);
        if (floatControls && !isYouTube) floatControls.style.display = video ? 'flex' : 'none';
        if (!controlButton || !document.body?.contains(controlButton)) {
            controlButton = null;
            ensureControlButton();
        }
    }

    // Facebook DOM 更新非常頻繁；把 MutationObserver 計算限制在每個畫面 1 次。
    let refreshScheduled = false;
    function scheduleRefresh() {
        if (refreshScheduled) return;
        refreshScheduled = true;
        requestAnimationFrame(() => {
            refreshScheduled = false;
            refreshActiveVideo();
        });
    }
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('play', scheduleRefresh, true);
    document.addEventListener('playing', scheduleRefresh, true);
    window.addEventListener('scroll', scheduleRefresh, { passive: true, capture: true });

    // SPA 跳片、Facebook 重設倍速，透過低頻 watchdog 補強。
    let lastHref = location.href;
    setInterval(() => {
        if (location.href !== lastHref) {
            lastHref = location.href;
            onNavigation();
        }
        refreshActiveVideo();
        const active = getVideo();
        if (active && (locked || holdActive)) {
            const desired = effectiveSpeed();
            if (Math.abs(active.playbackRate - desired) > 0.01) {
                try { active.playbackRate = desired; } catch { /* 網站或瀏覽器禁止 */ }
            }
        }
        if (isYouTube) handleAdAssist();
    }, 800);

    window.addEventListener('resize', () => {
        if (panelOpen) positionPanel();
    });

    ensureStyles();
    bindVideo(getVideo());
    ensureControlButton();
    onNavigation();
})();
