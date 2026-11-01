// ==UserScript==
// @name         Speed Pro - YouTube / Facebook / Instagram / Threads
// @name:zh-TW   Speed Pro｜YouTube、FB Reels、IG 倍速工具
// @namespace    george.youtube.speedpro
// @version      1.2.0
// @updateURL    https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js
// @downloadURL  https://raw.githubusercontent.com/skydreamer0/speed-pro-userscript/main/speed-pro.user.js
// @license      MIT
// @description  Bilibili / 跨平台影片倍速：FB/IG/Threads 浮動控制、YouTube 控制列、快捷鍵、SponsorBlock (YouTube)、PiP
// @match        https://www.bilibili.com/video/*
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
// @connect      bsbsb.top
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const APP = 'yt-speed-pro';
    const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
    const isBilibili = location.hostname === 'www.bilibili.com';
    const inScope = () => !isBilibili || /^\/video\/[^/]+/.test(location.pathname);
    const STORAGE_KEY = `${APP}:settings`;
    const CHANNEL_KEY = `${APP}:channels`;

    const DEFAULTS = {
        speed: 3.0,
        turboSpeed: 5.0,
        step: 0.25,
        rememberGlobal: true,
        rememberChannel: true,
        sponsorBlock: true,
        resumeEnabled: false,
        resumePlaylistJump: false,
        bilibiliSponsorBlock: false,
        showSponsorMarkers: false,
        cosmeticAdFiltering: false,
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

    let sponsorSegments = [];
    let sponsorFullLabel = null;
    let sponsorFetchToken = 0;
    let lastSponsorSkip = null;

    let adWasMuted = false;
    let volumeBeforeAd = null;

    let controlButton = null;
    let floatControls = null;
    const videoStates = new WeakMap();
    let unbindVideo = () => {};
    let holdVideo = null;
    let rateTimer = null;
    let navigationTimer = null;
    let suspended = false;
    // Single, generation-scoped media seek gate shared by future resume and sponsor modules.
    // All feature-owned currentTime writes must pass through this gate.
    const MediaCoordinator = {
        generation: 0,
        invalidate() { this.generation++; },
        snapshot() {
            return { generation: this.generation, video: currentVideo, url: location.href };
        },
        isCurrent(token) {
            return Boolean(token && !suspended && inScope() && token.video &&
                token.video === currentVideo && token.generation === this.generation &&
                token.url === location.href);
        },
        seek(token, time) {
            if (!this.isCurrent(token) || !Number.isFinite(time) || time < 0) return false;
            const video = token.video;
            if (Number.isFinite(video.duration) && time > video.duration + 1) return false;
            // Sponsor / resume must never seek the content while an ad player is active.
            if (isYouTube && document.querySelector('#movie_player')?.classList?.contains('ad-showing')) return false;
            try {
                video.currentTime = time;
                return Math.abs(video.currentTime - time) <= 2;
            } catch { return false; }
        }
    };

    // Opt-in YouTube checkpoints; intentionally no copied YouTube Helper API or extra GM grants.
    // Same-origin localStorage is visible to site JavaScript. See the integration SPEC.
    const ResumeManager = {
        prefix: APP + ':resume:v1:',
        active: null,
        lastSweep: 0,
        lastErrorShown: false,
        context() {
            if (!isYouTube) return null;
            try {
                const url = new URL(location.href);
                if (url.pathname !== '/watch') return null;
                const id = url.searchParams.get('v');
                if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return null;
                const candidate = url.searchParams.get('list');
                const playlistId = candidate && candidate !== 'WL' && /^[A-Za-z0-9_-]{1,120}$/.test(candidate) ? candidate : null;
                return {
                    id, playlistId,
                    key: this.keyFor(id, playlistId),
                    explicitTime: ['t', 'start', 'time_continue'].some(key => url.searchParams.has(key)),
                    explicitIndex: url.searchParams.has('index')
                };
            } catch { return null; }
        },
        keyFor(id, playlistId = null) {
            return this.prefix + 'progress:' + (playlistId ? 'list:' + playlistId : 'standalone') + ':' + id;
        },
        read(key) {
            try {
                const value = localStorage.getItem(key);
                if (!value) return null;
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch { return null; }
        },
        write(key, value) {
            try {
                const previous = this.read(key);
                if (previous && Number(previous.savedAt) > value.savedAt) return false;
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                if (!this.lastErrorShown) {
                    this.lastErrorShown = true;
                    showToast('無法儲存續播進度：瀏覽器儲存空間不可用', { force: true });
                }
                return false;
            }
        },
        attach(video) {
            const ctx = this.context();
            if (!settings.resumeEnabled || !video || !ctx) {
                this.active = null;
                return;
            }
            if (this.active?.video === video && this.active.ctx.key === ctx.key) return;
            this.active = {
                video, ctx, restored: false, userSeeked: false, lastSavedAt: 0,
                startedAt: Date.now(), ignoreOwnSeekUntil: 0
            };
        },
        detach() {
            this.save(this.active?.video, true);
            this.active = null;
        },
        onSeeking(video) {
            const state = this.active;
            if (!state || state.video !== video || Date.now() < state.ignoreOwnSeekUntil) return;
            // Explicit user/native player seeks must win over our initial restore.
            if (video.currentTime > 1 || state.ctx.explicitTime) state.userSeeked = true;
        },
        isAd() {
            return Boolean(document.querySelector('#movie_player')?.classList?.contains('ad-showing'));
        },
        maybeJumpPlaylist(state) {
            if (!settings.resumePlaylistJump || !state.ctx.playlistId || state.ctx.explicitIndex) return false;
            const last = this.read(this.prefix + 'last:' + state.ctx.playlistId);
            if (!last || last.videoId === state.ctx.id) return false;
            const player = document.querySelector('#movie_player');
            const list = player?.getPlaylist?.();
            const index = Array.isArray(list) ? list.indexOf(last.videoId) : -1;
            if (index < 0 || typeof player?.playVideoAt !== 'function') return false;
            try { player.playVideoAt(index); return true; } catch { return false; }
        },
        tryRestore(video) {
            const state = this.active;
            if (!settings.resumeEnabled || !state || !video || state.video !== video ||
                state.restored || state.userSeeked || !MediaCoordinator.isCurrent(MediaCoordinator.snapshot())) return false;
            const ctx = this.context();
            if (!ctx || ctx.key !== state.ctx.key) return false;
            if (ctx.explicitTime || Date.now() - state.startedAt > 30000) {
                state.restored = true;
                return false;
            }
            if (this.isAd()) return false;
            const duration = Number(video.duration);
            if (!Number.isFinite(duration) || duration < 10 || video.readyState < 1) return false;
            // If YouTube has already selected an actual position, preserve it.
            if (video.currentTime > 3 || video.seeking) {
                state.restored = true;
                return false;
            }
            if (this.maybeJumpPlaylist(state)) {
                state.restored = true;
                return true;
            }
            const saved = this.read(ctx.key);
            const endMargin = Math.min(15, Math.max(1, duration * 0.01));
            if (!saved || saved.completed || !Number.isFinite(saved.time) || !Number.isFinite(saved.duration) ||
                saved.time < 5 || saved.time >= duration - endMargin ||
                Date.now() - saved.savedAt > 90 * 86400000 ||
                Math.abs(saved.duration - duration) > Math.max(3, duration * 0.05)) {
                state.restored = true;
                return false;
            }
            state.ignoreOwnSeekUntil = Date.now() + 1500;
            const ok = MediaCoordinator.seek(MediaCoordinator.snapshot(), saved.time);
            if (!ok) { state.ignoreOwnSeekUntil = 0; return false; }
            state.restored = true;
            showToast('已接續上次播放進度');
            return true;
        },
        save(video, force = false) {
            const state = this.active;
            if (!settings.resumeEnabled || !state || !video || state.video !== video || this.isAd()) return;
            if (this.context()?.key !== state.ctx.key) return;
            const now = Date.now();
            if (!force && now - state.lastSavedAt < 5000) return;
            const t = Number(video.currentTime), d = Number(video.duration);
            if (!Number.isFinite(t) || !Number.isFinite(d) || d < 10 || t < 5 || t > d + 1) return;
            const completed = Boolean(video.ended || d - t <= Math.min(15, Math.max(1, d * 0.01)));
            const entry = { time: Math.round(t * 10) / 10, duration: Math.round(d * 10) / 10,
                completed, savedAt: now };
            if (this.write(state.ctx.key, entry)) {
                state.lastSavedAt = now;
                if (state.ctx.playlistId) this.write(this.prefix + 'last:' + state.ctx.playlistId,
                    { videoId: state.ctx.id, savedAt: now });
            }
        },
        cleanup() {
            if (!settings.resumeEnabled || Date.now() - this.lastSweep < 300000) return;
            this.lastSweep = Date.now();
            try {
                const entries = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key?.startsWith(this.prefix)) continue;
                    const item = this.read(key);
                    if (!item || !Number.isFinite(item.savedAt) ||
                        Date.now() - item.savedAt > 90 * 86400000) {
                        localStorage.removeItem(key); i--; continue;
                    }
                    entries.push([key, item.savedAt]);
                }
                if (entries.length > 2000) {
                    entries.sort((a, b) => a[1] - b[1]);
                    for (const [key] of entries.slice(0, entries.length - 2000)) localStorage.removeItem(key);
                }
            } catch { /* restricted site storage; continue playback */ }
        },
        clearHistory() {
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key?.startsWith(this.prefix)) localStorage.removeItem(key);
                }
                if (this.active) this.active.restored = true;
                return true;
            } catch { return false; }
        }
    };
    function stateFor(video) {
        if (!videoStates.has(video)) videoStates.set(video, {
            baseline: video.playbackRate, source: video.currentSrc || video.src || '',
            retries: 0, blocked: false
        });
        return videoStates.get(video);
    }
    function restoreVideo(video) {
        if (!video) return;
        try { video.playbackRate = stateFor(video).baseline; } catch { /* best effort */ }
    }
    function releaseTemporaryHold() {
        if (locked || !holdActive) return;
        holdActive = false;
        turboActive = false;
        const owned = holdVideo;
        holdVideo = null;
        restoreVideo(owned);
        updateControlUI();
    }
    function enforceRate() {
        if (rateTimer !== null || suspended || !inScope()) return;
        const video = currentVideo;
        if (!video || !(locked || holdActive)) return;
        const state = stateFor(video);
        if (state.blocked || Math.abs(video.playbackRate - effectiveSpeed()) < 0.01) return;
        rateTimer = setTimeout(() => {
            rateTimer = null;
            if (video !== currentVideo || !inScope() || !(locked || holdActive) || state.blocked) return;
            if (Math.abs(video.playbackRate - effectiveSpeed()) < 0.01) return;
            if (state.retries >= 3) {
                state.blocked = true;
                showToast('播放器持續重設倍速，已停止重試；請重新選擇倍率', { force: true });
            } else {
                state.retries++;
                try { video.playbackRate = effectiveSpeed(); } catch { state.blocked = true; }
                enforceRate();
            }
            updateControlUI();
            renderPanelValues();
        }, 100);
    }
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
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
    }

    function saveChannelSpeeds() {
        try { localStorage.setItem(CHANNEL_KEY, JSON.stringify(channelSpeeds)); } catch { /* storage unavailable */ }
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function roundRate(value) {
        return Math.round(value * 100) / 100;
    }

    function getVideo() {
        if (suspended || !inScope()) return null;
        // Site-specific discovery stays separate from shared media control.
        return (isYouTube && document.querySelector('video.html5-main-video')) || getActiveVideo();
    }

    function getActiveVideo() {
        if (!inScope()) return null;
        const selector = isBilibili
            ? '.bpx-player-video-wrap video, .bilibili-player-video video' : 'video';
        const videos = [...document.querySelectorAll(selector)];
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
            if (isBilibili) return `${location.pathname}?p=${new URL(location.href).searchParams.get('p') || '1'}`;
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
        return Boolean(target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]') || target?.isContentEditable);
    }

    function isInteractiveTarget(target) {
        return isTypingTarget(target) || Boolean(target?.closest?.('button, a, [role="button"], [role="link"], [role="menuitem"], [role="option"]'));
    }

    function ignoreInput(event) {
        return event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey ||
            (event.composedPath?.() || [event.target]).some(isInteractiveTarget);
    }

    function effectiveSpeed() {
        if (turboActive) return settings.turboSpeed;
        return settings.speed;
    }

    function setVideoRate(rate, { persist = false, toast = false, explicit = true } = {}) {
        const video = getVideo();
        if (!video) return;

        if (video !== currentVideo) bindVideo(video);
        const state = stateFor(video);
        if (explicit) { state.retries = 0; state.blocked = false; }
        if (state.blocked) return;
        const next = clamp(roundRate(rate), 0.25, 16);
        if (!Number.isFinite(next)) return;
        try {
            video.playbackRate = next;
        } catch {
            state.blocked = true;
            showToast('此播放器目前不支援這個倍速', { force: true });
            return;
        }

        enforceRate();

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

        if (video !== currentVideo) bindVideo(video);
        if (!holdActive) {
            stateFor(video).baseline = video.playbackRate;
            holdVideo = video;
        }

        holdActive = true;
        turboActive = turbo;
        setVideoRate(effectiveSpeed());
        updateControlUI();
    }

    function stopHold() {
        releaseTemporaryHold();
    }

    function toggleLock() {
        const video = getVideo();
        if (!video) {
            showToast('找不到可播放的影片，請先開啟 Reel 並播放', { force: true });
            return;
        }

        if (video !== currentVideo) bindVideo(video);
        if (!locked) {
            if (!holdActive) stateFor(video).baseline = video.playbackRate;
            locked = true;
            holdActive = true;
            turboActive = false;
            setVideoRate(settings.speed);
            showToast(`已鎖定 ${settings.speed}×`);
        } else {
            locked = false;
            holdActive = false;
            turboActive = false;
            holdVideo = null;
            restoreVideo(video);
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
        if (video !== currentVideo) bindVideo(video);
        if (!locked && !holdActive) {
            stateFor(video).baseline = video.playbackRate;
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

        if (locked || holdActive) enforceRate();
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

        const shownRate = getVideo()?.playbackRate ?? settings.speed;

        controlButton.textContent = `${shownRate.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}×`;
        controlButton.dataset.locked = String(locked);
        controlButton.title = currentVideo && stateFor(currentVideo).blocked ? '倍速衝突：已停止重試' : locked
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
                    <button class="${APP}-action" data-action="clear-resume">清除續播紀錄</button>
                    <button class="${APP}-action" data-action="reset-all">重設設定</button>
                </div>
            </div>

            <div class="${APP}-section">
                <div class="${APP}-section-title">快捷鍵</div>
                <div class="${APP}-sub" style="line-height:1.8">
                    <b>\`</b> 按住加速　<b>Shift+\`</b> 5×超速<br>
                    ${isBilibili ? '點擊倍率按鈕鎖定（Tab／Enter／方向鍵保留原生）' : '<b>Tab</b> 鎖定'}　<b>Alt+滾輪</b> ±0.25×<br>
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
                    else { sponsorFetchToken++; sponsorSegments = []; sponsorFullLabel = null; clearSponsorVisuals(); }
                })
            ),
            panelRow(
                'Bilibili 贊助片段',
                '僅在能確認目前分 P 的 CID 時取得並跳過片段',
                makeToggle(settings.bilibiliSponsorBlock, value => {
                    settings.bilibiliSponsorBlock = value;
                    saveSettings();
                    if (value) fetchSponsorSegments();
                    else { sponsorFetchToken++; sponsorSegments = []; sponsorFullLabel = null; clearSponsorVisuals(); }
                })
            ),
            panelRow(
                '贊助進度條標記',
                '在辨識的播放器進度條顯示片段顏色',
                makeToggle(settings.showSponsorMarkers, value => {
                    settings.showSponsorMarkers = value;
                    saveSettings();
                    renderSponsorVisuals();
                })
            ),
            panelRow(
                '自動續播（YouTube）',
                '僅於 YouTube 儲存觀看時間；此站可讀取瀏覽器內的進度資料',
                makeToggle(settings.resumeEnabled, value => {
                    settings.resumeEnabled = value;
                    saveSettings();
                    if (value) {
                        ResumeManager.attach(currentVideo);
                        ResumeManager.tryRestore(currentVideo);
                        ResumeManager.cleanup();
                    } else ResumeManager.detach();
                })
            ),
            panelRow(
                '播放清單接續上一支',
                '僅在沒有指定影片序號時嘗試，預設關閉',
                makeToggle(settings.resumePlaylistJump, value => {
                    settings.resumePlaylistJump = value;
                    saveSettings();
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
            const youtubeOnly = ['每頻道記憶', 'SponsorBlock', '自動續播（YouTube）', '播放清單接續上一支', '廣告可跳過時自動略過', '廣告期間自動靜音'];
            panel.querySelectorAll(`.${APP}-row`).forEach(row => {
                if (youtubeOnly.some(label => row.textContent.includes(label))) row.remove();
            });
            panel.querySelector('[data-action="reset-channel"]')?.remove();
            panel.querySelector('[data-action="clear-resume"]')?.remove();
            if (!isBilibili) {
                const bilingualOnly = ['Bilibili 贊助片段', '贊助進度條標記'];
                panel.querySelectorAll(`.${APP}-row`).forEach(row => {
                    if (bilingualOnly.some(label => row.textContent.includes(label))) row.remove();
                });
            }
        }

        if (isYouTube) {
            panel.querySelectorAll(`.${APP}-row`).forEach(row => {
                if (row.textContent.includes('Bilibili 贊助片段')) row.remove();
            });
        }
        panel.querySelector('[data-action="clear-resume"]')?.addEventListener('click', () => {
            showToast(ResumeManager.clearHistory() ? '續播紀錄已清除' : '無法清除續播紀錄', { force: true });
        });
        panel.querySelector('[data-action="screenshot"]').addEventListener('click', takeScreenshot);
        panel.querySelector('[data-action="pip"]').addEventListener('click', togglePiP);

        panel.querySelector('[data-action="reset-channel"]')?.addEventListener('click', () => {
            if (currentChannelKey) {
                delete channelSpeeds[currentChannelKey];
                saveChannelSpeeds();
                showToast('已清除這個頻道的速度記憶', { force: true });
            }
        });

        panel.querySelector('[data-action="reset-all"]').addEventListener('click', () => {
            locked = false;
            releaseTemporaryHold();
            restoreVideo(currentVideo);
            settings = structuredClone(DEFAULTS);
            channelSpeeds = {};
            saveSettings();
            saveChannelSpeeds();
            const numbers = panel.querySelectorAll('input[type="number"]');
            numbers[0].value = settings.speed;
            numbers[1].value = settings.turboSpeed;
            const keys = { '每頻道記憶': 'rememberChannel', 'SponsorBlock': 'sponsorBlock',
                '自動續播（YouTube）': 'resumeEnabled', '播放清單接續上一支': 'resumePlaylistJump',
                'Bilibili 贊助片段': 'bilibiliSponsorBlock', '贊助進度條標記': 'showSponsorMarkers',
                '廣告可跳過時自動略過': 'autoSkipAds', '廣告期間自動靜音': 'muteAds', '提示訊息': 'showToasts' };
            panel.querySelectorAll(`.${APP}-row`).forEach(row => {
                const key = keys[row.querySelector(`.${APP}-label-main`)?.textContent];
                const input = row.querySelector('input[type="checkbox"]');
                if (key && input) input.checked = settings[key];
            });
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

        const shown = getVideo()?.playbackRate ?? settings.speed;

        if (rateEl) rateEl.textContent = `${shown}×`;

        if (stateEl) {
            stateEl.textContent = currentVideo && stateFor(currentVideo).blocked ? '倍速衝突，已退讓' : locked
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


    // No Bilibili segment can be used without a verified video ID and page CID.
    // This data is not reliably accessible in all userscript sandboxes; fail closed.
    function getBilibiliSponsorIdentity() {
        if (!isBilibili || !inScope()) return null;
        const bv = location.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/)?.[1];
        if (!bv) return null;
        const p = Number(new URL(location.href).searchParams.get('p') || 1);
        if (!Number.isSafeInteger(p) || p < 1 || p > 1000) return null;
        const videoData = window.__INITIAL_STATE__?.videoData;
        if (!videoData || videoData.bvid !== bv || !Array.isArray(videoData.pages)) return null;
        const cid = Number(videoData.pages[p - 1]?.cid);
        if (!Number.isSafeInteger(cid) || cid <= 0) return null;
        return { platform: 'bilibili', videoId: bv, cid: String(cid), page: p };
    }

    function sponsorIdentity() {
        if (isBilibili) return settings.bilibiliSponsorBlock ? getBilibiliSponsorIdentity() : null;
        if (!isYouTube || !settings.sponsorBlock) return null;
        const id = getVideoId();
        return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? { platform: 'youtube', videoId: id } : null;
    }

    async function sponsorHashPrefix(id) {
        if (!crypto?.subtle) return null;
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
        return Array.from(new Uint8Array(hash).slice(0, 2)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function normalizeSponsorBucket(bucket, identity, duration) {
        if (!identity || !Array.isArray(bucket) || !Number.isFinite(duration) || duration <= 0) {
            return { segments: [], fullLabel: null };
        }
        const record = bucket.find(entry => entry?.videoID === identity.videoId);
        if (!record || !Array.isArray(record.segments)) return { segments: [], fullLabel: null };
        const allowed = identity.platform === 'bilibili'
            ? new Set(['sponsor', 'selfpromo', 'exclusive_access', 'interaction', 'outro'])
            : new Set(settings.sponsorCategories.filter(c => c !== 'music_offtopic'));
        const accepted = [];
        let fullLabel = null;
        for (const segment of record.segments.slice(0, 300)) {
            if (!Array.isArray(segment?.segment) || segment.segment.length !== 2) continue;
            const start = Number(segment.segment[0]), end = Number(segment.segment[1]);
            if (!Number.isFinite(start) || !Number.isFinite(end) ||
                start < 0 || start >= end || end > duration + 2 ||
                !allowed.has(segment.category)) continue;
            if (identity.platform === 'bilibili' && String(segment.cid) !== identity.cid) continue;
            if (segment.actionType === 'full') {
                fullLabel = segment.category;
                continue;
            }
            if (segment.actionType && segment.actionType !== 'skip') continue;
            accepted.push({ start, end, category: segment.category, uuid: String(segment.UUID || '') });
        }
        accepted.sort((a, b) => a.start - b.start || a.end - b.end);
        return { segments: accepted.slice(0, 150), fullLabel };
    }

    function clearSponsorVisuals() {
        document.getElementById(APP + '-sponsor-markers')?.remove();
        document.getElementById(APP + '-sponsor-label')?.remove();
    }

    function renderSponsorVisuals() {
        const enabled = isBilibili ? settings.bilibiliSponsorBlock : settings.sponsorBlock;
        const video = getVideo();
        const duration = Number(video?.duration);
        const bar = isBilibili
            ? document.querySelector('.bpx-player-progress-wrap, .bpx-player-progress')
            : document.querySelector('.ytp-progress-bar');
        const old = document.getElementById(APP + '-sponsor-markers');
        if (!enabled || !settings.showSponsorMarkers || !bar ||
            !Number.isFinite(duration) || duration <= 0 || !sponsorSegments.length) {
            old?.remove();
        } else {
            // The site controls its progress bar layout. Fail closed on unknown positioning.
            const positioned = window.getComputedStyle?.(bar)?.position;
            if (positioned && positioned !== 'static') {
                const stamp = sponsorSegments.length + ':' + Math.floor(duration);
                if (!old || old.parentElement !== bar || old.dataset.stamp !== stamp) {
                    old?.remove();
                    const overlay = document.createElement('div');
                    overlay.id = APP + '-sponsor-markers';
                    overlay.dataset.stamp = stamp;
                    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;';
                    const colors = {
                        sponsor: '#00d400', selfpromo: '#e4db20', exclusive_access: '#008a5c',
                        interaction: '#bb20ee', intro: '#33bbcc', outro: '#2244dd',
                        preview: '#65b8ec', filler: '#999999'
                    };
                    for (const item of sponsorSegments) {
                        const start = Math.max(0, Math.min(100, item.start / duration * 100));
                        const end = Math.max(start, Math.min(100, item.end / duration * 100));
                        const mark = document.createElement('span');
                        mark.title = sponsorLabel(item.category);
                        mark.style.cssText = 'position:absolute;top:0;height:100%;opacity:.75;';
                        mark.style.left = start + '%';
                        mark.style.width = (end - start) + '%';
                        mark.style.backgroundColor = colors[item.category] || '#aaa';
                        overlay.appendChild(mark);
                    }
                    bar.appendChild(overlay);
                }
            }
        }
        const oldLabel = document.getElementById(APP + '-sponsor-label');
        if (!enabled || !sponsorFullLabel) { oldLabel?.remove(); return; }
        const title = isBilibili ? document.querySelector('.video-title')
            : document.querySelector('ytd-watch-metadata #title h1');
        if (!title) return;
        if (oldLabel && oldLabel.parentElement === title) return;
        oldLabel?.remove();
        const label = document.createElement('span');
        label.id = APP + '-sponsor-label';
        label.textContent = sponsorLabel(sponsorFullLabel);
        label.style.cssText = 'display:inline-block;margin-left:8px;padding:2px 6px;border-radius:4px;background:#245b43;color:#fff;font:500 11px sans-serif;';
        title.appendChild(label);
    }

    async function fetchSponsorSegments() {
        const identity = sponsorIdentity();
        const token = ++sponsorFetchToken;
        sponsorSegments = [];
        sponsorFullLabel = null;
        clearSponsorVisuals();
        if (!identity || !inScope()) return;
        const requestUrl = location.href;
        try {
            const prefix = await sponsorHashPrefix(identity.videoId);
            if (!prefix || token !== sponsorFetchToken || location.href !== requestUrl) return;
            const categories = identity.platform === 'bilibili'
                ? ['sponsor', 'selfpromo', 'exclusive_access', 'interaction', 'outro']
                : settings.sponsorCategories.filter(c => c !== 'music_offtopic');
            const base = identity.platform === 'bilibili' ? 'https://bsbsb.top' : 'https://sponsor.ajay.app';
            const url = base + '/api/skipSegments/' + prefix +
                '?categories=' + encodeURIComponent(JSON.stringify(categories)) +
                '&actionTypes=' + encodeURIComponent(JSON.stringify(['skip', 'full']));
            const response = await gmGet(url);
            if (token !== sponsorFetchToken || location.href !== requestUrl ||
                response.status < 200 || response.status >= 300) return;
            const parsed = JSON.parse(response.responseText);
            const duration = Number(getVideo()?.duration);
            const result = normalizeSponsorBucket(parsed, identity, duration);
            if (token !== sponsorFetchToken || location.href !== requestUrl) return;
            sponsorSegments = result.segments;
            sponsorFullLabel = result.fullLabel;
            renderSponsorVisuals();
        } catch {
            if (token === sponsorFetchToken) {
                sponsorSegments = [];
                sponsorFullLabel = null;
                clearSponsorVisuals();
            }
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
            filler: '填充內容',
            exclusive_access: '限定內容'
        };
        return labels[category] || category;
    }

    function checkSponsorSkip() {
        if (!(isBilibili ? settings.bilibiliSponsorBlock : settings.sponsorBlock) || !currentVideo || sponsorSegments.length === 0) return;

        const t = currentVideo.currentTime;

        const segment = sponsorSegments.find(seg =>
            t >= seg.start &&
            t < seg.end - 0.08 &&
            (!lastSponsorSkip || lastSponsorSkip.uuid !== seg.uuid || Math.abs(t - lastSponsorSkip.at) > 2)
        );

        if (!segment) return;

        const from = t;
        const token = MediaCoordinator.snapshot();
        if (!MediaCoordinator.seek(token, segment.end + 0.03)) return;

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
                MediaCoordinator.seek(token, Math.max(segment.start, from));
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
        if (video === currentVideo) return;
        releaseTemporaryHold();
        const previous = currentVideo;
        MediaCoordinator.invalidate();
        unbindVideo();
        currentVideo = null;
        // Restore the old controlled player before leaving it; previews are never touched.
        if (locked) restoreVideo(previous);
        clearTimeout(rateTimer);
        rateTimer = null;
        currentVideo = video;
        if (!video) return;
        const state = stateFor(video);
        state.baseline = video.playbackRate;
        const onRate = () => {
            enforceRate();
            updateControlUI();
            renderPanelValues();
        };
        const onMedia = event => {
            if (video !== currentVideo) return;
            releaseTemporaryHold();
            clearTimeout(rateTimer);
            rateTimer = null;
            const source = video.currentSrc || video.src || '';
            if (source && source !== state.source) {
                MediaCoordinator.invalidate();
                state.source = source;
                if (!locked || Math.abs(video.playbackRate - effectiveSpeed()) > 0.01) state.baseline = video.playbackRate;
                // Media events never replenish the budget; only explicit user commands do.
            }
            if (event.type === 'loadedmetadata') {
                enforceRate();
                if (isYouTube) ResumeManager.tryRestore(video);
                if ((isYouTube || isBilibili) && !sponsorSegments.length) fetchSponsorSegments();
                renderSponsorVisuals();
            }
        };
        const onTime = () => {
            if (isYouTube) ResumeManager.save(video);
            if (isYouTube || isBilibili) checkSponsorSkip();
        };
        const onSeeking = () => { if (isYouTube) ResumeManager.onSeeking(video); };
        const onPause = () => { if (isYouTube) ResumeManager.save(video, true); };
        const onEnded = () => { if (isYouTube) ResumeManager.save(video, true); };
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('seeking', onSeeking);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('ratechange', onRate);
        ['emptied', 'loadstart', 'loadedmetadata'].forEach(type => video.addEventListener(type, onMedia));
        unbindVideo = () => {
            ResumeManager.detach();
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('seeking', onSeeking);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('ratechange', onRate);
            ['emptied', 'loadstart', 'loadedmetadata'].forEach(type => video.removeEventListener(type, onMedia));
        };
        restoreRememberedSpeed();
        enforceRate();
        if (isYouTube) {
            ResumeManager.attach(video);
            ResumeManager.tryRestore(video);
        }
    }

    function onNavigation() {
        ResumeManager.detach();
        MediaCoordinator.invalidate();
        sponsorFetchToken++; // Reject responses from the prior route immediately.
        releaseTemporaryHold();
        currentVideoId = getVideoId();
        currentChannelKey = null;
        sponsorSegments = [];
        sponsorFullLabel = null;
        clearSponsorVisuals();
        lastSponsorSkip = null;
        clearTimeout(navigationTimer);
        navigationTimer = setTimeout(() => {
            navigationTimer = null;
            if (suspended) return;
            bindVideo(getVideo());
            if (isYouTube) { ResumeManager.attach(currentVideo); ResumeManager.tryRestore(currentVideo); }
            ensureControlButton();
            restoreRememberedSpeed();
            if (isYouTube || isBilibili) fetchSponsorSegments();
        }, 450);
    }

    document.addEventListener('keydown', event => {
        if (ignoreInput(event) || !getVideo()) return;
        if (isBilibili && ['Tab', 'Enter'].includes(event.code)) return;

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
        if (event.code === 'Backquote' && holdActive && !locked) {
            event.preventDefault();
            stopHold();
        }
    }, true);

    document.addEventListener('wheel', event => {
        if (!event.altKey || ignoreInput(event) || !getVideo()) return;

        event.preventDefault();
        adjustSpeed(event.deltaY < 0 ? settings.step : -settings.step);
    }, { passive: false, capture: true });

    document.addEventListener('yt-navigate-finish', onNavigation);

    function refreshActiveVideo() {
        const video = getVideo();
        if (video !== currentVideo) bindVideo(video);
        if (!inScope()) closePanel();
        if (floatControls && !isYouTube) floatControls.style.display = video ? 'flex' : 'none';
        if (!controlButton || !document.body?.contains(controlButton)) {
            controlButton = null;
            ensureControlButton();
        }
    }

    // Facebook DOM 更新非常頻繁；把 MutationObserver 計算限制在每個畫面 1 次。
    let refreshScheduled = false;
    function scheduleRefresh() {
        if (refreshScheduled || suspended) return;
        refreshScheduled = true;
        requestAnimationFrame(() => {
            refreshScheduled = false;
            if (!suspended) refreshActiveVideo();
        });
    }
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('play', scheduleRefresh, true);
    document.addEventListener('playing', scheduleRefresh, true);
    window.addEventListener('scroll', scheduleRefresh, { passive: true, capture: true });

    // SPA 跳片、Facebook 重設倍速，透過低頻 watchdog 補強。
    let lastHref = location.href;
    function tick() {
        if (suspended) return;
        if (location.href !== lastHref) {
            lastHref = location.href;
            onNavigation();
        }
        refreshActiveVideo();
        enforceRate();
        if (isYouTube) {
            handleAdAssist();
            ResumeManager.tryRestore(currentVideo);
            ResumeManager.cleanup();
        }
        if (isYouTube || isBilibili) renderSponsorVisuals();
    }
    let watchdog = setInterval(tick, 800);

    window.addEventListener('blur', releaseTemporaryHold);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseTemporaryHold(); });
    window.addEventListener('pagehide', () => {
        ResumeManager.detach();
        clearSponsorVisuals();
        releaseTemporaryHold();
        bindVideo(null);
        suspended = true;
        observer.disconnect();
        clearInterval(watchdog);
        clearTimeout(navigationTimer);
        clearTimeout(rateTimer);
        rateTimer = null;
    });
    window.addEventListener('pageshow', () => {
        if (!suspended) return;
        suspended = false;
        observer.observe(document.documentElement, { childList: true, subtree: true });
        watchdog = setInterval(tick, 800);
        refreshActiveVideo();
        if (isYouTube) { ResumeManager.attach(currentVideo); ResumeManager.tryRestore(currentVideo); }
    });

    window.addEventListener('resize', () => {
        if (panelOpen) positionPanel();
    });

    ensureStyles();
    bindVideo(getVideo());
    ensureControlButton();
    onNavigation();
})();
