const isOverlayMode = (new URLSearchParams(window.location.search).get('overlay') === 'true');
const token = new URLSearchParams(window.location.search).get('token') || '';

// --- 1. Sound Synthesis Engine (Web Audio API) ---
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            // Initialize AudioContext on user interaction
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle(enabled) {
        this.enabled = enabled;
        if (enabled) this.init();
    }

    playTick() {
        if (!this.enabled) return;
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // High frequency transient (click)
        osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
    }

    playCoin() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.ctx.currentTime;
        
        // Classic arcade double-chime (B5 then E6)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.frequency.setValueAtTime(987.77, now); // B5
        osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc1.start(now);
        osc1.stop(now + 0.35);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.35);
    }

    playWin() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
        
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + index * 0.1);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + index * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.45);
            
            osc.start(now + index * 0.1);
            osc.stop(now + index * 0.1 + 0.5);
        });
    }

    playEliminate() {
        if (!this.enabled) return;
        this.init();
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.6);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        
        osc.start();
        osc.stop(now + 0.7);
    }
}

const audio = new AudioEngine();

// --- 2. Canvas Confetti Particle System ---
class ConfettiManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = false;
        
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    start() {
        this.active = true;
        this.particles = [];
        const colors = ['#f5c75d', '#ff2d55', '#ff9500', '#34c759', '#007aff', '#af52de'];
        
        for (let i = 0; i < 120; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * this.canvas.height,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0,
                speedY: Math.random() * 3 + 2,
                speedX: Math.random() * 2 - 1
            });
        }
        
        this.animate();
    }

    stop() {
        this.active = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    animate() {
        if (!this.active) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let remaining = false;
        
        this.particles.forEach((p) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += p.speedY;
            p.x += p.speedX + Math.sin(p.tiltAngle) * 0.5;
            p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;
            
            if (p.y <= this.canvas.height) {
                remaining = true;
            }
            
            this.ctx.beginPath();
            this.ctx.lineWidth = p.r;
            this.ctx.strokeStyle = p.color;
            this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            this.ctx.stroke();
        });
        
        if (remaining) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.active = false;
        }
    }
}

// --- 3. Main Game State & Variables ---
const game = {
    // Unique players registry (caches colors, nicknames, avatar images)
    players: [],
    // Slices currently on the wheel (each slice is an entry)
    entries: [],
    // Total coins currently in the wheel
    totalCoins: 0,
    totalCoinsEarnedThisRound: 0,
    // Game configurations
    config: {
        minBid: 1,
        roundTime: 30,
        gameMode: 'elimination', // 'elimination' or 'winner'
        soundEnabled: true,
        snipeDelayEnabled: false,
        snipeDelayTime: 15,
        chatJoinEnabled: false,
        joinKeyword: 'join',
        shuffleModeEnabled: false,
        suddenDeathEnabled: true,
        suddenDeathTime: 90,
        entriesLocked: false,
        autoIncreaseBids: false,
        autoIncreaseGoal: 10.0,
        autoIncreaseStep: 250
    },
    roundAutoIncreased: false,
    // Engine states
    state: 'idle', // 'idle', 'countdown', 'spinning', 'result'
    timer: 30,
    timerInterval: null,
    
    // Wheel animation metrics
    wheel: {
        canvas: null,
        ctx: null,
        angle: 0, // current rotational offset in radians
        spinVelocity: 0, // angular velocity (rad/frame)
        friction: 0.993, // deceleration rate
        prevTickerSectorIndex: -1, // track tick ticks
        avatarCache: {}, // cache loaded Image objects
        shades: ['#bf953f', '#e6c567', '#8a6623', '#ffd83b', '#a67b2e', '#f5ea9e'] // wheel shades
    },
    
    // WS connector
    ws: null,
    
    // Rigged targeted next winner uniqueId
    nextWinnerId: null,
    snipeTargetChampion: null,
    suddenDeathTriggered: false,
    activeStreaks: {},
    bidQueue: []
};

// --- Initialize DOM elements references ---
const dom = {
    timerDisplay: document.getElementById('timer-display'),
    modeBadge: document.getElementById('mode-badge'),
    badgeText: document.getElementById('badge-text'),
    statMinBid: document.getElementById('stat-min-bid'),
    statPlayers: document.getElementById('stat-players'),
    statCoins: document.getElementById('stat-coins'),
    widgetTotalParticipants: document.getElementById('widget-total-participants'),
    widgetTotalCoins: document.getElementById('widget-total-coins'),
    widgetRoundTimer: document.getElementById('widget-round-timer'),
    centerBidAmount: document.getElementById('center-bid-amount'),
    centerGiftCount: document.getElementById('center-gift-count'),
    centerIconContainer: document.getElementById('center-icon-container'),
    wheelCenter: document.querySelector('.wheel-center'),
    drawerToggle: document.getElementById('drawer-toggle'),
    controlDrawer: document.getElementById('control-drawer'),
    drawerClose: document.getElementById('drawer-close'),
    tiktokUsername: document.getElementById('tiktok-username'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    setMinBid: document.getElementById('set-min-bid'),
    setRoundTime: document.getElementById('set-round-time'),
    setGameMode: document.getElementById('set-game-mode'),
    setSound: document.getElementById('set-sound'),
    setLockEntries: document.getElementById('set-lock-entries'),
    lockedBadgeContainer: document.getElementById('locked-badge-container'),
    setAutoIncrease: document.getElementById('set-auto-increase'),
    setAutoIncreaseGoal: document.getElementById('set-auto-increase-goal'),
    setAutoIncreaseStep: document.getElementById('set-auto-increase-step'),
    topStatRevenueCard: document.getElementById('top-stat-revenue-card'),
    widgetRevenueText: document.getElementById('widget-revenue-text'),
    widgetRevenueProgress: document.getElementById('widget-revenue-progress'),
    setShuffleMode: document.getElementById('set-shuffle-mode'),
    setSuddenDeath: document.getElementById('set-sudden-death'),
    setSuddenDeathTime: document.getElementById('set-sudden-death-time'),
    setSnipeDelay: document.getElementById('set-snipe-delay'),
    setSnipeTime: document.getElementById('set-snipe-time'),
    setChatJoin: document.getElementById('set-chat-join'),
    setJoinKeyword: document.getElementById('set-join-keyword'),
    btnResetGame: document.getElementById('btn-reset-game'),
    btnSpinNow: document.getElementById('btn-spin-now'),
    btnPauseTimer: document.getElementById('btn-pause-timer'),
    overlayUrl: document.getElementById('overlay-url'),
    btnCopyUrl: document.getElementById('btn-copy-url'),
    simUsername: document.getElementById('sim-username'),
    simCoins: document.getElementById('sim-coins'),
    simGift: document.getElementById('sim-gift'),
    btnSimGift: document.getElementById('btn-sim-gift'),
    btnSimChat: document.getElementById('btn-sim-chat'),
    eventFeed: document.getElementById('event-feed'),
    announcementBanner: document.getElementById('announcement-banner'),
    announcementTitle: document.getElementById('announcement-title'),
    announcementAvatar: document.getElementById('announcement-avatar'),
    announcementName: document.getElementById('announcement-name'),
    announcementDetail: document.getElementById('announcement-detail'),
    announcementDismiss: document.getElementById('announcement-dismiss'),
    playersSidebar: document.getElementById('players-sidebar'),
    playersList: document.getElementById('players-list'),
    setDiscordEnabled: document.getElementById('set-discord-enabled'),
    setDiscordUrl: document.getElementById('set-discord-url'),
    btnTestDiscord: document.getElementById('btn-test-discord'),
    btnAppsHub: document.getElementById('btn-apps-hub'),
    btnLogout: document.getElementById('btn-logout')
};

let confetti;

// --- 4. Main Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    // Setup Canvas
    game.wheel.canvas = document.getElementById('wheel-canvas');
    game.wheel.ctx = game.wheel.canvas.getContext('2d');
    
    // Setup Confetti
    confetti = new ConfettiManager('confetti-canvas');
    
    // Bind Event Listeners
    setupEventHandlers();
    
    // Set initial configuration parameters
    updateConfigFromDOM();
    syncStatsDisplay();
    
    // Setup Overlay URL copy and transparent mode parameters
    initOverlayConfig();
    
    // Start Canvas Draw loop
    requestAnimationFrame(gameLoop);
    
    // Establish WebSocket Connection
    connectWebSocket();
});

// Setup event listeners for control drawer, simulated buttons, settings changes
function setupEventHandlers() {
    // Drawer open/close
    dom.drawerToggle.addEventListener('click', () => {
        audio.init(); // Initialize audio context on first click
        dom.controlDrawer.classList.toggle('open');
    });
    
    dom.drawerClose.addEventListener('click', () => {
        dom.controlDrawer.classList.remove('open');
    });
    
    // Close drawer if clicking outside
    document.addEventListener('click', (e) => {
        if (!dom.controlDrawer.contains(e.target) && 
            !dom.drawerToggle.contains(e.target) && 
            dom.controlDrawer.classList.contains('open')) {
            dom.controlDrawer.classList.remove('open');
        }
    });

    // Connection button
    dom.btnConnect.addEventListener('click', () => {
        const username = dom.tiktokUsername.value.trim();
        if (username && game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({
                type: "connect",
                username: username
            }));
            addLog(`Connecting to @${username}...`, 'info');
        }
    });

    dom.btnDisconnect.addEventListener('click', () => {
        if (game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({
                type: "disconnect"
            }));
            addLog(`Disconnecting...`, 'info');
        }
    });

    if (dom.btnLogout) {
        dom.btnLogout.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout? This will clear your license key on this machine.")) {
                try {
                    const response = await fetch(`/api/logout?token=${token}`, { method: 'POST' });
                    if (response.ok) {
                        window.location.href = `/?token=${token}`;
                    } else {
                        alert("Failed to logout. Please try again.");
                    }
                } catch (err) {
                    alert("Network error: Could not contact local server.");
                }
            }
        });
    }

    // Settings Updates
    dom.setMinBid.addEventListener('change', sendSettingsUpdate);
    dom.setRoundTime.addEventListener('change', sendSettingsUpdate);
    dom.setGameMode.addEventListener('change', sendSettingsUpdate);
    if (dom.setLockEntries) dom.setLockEntries.addEventListener('change', sendSettingsUpdate);
    if (dom.setAutoIncrease) dom.setAutoIncrease.addEventListener('change', sendSettingsUpdate);
    if (dom.setAutoIncreaseGoal) dom.setAutoIncreaseGoal.addEventListener('change', sendSettingsUpdate);
    if (dom.setAutoIncreaseStep) dom.setAutoIncreaseStep.addEventListener('change', sendSettingsUpdate);

    // Discord Webhook Settings Updates
    if (dom.setDiscordUrl && dom.setDiscordEnabled) {
        dom.setDiscordUrl.addEventListener('change', sendDiscordConfigUpdate);
        dom.setDiscordEnabled.addEventListener('change', sendDiscordConfigUpdate);
    }
    
    if (dom.btnTestDiscord) {
        dom.btnTestDiscord.addEventListener('click', () => {
            if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                // Save first to ensure the server uses the URL currently in the box
                sendDiscordConfigUpdate();
                game.ws.send(JSON.stringify({
                    type: "discord_test"
                }));
                addLog("Sending test Discord Webhook notification...", "info");
            } else {
                alert("WebSocket connection is not open. Please ensure the server is running.");
            }
        });
    }
    
    dom.setSound.addEventListener('change', () => {
        game.config.soundEnabled = dom.setSound.checked;
        audio.toggle(game.config.soundEnabled);
    });

    if (dom.setShuffleMode) {
        dom.setShuffleMode.addEventListener('change', sendSettingsUpdate);
    }

    if (dom.setSuddenDeath) {
        dom.setSuddenDeath.addEventListener('change', () => {
            const suddenDeath = dom.setSuddenDeath.checked;
            const elements = document.querySelectorAll('.sudden-death-only');
            elements.forEach(el => {
                // Ignore the checkbox label itself (it is a sudden-death label but not sudden-death-only!)
                // Wait! The label has class="sudden-death-only" and input has class="sudden-death-only".
                // If we hide them, they both get hidden. That's exactly correct!
                if (suddenDeath) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
            sendSettingsUpdate();
        });
    }

    if (dom.setSuddenDeathTime) {
        dom.setSuddenDeathTime.addEventListener('change', sendSettingsUpdate);
    }

    // Double-click to target a player for the next spin (Shuffle Grid)
    const shuffleGridContainer = document.getElementById('shuffle-grid-container');
    if (shuffleGridContainer) {
        shuffleGridContainer.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.shuffle-card');
            if (!item) return;
            
            const uid = item.getAttribute('data-uid');
            if (!uid) return;
            
            if (isOverlayMode) return;

            if (game.nextWinnerId === uid) {
                game.nextWinnerId = null;
                addLog("Targeted spin cancelled.", "info");
            } else {
                game.nextWinnerId = uid;
                const player = game.players.find(p => p.uniqueId === uid);
                const displayName = player ? player.nickname : uid;
                addLog(`🎯 Next spin targeted to land on ${displayName}!`, "info");
            }
            
            updatePlayersListUI();
        });
    }
    
    if (dom.setSnipeDelay) {
        dom.setSnipeDelay.addEventListener('change', () => {
            const snipeDelay = dom.setSnipeDelay.checked;
            const snipeOnlyElements = document.querySelectorAll('.snipe-only');
            snipeOnlyElements.forEach(el => {
                if (snipeDelay) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
            sendSettingsUpdate();
        });
    }
    
    if (dom.setSnipeTime) {
        dom.setSnipeTime.addEventListener('change', sendSettingsUpdate);
    }
    
    dom.setChatJoin.addEventListener('change', () => {
        game.config.chatJoinEnabled = dom.setChatJoin.checked;
        const labels = document.querySelectorAll('.chat-join-only');
        labels.forEach(el => {
            if (game.config.chatJoinEnabled) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    });
    
    dom.setJoinKeyword.addEventListener('change', () => {
        game.config.joinKeyword = dom.setJoinKeyword.value.trim().toLowerCase();
    });

    // Reset game / manual spin
    dom.btnResetGame.addEventListener('click', () => {
        if (game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({ type: "reset_game" }));
        } else {
            resetGame();
        }
    });
    
    dom.btnPauseTimer.addEventListener('click', () => {
        if (game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({ type: "toggle_pause" }));
        } else {
            togglePause();
        }
    });
    
    dom.btnSpinNow.addEventListener('click', () => {
        const uniquePlayerIds = new Set(game.entries.map(e => e.player.uniqueId));
        if (uniquePlayerIds.size >= 2) {
            const winnerIdx = determineWinnerIndex();
            if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                game.ws.send(JSON.stringify({
                    type: "trigger_spin",
                    data: { winnerIndex: winnerIdx }
                }));
            } else {
                triggerSpin(winnerIdx);
            }
        } else {
            alert("Need at least 2 players to spin the wheel!");
        }
    });

    if (dom.announcementDismiss) {
        dom.announcementDismiss.addEventListener('click', () => {
            if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                game.ws.send(JSON.stringify({ type: "dismiss_announcement" }));
            } else {
                dismissAnnouncement();
            }
        });
    }

    // Offline Simulation Triggers
    dom.btnSimGift.addEventListener('click', () => {
        const username = dom.simUsername.value.trim() || "User" + Math.floor(Math.random() * 1000);
        const giftSelected = dom.simGift.value;
        let coins = parseInt(dom.simCoins.value) || 1;
        let giftName = "Rose";

        if (giftSelected === "Rose") { giftName = "Rose"; coins = 1; }
        else if (giftSelected === "Finger Heart") { giftName = "Finger Heart"; coins = 5; }
        else if (giftSelected === "Doughnut") { giftName = "Doughnut"; coins = 30; }
        else if (giftSelected === "TikTok") { giftName = "TikTok"; coins = 1; }
        else if (giftSelected === "Fireworks") { giftName = "Fireworks"; coins = 1088; }
        else { giftName = "Custom Gift"; } // Custom uses whatever is in coins input

        const payload = {
            uniqueId: username,
            nickname: username,
            avatar: "", // empty, will fallback to canvas initials
            giftName: giftName,
            coins: coins,
            streak: 1,
            repeatCount: 1
        };

        // Send simulated gift to socket so backend broadcasts it to all listeners (including us)
        if (game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({
                type: "simulate_gift",
                data: payload
            }));
        } else {
            // FALLBACK: process directly in the client if WS is not open
            addLog(`${payload.nickname} sent ${payload.giftName} (🪙 ${payload.coins}) [Local Sim]`, 'gift');
            registerPlayerBid(payload.uniqueId, payload.nickname, payload.avatar, payload.coins, payload.giftName);
        }
    });

    dom.btnSimChat.addEventListener('click', () => {
        const username = dom.simUsername.value.trim() || "User" + Math.floor(Math.random() * 1000);
        let commentText = game.config.joinKeyword; // Default to join keyword if comment-to-join is enabled
        
        if (!game.config.chatJoinEnabled) {
            commentText = "Hello! Love the stream!";
        }

        const payload = {
            uniqueId: username,
            nickname: username,
            avatar: "",
            comment: commentText
        };

        if (game.ws && game.ws.readyState === WebSocket.OPEN) {
            game.ws.send(JSON.stringify({
                type: "simulate_chat",
                data: payload
            }));
        } else {
            // FALLBACK: process directly in the client if WS is not open
            addLog(`${payload.uniqueId}: ${payload.comment} [Local Sim]`, 'chat');
            if (game.config.chatJoinEnabled) {
                const commentClean = payload.comment.trim().toLowerCase();
                if (commentClean === game.config.joinKeyword) {
                    registerPlayerBid(payload.uniqueId, payload.nickname, payload.avatar, game.config.minBid, "Chat Join");
                }
            }
        }
    });

    // Double-click to target a player for the next spin
    if (dom.playersList) {
        dom.playersList.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.player-list-item');
            if (!item) return;
            
            const uid = item.getAttribute('data-uid');
            if (!uid) return;
            
            if (isOverlayMode) return;

            if (game.nextWinnerId === uid) {
                game.nextWinnerId = null;
                addLog("Targeted spin cancelled.", "info");
            } else {
                game.nextWinnerId = uid;
                const player = game.players.find(p => p.uniqueId === uid);
                const displayName = player ? player.nickname : uid;
                addLog(`🎯 Next spin targeted to land on ${displayName}!`, "info");
            }
            
            updatePlayersListUI();
        });
    }

    if (dom.btnAppsHub) {
        dom.btnAppsHub.addEventListener('click', () => {
            window.location.href = '/hub';
        });
    }
}

function updateConfigFromDOM() {
    // Read local settings and trigger sync send
    sendSettingsUpdate();
}

function sendSettingsUpdate() {
    const minBid = dom.setMinBid ? Math.max(1, parseInt(dom.setMinBid.value) || 1) : game.config.minBid;
    const roundTime = dom.setRoundTime ? Math.max(5, parseInt(dom.setRoundTime.value) || 30) : game.config.roundTime;
    const gameMode = dom.setGameMode ? dom.setGameMode.value : game.config.gameMode;
    const snipeDelayEnabled = dom.setSnipeDelay ? dom.setSnipeDelay.checked : game.config.snipeDelayEnabled;
    const snipeDelayTime = dom.setSnipeTime ? Math.max(5, parseInt(dom.setSnipeTime.value) || 15) : game.config.snipeDelayTime;
    const shuffleModeEnabled = dom.setShuffleMode ? dom.setShuffleMode.checked : game.config.shuffleModeEnabled;
    const suddenDeathEnabled = dom.setSuddenDeath ? dom.setSuddenDeath.checked : game.config.suddenDeathEnabled;
    const suddenDeathTime = dom.setSuddenDeathTime ? Math.max(5, parseInt(dom.setSuddenDeathTime.value) || 90) : game.config.suddenDeathTime;
    const entriesLocked = dom.setLockEntries ? dom.setLockEntries.checked : game.config.entriesLocked;
    const autoIncreaseBids = dom.setAutoIncrease ? dom.setAutoIncrease.checked : game.config.autoIncreaseBids;
    const autoIncreaseGoal = dom.setAutoIncreaseGoal ? Math.max(1, parseFloat(dom.setAutoIncreaseGoal.value) || 10.0) : game.config.autoIncreaseGoal;
    const autoIncreaseStep = dom.setAutoIncreaseStep ? Math.max(1, parseInt(dom.setAutoIncreaseStep.value) || 250) : game.config.autoIncreaseStep;
    
    const payload = { minBid, roundTime, gameMode, snipeDelayEnabled, snipeDelayTime, shuffleModeEnabled, suddenDeathEnabled, suddenDeathTime, entriesLocked, autoIncreaseBids, autoIncreaseGoal, autoIncreaseStep };
    
    if (game.ws && game.ws.readyState === WebSocket.OPEN) {
        game.ws.send(JSON.stringify({
            type: "settings_update",
            data: payload
        }));
    } else {
        applySettingsUpdate(payload);
    }
}

function sendDiscordConfigUpdate() {
    const url = dom.setDiscordUrl ? dom.setDiscordUrl.value.trim() : "";
    const enabled = dom.setDiscordEnabled ? dom.setDiscordEnabled.checked : false;
    
    if (game.ws && game.ws.readyState === WebSocket.OPEN) {
        game.ws.send(JSON.stringify({
            type: "discord_config_update",
            data: { url, enabled }
        }));
    }
}

function applySettingsUpdate(data) {
    game.config.minBid = data.minBid;
    game.config.roundTime = data.roundTime;
    game.config.gameMode = data.gameMode;
    
    if (data.entriesLocked !== undefined) {
        game.config.entriesLocked = data.entriesLocked;
        if (dom.setLockEntries) dom.setLockEntries.checked = data.entriesLocked;
        if (dom.lockedBadgeContainer) {
            if (data.entriesLocked) {
                dom.lockedBadgeContainer.classList.remove('hidden');
            } else {
                dom.lockedBadgeContainer.classList.add('hidden');
            }
        }
    }
    
    if (data.snipeDelayEnabled !== undefined) {
        game.config.snipeDelayEnabled = data.snipeDelayEnabled;
        if (dom.setSnipeDelay) dom.setSnipeDelay.checked = data.snipeDelayEnabled;
        
        const snipeOnlyElements = document.querySelectorAll('.snipe-only');
        snipeOnlyElements.forEach(el => {
            if (data.snipeDelayEnabled) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }
    if (data.snipeDelayTime !== undefined) {
        game.config.snipeDelayTime = data.snipeDelayTime;
        if (dom.setSnipeTime) dom.setSnipeTime.value = data.snipeDelayTime;
    }

    if (data.shuffleModeEnabled !== undefined) {
        game.config.shuffleModeEnabled = data.shuffleModeEnabled;
        if (dom.setShuffleMode) dom.setShuffleMode.checked = data.shuffleModeEnabled;
        
        const wheelWrapper = document.querySelector('.wheel-outer-wrapper');
        const shuffleWrapper = document.getElementById('shuffle-grid-outer-wrapper');
        if (game.config.shuffleModeEnabled) {
            if (wheelWrapper) wheelWrapper.classList.add('hidden');
            if (shuffleWrapper) shuffleWrapper.classList.remove('hidden');
        } else {
            if (wheelWrapper) wheelWrapper.classList.remove('hidden');
            if (shuffleWrapper) shuffleWrapper.classList.add('hidden');
        }
    }

    if (data.suddenDeathEnabled !== undefined) {
        game.config.suddenDeathEnabled = data.suddenDeathEnabled;
        if (dom.setSuddenDeath) dom.setSuddenDeath.checked = data.suddenDeathEnabled;
        
        const elements = document.querySelectorAll('.sudden-death-only');
        elements.forEach(el => {
            if (data.suddenDeathEnabled) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }
    if (data.suddenDeathTime !== undefined) {
        game.config.suddenDeathTime = data.suddenDeathTime;
        if (dom.setSuddenDeathTime) dom.setSuddenDeathTime.value = data.suddenDeathTime;
    }
    
    if (data.autoIncreaseBids !== undefined) {
        game.config.autoIncreaseBids = data.autoIncreaseBids;
        if (dom.setAutoIncrease) dom.setAutoIncrease.checked = data.autoIncreaseBids;
        
        const autoElements = document.querySelectorAll('.auto-increase-only');
        autoElements.forEach(el => {
            if (data.autoIncreaseBids) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }

    if (data.autoIncreaseGoal !== undefined) {
        game.config.autoIncreaseGoal = data.autoIncreaseGoal;
        if (dom.setAutoIncreaseGoal) dom.setAutoIncreaseGoal.value = data.autoIncreaseGoal;
    }

    if (data.autoIncreaseStep !== undefined) {
        game.config.autoIncreaseStep = data.autoIncreaseStep;
        if (dom.setAutoIncreaseStep) dom.setAutoIncreaseStep.value = data.autoIncreaseStep;
    }
    
    // Sync input values if they exist on this client
    if (dom.setMinBid) dom.setMinBid.value = data.minBid;
    if (dom.setRoundTime) dom.setRoundTime.value = data.roundTime;
    if (dom.setGameMode) dom.setGameMode.value = data.gameMode;
    
    // Update display widgets
    dom.statMinBid.textContent = game.config.minBid;
    dom.centerBidAmount.textContent = game.config.minBid;
    updateRevenueGoalWidget();
    
    if (game.state === 'idle') {
        game.timer = game.config.roundTime;
        updateTimerDisplay();
    }
    
    if (game.config.gameMode === 'elimination') {
        dom.modeBadge.className = 'mode-badge elimination-mode';
        dom.badgeText.textContent = 'ELIMINATION MODE';
        document.querySelectorAll('.badge-icon').forEach(el => el.textContent = '💀');
    } else {
        dom.modeBadge.className = 'mode-badge winner-mode';
        dom.badgeText.textContent = 'WINNER MODE';
        document.querySelectorAll('.badge-icon').forEach(el => el.textContent = '🏆');
    }
    
    recalculateCoinsAndPlayers();
}

function getRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomParam = urlParams.get('room');
    if (roomParam && roomParam.trim()) {
        return roomParam.trim();
    }
    
    // Check if a saved key exists in localStorage
    const savedKey = localStorage.getItem('roulette_license_key');
    if (savedKey && savedKey.trim()) {
        return 'room_' + savedKey.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    }
    
    // Fallback: generate a persistent session room ID
    let persistentRoom = localStorage.getItem('roulette_room_id');
    if (!persistentRoom) {
        persistentRoom = 'room_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('roulette_room_id', persistentRoom);
    }
    return persistentRoom;
}

function initOverlayConfig() {
    // Construct the overlay URL
    let cleanOrigin = window.location.origin;
    // Handle file:// opened protocol fallback
    if (window.location.protocol === 'file:') {
        cleanOrigin = 'http://127.0.0.1:8001';
    }
    const currentToken = new URLSearchParams(window.location.search).get('token');
    const tokenQuery = currentToken ? `token=${currentToken}&` : '';
    const roomId = getRoomId();
    const overlayLink = `${cleanOrigin}/?${tokenQuery}overlay=true&room=${encodeURIComponent(roomId)}`;
    
    if (dom.overlayUrl) {
        dom.overlayUrl.value = overlayLink;
    }
    
    if (dom.btnCopyUrl) {
        dom.btnCopyUrl.addEventListener('click', () => {
            navigator.clipboard.writeText(overlayLink).then(() => {
                const prevText = dom.btnCopyUrl.textContent;
                dom.btnCopyUrl.textContent = "Copied!";
                dom.btnCopyUrl.className = "btn btn-success";
                setTimeout(() => {
                    dom.btnCopyUrl.textContent = prevText;
                    dom.btnCopyUrl.className = "btn btn-primary";
                }, 2000);
            }).catch(err => {
                console.error("Copy failed, selecting text instead:", err);
                dom.overlayUrl.select();
            });
        });
    }
    
    // Auto transparent background and remove gear icon & stats widget if overlay URL parameter is set
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('overlay') === 'true') {
        document.body.classList.add('transparent-bg');
        if (dom.drawerToggle) {
            dom.drawerToggle.style.display = 'none';
        }
        const topLeftWidget = document.getElementById('top-left-stats-widget');
        if (topLeftWidget) {
            topLeftWidget.remove();
        }
        const bottomLeftWidget = document.getElementById('bottom-left-stats-widget');
        if (bottomLeftWidget) {
            bottomLeftWidget.remove();
        }
    }
}

// --- 5. WebSocket Connection & Event Routing ---
function connectWebSocket() {
    const roomId = getRoomId();
    let wsUrl;
    if (window.location.protocol === 'file:') {
        // If opened as a local file, connect to local server on port 8001
        wsUrl = `ws://127.0.0.1:8001/ws?token=${token}&room=${encodeURIComponent(roomId)}`;
    } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws?token=${token}&room=${encodeURIComponent(roomId)}`;
    }
    
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    game.ws = new WebSocket(wsUrl);
    
    game.ws.onopen = () => {
        console.log("WebSocket connected.");
        addLog("Server connection established.", "info");
    };
    
    game.ws.onclose = () => {
        console.log("WebSocket closed. Reconnecting in 3s...");
        addLog("Server disconnected. Reconnecting...", "info");
        dom.statusIndicator.className = "status-indicator disconnected";
        dom.statusText.textContent = "Disconnected";
        dom.btnConnect.disabled = false;
        dom.btnDisconnect.disabled = true;
        setTimeout(connectWebSocket, 3000);
    };
    
    game.ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
    
    game.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
    };
}

function handleServerMessage(msg) {
    if (msg.type === "logout") {
        alert(msg.message || "Your license key was paused or reset by an administrator.");
        window.location.href = "/";
        return;
    }
    if (msg.type === "status") {
        // TikTok stream connection status update
        const status = msg.status;
        dom.statusIndicator.className = `status-indicator ${status}`;
        
        if (status === "disconnected") {
            dom.statusText.textContent = "Disconnected";
            dom.btnConnect.disabled = false;
            dom.btnDisconnect.disabled = true;
            addLog("Disconnected from TikTok Live.", "info");
        } else if (status === "connecting") {
            dom.statusText.textContent = `Connecting to @${msg.username}...`;
            dom.btnConnect.disabled = true;
            dom.btnDisconnect.disabled = false;
        } else if (status === "connected") {
            dom.statusText.textContent = `Connected: @${msg.username}`;
            dom.btnConnect.disabled = true;
            dom.btnDisconnect.disabled = false;
            addLog(`Connected to TikTok Live stream: @${msg.username}`, "info");
        }
        
        if (msg.error) {
            addLog(`Error: ${msg.error}`, "info");
            alert(`Failed to connect to TikTok Live: ${msg.error}`);
        }

        // Populate Discord Webhook settings from server
        if (msg.discord_webhook_url !== undefined && dom.setDiscordUrl) {
            dom.setDiscordUrl.value = msg.discord_webhook_url || "";
        }
        if (msg.discord_webhook_enabled !== undefined && dom.setDiscordEnabled) {
            dom.setDiscordEnabled.checked = msg.discord_webhook_enabled;
        }
    } 
    else if (msg.type === "gift") {
        const giftData = msg.data;
        const giftCoins = Math.max(1, parseInt(giftData.coins) || 1);
        
        // Calculate the difference in streak to support spammed/streaked gifts in real-time
        let streakKey = `${giftData.uniqueId}_${giftData.giftName}`;
        let currentStreak = giftData.streak || 1;
        let lastStreak = game.activeStreaks[streakKey];
        
        let multiplier = 1;
        
        if (giftData.streak && giftData.streak > 1) {
            if (!lastStreak || currentStreak <= lastStreak.count || (Date.now() - lastStreak.time > 8000)) {
                // New streak started or reset
                multiplier = currentStreak;
            } else {
                // Continuation of existing streak
                multiplier = currentStreak - lastStreak.count;
            }
            if (multiplier < 1) multiplier = 1;
            
            // Update active streak record
            game.activeStreaks[streakKey] = {
                count: currentStreak,
                time: Date.now()
            };
        } else {
            multiplier = 1;
        }
        
        const totalCoins = giftCoins * multiplier;
        addLog(`🎁 ${giftData.nickname} sent ${giftData.giftName} (🪙 ${giftCoins}) x${multiplier} [Total: 🪙 ${totalCoins}]`, 'gift');
        registerPlayerBid(giftData.uniqueId, giftData.nickname, giftData.avatar, totalCoins, giftData.giftName);
    }
    else if (msg.type === "chat") {
        const chatData = msg.data;
        addLog(`${chatData.uniqueId}: ${chatData.comment}`, 'chat');
        
        // Chat joining support
        if (game.config.chatJoinEnabled) {
            const commentClean = chatData.comment.trim().toLowerCase();
            if (commentClean === game.config.joinKeyword) {
                // Register player with minBid as value
                registerPlayerBid(chatData.uniqueId, chatData.nickname, chatData.avatar, game.config.minBid, "Chat Join");
            }
        }
    }
    else if (msg.type === "settings_update") {
        applySettingsUpdate(msg.data);
    }
    else if (msg.type === "reset_game") {
        resetGame();
    }
    else if (msg.type === "toggle_pause") {
        togglePause();
    }
    else if (msg.type === "trigger_spin") {
        triggerSpin(msg.data.winnerIndex);
    }
    else if (msg.type === "dismiss_announcement") {
        dismissAnnouncement();
    }
    else if (msg.type === "discord_config_update") {
        const configData = msg.data;
        if (dom.setDiscordUrl && configData.url !== undefined) {
            dom.setDiscordUrl.value = configData.url || "";
        }
        if (dom.setDiscordEnabled && configData.enabled !== undefined) {
            dom.setDiscordEnabled.checked = configData.enabled;
        }
    }
}

// --- 6. Core Game Logic (Timer, Bids, Spin, Win) ---

function registerPlayerBid(uniqueId, nickname, avatarUrl, coins, giftName) {
    if (game.config.entriesLocked) {
        addLog(`🔒 Entry ignored from ${nickname} (@${uniqueId}) - ENTRIES ARE LOCKED.`, 'warning');
        return;
    }

    // Queue bids received while spinning or showing results
    if (game.state === 'spinning' || game.state === 'result') {
        game.bidQueue.push({ uniqueId, nickname, avatarUrl, coins, giftName });
        addLog(`📥 Queueing bid from ${nickname} (🪙 ${coins}) [Wheel Busy]`, 'info');
        return;
    }

    // Look for existing player in unique registry (caches color/avatar/accumulated coins)
    let player = game.players.find(p => p.uniqueId === uniqueId);
    
    if (!player) {
        const color = game.wheel.shades[game.players.length % game.wheel.shades.length];
        const frames = ['#89cffd', '#fcd3a1', '#ffc0cb', '#87ceeb', '#ffb3ba', '#baffc9'];
        const frameColor = frames[game.players.length % frames.length];
        
        player = {
            uniqueId: uniqueId,
            nickname: nickname,
            color: color,
            frameColor: frameColor,
            avatarUrl: avatarUrl,
            avatarImg: null,
            accumulatedCoins: 0
        };
        
        game.players.push(player);
        
        // Pre-load avatar through CORS proxy
        if (avatarUrl) {
            const proxiedUrl = `/avatar?token=${token}&url=${encodeURIComponent(avatarUrl)}`;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = proxiedUrl;
            img.onload = () => {
                player.avatarImg = img;
                syncStatsDisplay();
            };
            img.onerror = () => {
                console.log(`Failed proxy image load, fallback to initials for @${uniqueId}`);
            };
        }
    }

    // Accumulate the newly received coins
    player.accumulatedCoins = (player.accumulatedCoins || 0) + coins;

    // Immediately track cumulative total coins gifted for this round
    game.totalCoinsEarnedThisRound = (game.totalCoinsEarnedThisRound || 0) + coins;
    updateRevenueGoalWidget();

    // Check if we can add entries based on the updated accumulated coins
    const entriesToAdd = Math.floor(player.accumulatedCoins / game.config.minBid);
    if (entriesToAdd <= 0) {
        // Log the partial accumulation
        addLog(`🪙 ${player.nickname} accumulated ${player.accumulatedCoins}/${game.config.minBid} coins.`, 'info');
        return; 
    }

    // Play coin audio effect
    audio.playCoin();
    
    // Update center display info with entries gained (guarded)
    if (dom.centerGiftCount) {
        dom.centerGiftCount.textContent = entriesToAdd;
    }
    // Animate center heart
    dom.wheelCenter.classList.add('pulse');
    setTimeout(() => dom.wheelCenter.classList.remove('pulse'), 300);

    // Deduct the coins used for entries
    player.accumulatedCoins -= entriesToAdd * game.config.minBid;
    
    // If we are in the snipe countdown or paused snipe state, interrupt it because a new player entered!
    const isNewPlayerSnipe = ((game.state === 'snipe_countdown' || game.state === 'paused_snipe') && game.snipeTargetChampion && uniqueId !== game.snipeTargetChampion.uniqueId);
    if (isNewPlayerSnipe) {
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.timerInterval = null;
        game.snipeTargetChampion = null;
        game.state = 'idle';
        addLog(`🎯 SNIPE SUCCESSFUL! ${nickname} joined the wheel to challenge! Resuming auction.`, 'info');
    }
    
    // Track cumulative total coins gifted for this round
    game.totalCoinsEarnedThisRound = (game.totalCoinsEarnedThisRound || 0) + (entriesToAdd * game.config.minBid);
    
    // Add equal-sized slices (entries) for the player.
    // Each entry costs exactly game.config.minBid coins at the time it was entered.
    for (let i = 0; i < entriesToAdd; i++) {
        game.entries.push({
            id: Math.random().toString(36).substring(2, 9),
            player: player,
            coins: game.config.minBid
        });
    }
    
    recalculateCoinsAndPlayers();
    
    // Get unique players currently on the wheel to auto-start countdown
    const uniquePlayerIds = new Set(game.entries.map(e => e.player.uniqueId));
    
    if (uniquePlayerIds.size > 2 && game.suddenDeathTriggered) {
        game.suddenDeathTriggered = false;
        if (game.state === 'sudden_death_countdown') {
            game.state = 'countdown';
            updateTimerDisplay();
            addLog(`⚡ Sudden Death cancelled because a 3rd player joined! Resuming normal auction.`, 'info');
        }
    }

    if (game.state === 'idle' && uniquePlayerIds.size >= 2) {
        startCountdown();
    }
}

function recalculateCoinsAndPlayers() {
    game.totalCoins = game.entries.reduce((sum, entry) => sum + (entry.coins || game.config.minBid), 0);
    syncStatsDisplay();
}

function syncStatsDisplay() {
    const uniquePlayerIds = new Set(game.entries.map(e => e.player.uniqueId));
    dom.statPlayers.textContent = uniquePlayerIds.size;
    dom.statCoins.textContent = game.totalCoins;
    
    if (dom.widgetTotalParticipants) dom.widgetTotalParticipants.textContent = uniquePlayerIds.size;
    if (dom.widgetTotalCoins) dom.widgetTotalCoins.textContent = game.totalCoins;
    
    updateRevenueGoalWidget();
    updatePlayersListUI();
}

function updateRevenueGoalWidget() {
    if (!dom.widgetRevenueText || !dom.widgetRevenueProgress) return;
    
    const totalEarnings = (game.totalCoinsEarnedThisRound || 0) * 0.0105;
    const dollarGoal = Math.max(1, parseFloat(game.config.autoIncreaseGoal) || 10.0);
    const progressPct = Math.min(100, Math.max(0, (totalEarnings / dollarGoal) * 100));
    
    dom.widgetRevenueText.textContent = `$${totalEarnings.toFixed(2)} / $${dollarGoal.toFixed(2)}`;
    dom.widgetRevenueProgress.style.width = `${progressPct.toFixed(1)}%`;
}

function checkAutoIncreaseBids() {
    if (!game.config.autoIncreaseBids) return;
    
    const totalEarnings = (game.totalCoinsEarnedThisRound || 0) * 0.0105;
    const dollarGoal = Math.max(1, parseFloat(game.config.autoIncreaseGoal) || 10.0);
    const stepCoins = Math.max(1, parseInt(game.config.autoIncreaseStep) || 250);
    
    // Each completed round triggers at most 1 price step increase if dollar goal was met
    if (totalEarnings >= dollarGoal && !game.roundAutoIncreased) {
        game.roundAutoIncreased = true;
        
        const newMinBid = game.config.minBid + stepCoins;
        game.config.minBid = newMinBid;
        
        if (dom.setMinBid) dom.setMinBid.value = newMinBid;
        
        sendSettingsUpdate();
        
        addLog(`🚀 REVENUE GOAL MET ($${totalEarnings.toFixed(2)})! Min bid increased by +${stepCoins} to 🪙 ${newMinBid} coins for next round!`, 'warning');
    }
}

function updatePlayersListUI() {
    if (!dom.playersSidebar || !dom.playersList) return;

    if (game.entries.length === 0) {
        dom.playersSidebar.classList.add('hidden');
        dom.playersList.innerHTML = '';
        return;
    }

    const playerMap = {};
    for (const entry of game.entries) {
        const uid = entry.player.uniqueId;
        if (!playerMap[uid]) {
            playerMap[uid] = {
                player: entry.player,
                count: 0
            };
        }
        playerMap[uid].count++;
    }

    const sortedPlayers = Object.values(playerMap).sort((a, b) => b.count - a.count);
    dom.playersSidebar.classList.remove('hidden');

    let listHTML = '';
    const totalEntries = game.entries.length;

    for (const item of sortedPlayers) {
        const percentage = Math.round((item.count / totalEntries) * 100);
        const player = item.player;

        let avatarHTML = '';
        if (player.avatarImg && player.avatarImg.complete) {
            avatarHTML = `<img src="${player.avatarImg.src}" alt="${player.nickname}" class="player-avatar">`;
        } else if (player.avatarUrl) {
            const proxiedUrl = `/avatar?token=${token}&url=${encodeURIComponent(player.avatarUrl)}`;
            avatarHTML = `<img src="${proxiedUrl}" alt="${player.nickname}" class="player-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                          <div class="player-avatar-fallback" style="background-color: ${player.frameColor}">${player.nickname.substring(0, 2).toUpperCase()}</div>`;
        } else {
            avatarHTML = `<div class="player-avatar-fallback" style="background-color: ${player.frameColor}">${player.nickname.substring(0, 2).toUpperCase()}</div>`;
        }

        const sliceText = item.count === 1 ? 'slice' : 'slices';
        const isTargeted = (game.nextWinnerId === player.uniqueId);
        const targetedClass = isTargeted ? ' targeted-winner' : '';

        listHTML += `
            <div class="player-list-item${targetedClass}" data-uid="${player.uniqueId}">
                <div class="player-avatar-wrapper" style="border-color: ${player.frameColor}">
                    ${avatarHTML}
                </div>
                <div class="player-info">
                    <span class="player-name">${player.nickname}</span>
                    <span class="player-stats">${item.count} ${sliceText}</span>
                </div>
                <span class="player-probability">${percentage}%</span>
            </div>
        `;
    }

    dom.playersList.innerHTML = listHTML;
    renderShuffleGrid();
}

function startCountdown(duration) {
    if (game.timerInterval) clearInterval(game.timerInterval);
    stopTimerBlinking();
    
    if (game.state !== 'sudden_death_countdown') {
        game.state = 'countdown';
    }
    game.timer = duration !== undefined ? duration : game.config.roundTime;
    updateTimerDisplay();
    
    if (dom.btnPauseTimer) {
        dom.btnPauseTimer.textContent = "Pause Timer";
        dom.btnPauseTimer.className = "btn btn-secondary";
        dom.btnPauseTimer.disabled = false;
    }
    
    processBidQueue();
    
    game.timerInterval = setInterval(() => {
        game.timer--;
        updateTimerDisplay();
        
        if (game.timer <= 0) {
            clearInterval(game.timerInterval);
            
            // Only the controller client triggers and broadcasts the spin to prevent duplicates
            if (!isOverlayMode) {
                const winnerIdx = determineWinnerIndex();
                if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                    game.ws.send(JSON.stringify({
                        type: "trigger_spin",
                        data: { winnerIndex: winnerIdx }
                    }));
                } else {
                    triggerSpin(winnerIdx);
                }
            }
        }
    }, 1000);
    
    addLog(`Round countdown started. duration: ${game.timer}s.`, 'info');
}

function updateTimerDisplay() {
    let formattedTimer = "";
    if (game.state === 'snipe_countdown' || game.state === 'paused_snipe') {
        dom.timerDisplay.classList.add('snipe-warning');
        dom.timerDisplay.classList.remove('sudden-death-warning');
        formattedTimer = `SNIPE: ${game.timer}s`;
        dom.timerDisplay.textContent = `SNIPE: ${game.timer}`;
    } else if (game.state === 'sudden_death_countdown' || game.state === 'paused_sudden_death') {
        dom.timerDisplay.classList.remove('snipe-warning');
        dom.timerDisplay.classList.add('sudden-death-warning');
        const mins = Math.floor(game.timer / 60);
        const secs = game.timer % 60;
        formattedTimer = `SUDDEN DEATH: ${mins}:${secs.toString().padStart(2, '0')}`;
        dom.timerDisplay.textContent = formattedTimer;
    } else {
        dom.timerDisplay.classList.remove('snipe-warning');
        dom.timerDisplay.classList.remove('sudden-death-warning');
        if (game.state === 'spinning') {
            formattedTimer = "SPINNING";
            dom.timerDisplay.textContent = "SPINNING";
        } else {
            const mins = Math.floor(game.timer / 60);
            const secs = game.timer % 60;
            formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;
            dom.timerDisplay.textContent = formattedTimer;
        }
    }

    if (dom.widgetRoundTimer) {
        dom.widgetRoundTimer.textContent = formattedTimer;
    }
}

function determineWinnerIndex() {
    if (game.nextWinnerId) {
        const possibleIndices = [];
        for (let i = 0; i < game.entries.length; i++) {
            if (game.entries[i].player.uniqueId === game.nextWinnerId) {
                possibleIndices.push(i);
            }
        }
        if (possibleIndices.length > 0) {
            const chosenIdx = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
            game.nextWinnerId = null; // Consume rigging
            updatePlayersListUI(); // Clear the visual target indicator immediately
            return chosenIdx;
        }
        game.nextWinnerId = null; // Clear if player has no entries left
        updatePlayersListUI();
    }
    return Math.floor(Math.random() * game.entries.length);
}

function triggerSpin(winnerIdx) {
    if (game.timerInterval) clearInterval(game.timerInterval);
    stopTimerBlinking();
    if (dom.btnPauseTimer) dom.btnPauseTimer.disabled = true;
    
    game.state = 'spinning';
    dom.timerDisplay.textContent = "SPINNING";
    
    game.shuffleGridPrevStep = -1;
    game.shuffleGridActiveIndex = -1;
    
    // Calculate exact target angle based on winner index (equal-sized slices)
    const sliceAngle = (2 * Math.PI) / game.entries.length;
    const localCenterAngle = winnerIdx * sliceAngle + sliceAngle / 2;
    
    // Target angle aligns slice center to -Math.PI / 2 (pointer at 12 o'clock)
    const targetAngle = -Math.PI / 2 - localCenterAngle;
    
    // Spin 4 full rotations minimum
    const minRotations = 4 * 2 * Math.PI;
    const currentNormalized = game.wheel.angle;
    let finalAngle = targetAngle;
    while (finalAngle < currentNormalized + minRotations) {
        finalAngle += 2 * Math.PI;
    }
    
    // Add natural wide offset within slice to make landing positions look organic and close to the lines (creating suspense)
    const randomOffsetInsideSlice = (Math.random() - 0.5) * sliceAngle * 0.85;
    finalAngle += randomOffsetInsideSlice;
    
    // Easing variables
    game.wheel.spinStartAngle = game.wheel.angle;
    game.wheel.spinTargetAngle = finalAngle;
    game.wheel.spinStartTime = Date.now();
    game.wheel.spinDuration = 5500; // 5.5s duration
    game.wheel.winningEntryIdx = winnerIdx;
    game.wheel.prevTickerSectorIndex = -1;
    
    addLog(`Wheel is spinning! Selected slice: ${winnerIdx} (Player: ${game.entries[winnerIdx].player.nickname})`, "info");
}

function resolveSpinResult(winningEntryIndex) {
    game.state = 'result';
    
    // Evaluate if revenue goal milestone was hit and increase min bid for subsequent bids/rounds post-spin
    checkAutoIncreaseBids();
    
    const winningEntry = game.entries[winningEntryIndex];
    if (!winningEntry) {
        resetGame();
        return;
    }
    
    const winnerPlayer = winningEntry.player;
    const isElimination = (game.config.gameMode === 'elimination');
    
    if (isElimination) {
        audio.playEliminate();
        
        // Show entry elimination announcement
        dom.announcementTitle.textContent = "ENTRY ELIMINATED! 💀";
        dom.announcementTitle.style.color = "#ff2d55";
        dom.announcementName.textContent = winnerPlayer.nickname;
        dom.announcementDetail.textContent = `One of their entry slices was eliminated from the wheel.`;
        
        // Fallback for avatar
        if (winnerPlayer.avatarImg && winnerPlayer.avatarImg.complete) {
            dom.announcementAvatar.src = winnerPlayer.avatarImg.src;
        } else {
            // Placeholder base64 image or initials
            dom.announcementAvatar.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='48' fill='%232c2c35'/><text x='50%' y='55%' font-family='Arial' font-size='26' fill='white' text-anchor='middle' dominant-baseline='middle'>" + winnerPlayer.nickname.substring(0,2).toUpperCase() + "</text></svg>";
        }
        
        dom.announcementBanner.classList.remove('hidden');
        addLog(`💀 ELIMINATED SLICE: ${winnerPlayer.nickname} (@${winnerPlayer.uniqueId})`, 'info');
        
        setTimeout(() => {
            dom.announcementBanner.classList.add('hidden');
            
            // Remove ONLY this specific entry from the wheel array
            game.entries.splice(winningEntryIndex, 1);
            recalculateCoinsAndPlayers();
            
            // Process queued bids before checking if game continues
            game.state = 'idle';
            processBidQueue();
            
            // Count unique players left on the wheel
            const remainingUniquePlayers = new Set(game.entries.map(e => e.player.uniqueId));
            
            if (remainingUniquePlayers.size === 1) {
                // Only 1 player left on the wheel, they are the grand champion!
                const championId = Array.from(remainingUniquePlayers)[0];
                const champion = game.players.find(p => p.uniqueId === championId);
                if (game.config.snipeDelayEnabled) {
                    startSnipeCountdown(champion);
                } else {
                    declareGrandChampion(champion);
                }
            } else if (remainingUniquePlayers.size === 2 && game.config.suddenDeathEnabled && !game.suddenDeathTriggered) {
                game.suddenDeathTriggered = true;
                triggerSuddenDeath();
            } else if (remainingUniquePlayers.size > 1) {
                // Resume countdown for remaining players
                startCountdown();
            } else {
                // No entries left
                resetGame();
            }
        }, 1000);
        
    } else {
        // Winner Mode - round completed!
        checkAutoIncreaseBids();
        audio.playWin();
        confetti.start();
        
        dom.announcementTitle.textContent = "ROUND WINNER! 🏆";
        dom.announcementTitle.style.color = "#ffd83b";
        dom.announcementName.textContent = winnerPlayer.nickname;
        dom.announcementDetail.textContent = `Won the jackpot with their entry!`;
        
        if (winnerPlayer.avatarImg && winnerPlayer.avatarImg.complete) {
            dom.announcementAvatar.src = winnerPlayer.avatarImg.src;
        } else {
            dom.announcementAvatar.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='48' fill='%232c2c35'/><text x='50%' y='55%' font-family='Arial' font-size='26' fill='white' text-anchor='middle' dominant-baseline='middle'>" + winnerPlayer.nickname.substring(0,2).toUpperCase() + "</text></svg>";
        }
        
        dom.announcementBanner.classList.remove('hidden');
        addLog(`🏆 WINNER: ${winnerPlayer.nickname} (@${winnerPlayer.uniqueId})`, 'info');
        
        // Winner remains on screen until dismissed by streamer
    }
}

function triggerSuddenDeath() {
    game.state = 'sudden_death_popup';
    
    dom.announcementTitle.textContent = "⚡ SUDDEN DEATH! ⚡";
    dom.announcementTitle.style.color = "#ff9500"; // Vibrant neon orange
    dom.announcementName.textContent = "THE FINAL DUEL";
    
    const mins = Math.floor(game.config.suddenDeathTime / 60);
    const secs = game.config.suddenDeathTime % 60;
    const timeStr = secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}m`;
    dom.announcementDetail.textContent = `Timer set to ${timeStr}. Send gifts to secure your slices!`;
    
    // Hide avatar element for generic announcement
    const avatarImg = dom.announcementAvatar;
    if (avatarImg) avatarImg.style.display = 'none';
    
    dom.announcementBanner.classList.remove('hidden');
    addLog(`⚡ SUDDEN DEATH TRIGGERED! Only 2 players remain. Timer set to ${game.config.suddenDeathTime}s.`, 'warning');
    
    // Play a warning sound
    audio.playEliminate();
    
    setTimeout(() => {
        dom.announcementBanner.classList.add('hidden');
        if (avatarImg) avatarImg.style.display = ''; // restore avatar display
        
        // Start countdown with custom Sudden Death Time
        startSuddenDeathCountdown();
    }, 4000);
}

function startSuddenDeathCountdown() {
    game.state = 'sudden_death_countdown';
    startCountdown(game.config.suddenDeathTime);
}

function declareGrandChampion(champion) {
    checkAutoIncreaseBids();
    audio.playWin();
    confetti.start();
    
    dom.announcementTitle.textContent = "WINNER! 🏆";
    dom.announcementTitle.style.color = "#ffd700";
    dom.announcementName.textContent = champion.nickname;
    dom.announcementDetail.textContent = `Survived all eliminations and won the crown!`;
    
    if (champion.avatarImg && champion.avatarImg.complete) {
        dom.announcementAvatar.src = champion.avatarImg.src;
    } else {
        dom.announcementAvatar.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='48' fill='%232c2c35'/><text x='50%' y='55%' font-family='Arial' font-size='26' fill='white' text-anchor='middle' dominant-baseline='middle'>" + champion.nickname.substring(0,2).toUpperCase() + "</text></svg>";
    }
    
    dom.announcementBanner.classList.remove('hidden');
    addLog(`👑 WINNER: ${champion.nickname} (@${champion.uniqueId})`, 'info');
    
    // Winner remains on screen until dismissed by streamer
}

function startSnipeCountdown(champion) {
    if (game.timerInterval) clearInterval(game.timerInterval);
    stopTimerBlinking();
    
    game.state = 'snipe_countdown';
    game.snipeTargetChampion = champion;
    game.timer = game.config.snipeDelayTime;
    updateTimerDisplay();
    
    if (dom.btnPauseTimer) {
        dom.btnPauseTimer.textContent = "Pause Timer";
        dom.btnPauseTimer.className = "btn btn-secondary";
        dom.btnPauseTimer.disabled = false;
    }
    
    addLog(`⚠️ Snipe window active! ${champion.nickname} survives unless someone joins in ${game.timer}s!`, 'info');
    
    game.timerInterval = setInterval(() => {
        game.timer--;
        updateTimerDisplay();
        
        if (game.timer <= 0) {
            clearInterval(game.timerInterval);
            game.timerInterval = null;
            
            declareGrandChampion(champion);
        }
    }, 1000);
}

function resetGame() {
    if (game.timerInterval) clearInterval(game.timerInterval);
    stopTimerBlinking();
    
    game.players = [];
    game.entries = [];
    game.totalCoins = 0;
    game.state = 'idle';
    game.timer = game.config.roundTime;
    game.wheel.angle = 0;
    game.wheel.spinVelocity = 0;
    game.shuffleGridActiveIndex = -1;
    game.snipeTargetChampion = null;
    game.suddenDeathTriggered = false;
    game.roundAutoIncreased = false;
    game.totalCoinsEarnedThisRound = 0;
    
    dom.btnPauseTimer.textContent = "Pause Timer";
    dom.btnPauseTimer.className = "btn btn-secondary";
    dom.btnPauseTimer.disabled = true;
    confetti.stop();
    dom.announcementBanner.classList.add('hidden');
    
    if (dom.centerGiftCount) {
        dom.centerGiftCount.textContent = "0";
    }
    updateTimerDisplay();
    syncStatsDisplay();
    addLog("Game has been reset.", 'info');
    
    processBidQueue();
}

function processBidQueue() {
    if (game.bidQueue && game.bidQueue.length > 0) {
        addLog(`📤 Processing ${game.bidQueue.length} queued bids...`, 'info');
        const queueToProcess = [...game.bidQueue];
        game.bidQueue = [];
        
        for (const bid of queueToProcess) {
            registerPlayerBid(bid.uniqueId, bid.nickname, bid.avatarUrl, bid.coins, bid.giftName);
        }
    }
}

// --- Pause/Resume and blinking helpers ---
let blinkingInterval = null;

function togglePause() {
    if (game.state === 'countdown' || game.state === 'sudden_death_countdown') {
        // Pause active countdown
        if (game.timerInterval) clearInterval(game.timerInterval);
        const wasSuddenDeath = (game.state === 'sudden_death_countdown');
        game.state = wasSuddenDeath ? 'paused_sudden_death' : 'paused';
        if (dom.btnPauseTimer) {
            dom.btnPauseTimer.textContent = "Resume Timer";
            dom.btnPauseTimer.className = "btn btn-primary"; // gold highlight to resume
        }
        addLog(wasSuddenDeath ? "Sudden Death timer PAUSED." : "Auction timer PAUSED.", "info");
        startTimerBlinking();
    } else if (game.state === 'paused' || game.state === 'paused_sudden_death') {
        // Resume countdown
        const wasSuddenDeath = (game.state === 'paused_sudden_death');
        game.state = wasSuddenDeath ? 'sudden_death_countdown' : 'countdown';
        if (dom.btnPauseTimer) {
            dom.btnPauseTimer.textContent = "Pause Timer";
            dom.btnPauseTimer.className = "btn btn-secondary";
        }
        addLog(wasSuddenDeath ? "Sudden Death timer RESUMED." : "Auction timer RESUMED.", "info");
        stopTimerBlinking();
        
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.timerInterval = setInterval(() => {
            game.timer--;
            updateTimerDisplay();
            
            if (game.timer <= 0) {
                clearInterval(game.timerInterval);
                
                if (!isOverlayMode) {
                    const winnerIdx = determineWinnerIndex();
                    if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                        game.ws.send(JSON.stringify({
                            type: "trigger_spin",
                            data: { winnerIndex: winnerIdx }
                        }));
                    } else {
                        triggerSpin(winnerIdx);
                    }
                }
            }
        }, 1000);
    } else if (game.state === 'snipe_countdown') {
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.state = 'paused_snipe';
        if (dom.btnPauseTimer) {
            dom.btnPauseTimer.textContent = "Resume Timer";
            dom.btnPauseTimer.className = "btn btn-primary";
        }
        addLog("Snipe timer PAUSED.", "info");
        startTimerBlinking();
    } else if (game.state === 'paused_snipe') {
        game.state = 'snipe_countdown';
        if (dom.btnPauseTimer) {
            dom.btnPauseTimer.textContent = "Pause Timer";
            dom.btnPauseTimer.className = "btn btn-secondary";
        }
        addLog("Snipe timer RESUMED.", "info");
        stopTimerBlinking();
        
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.timerInterval = setInterval(() => {
            game.timer--;
            updateTimerDisplay();
            
            if (game.timer <= 0) {
                clearInterval(game.timerInterval);
                game.timerInterval = null;
                
                declareGrandChampion(game.snipeTargetChampion);
            }
        }, 1000);
    }
}

function startTimerBlinking() {
    if (blinkingInterval) clearInterval(blinkingInterval);
    let visible = true;
    blinkingInterval = setInterval(() => {
        visible = !visible;
        if (visible) {
            dom.timerDisplay.style.opacity = "1";
        } else {
            dom.timerDisplay.style.opacity = "0.2";
        }
    }, 500);
}

function stopTimerBlinking() {
    if (blinkingInterval) clearInterval(blinkingInterval);
    blinkingInterval = null;
    dom.timerDisplay.style.opacity = "1";
}

// --- 7. Canvas Rendering Loop (The Wheel Drawer) ---
function gameLoop() {
    // 1. Process frame-rate independent easing updates if spinning
    if (game.state === 'spinning') {
        const elapsed = Date.now() - game.wheel.spinStartTime;
        const t = Math.min(1, elapsed / game.wheel.spinDuration);
        // Quintic Ease Out for natural deceleration
        const easedT = 1 - Math.pow(1 - t, 5);
        
        if (game.config.shuffleModeEnabled) {
            updateShuffleModeSpin(easedT, t === 1);
        } else {
            game.wheel.angle = game.wheel.spinStartAngle + (game.wheel.spinTargetAngle - game.wheel.spinStartAngle) * easedT;
            checkSpinTickAudio();
        }
        
        // Stop spinning when duration completes
        if (t === 1) {
            resolveSpinResult(game.wheel.winningEntryIdx);
        }
    }
    
    // 2. Draw Wheel
    if (!game.config.shuffleModeEnabled) {
        drawWheel();
    }
    
    requestAnimationFrame(gameLoop);
}

// Math to check if a division boundary crosses the 12 o'clock pointer
function checkSpinTickAudio() {
    if (game.entries.length < 2) return;
    
    const pointerGlobalAngle = -Math.PI / 2;
    // Normalize current rotation angle to [0, 2PI]
    const currentRotatedAngle = game.wheel.angle % (2 * Math.PI);
    
    // Convert pointer position to wheel's local space
    let localPointer = (pointerGlobalAngle - currentRotatedAngle) % (2 * Math.PI);
    if (localPointer < 0) localPointer += 2 * Math.PI;
    
    // Since slices are equal-sized, divide angle directly
    const sliceAngle = (2 * Math.PI) / game.entries.length;
    const currentSectorIdx = Math.floor(localPointer / sliceAngle) % game.entries.length;
    
    if (currentSectorIdx !== game.wheel.prevTickerSectorIndex) {
        // Ticked to a new sector, trigger clicking audio!
        audio.playTick();
        game.wheel.prevTickerSectorIndex = currentSectorIdx;
    }
}

// Get the index of the player whose slice is underneath the top pointer (at 12 o'clock)
function getWinnerIndexUnderPointer() {
    if (game.entries.length === 0) return null;
    if (game.entries.length === 1) return 0;
    
    const pointerGlobalAngle = -Math.PI / 2; // top center
    const rotatedOffset = game.wheel.angle % (2 * Math.PI);
    
    // Map absolute pointer position to wheel's local coordinates
    let localPointer = (pointerGlobalAngle - rotatedOffset) % (2 * Math.PI);
    if (localPointer < 0) localPointer += 2 * Math.PI;
    
    const sliceAngle = (2 * Math.PI) / game.entries.length;
    const winningIdx = Math.floor(localPointer / sliceAngle) % game.entries.length;
    return winningIdx;
}

function drawWheel() {
    const ctx = game.wheel.ctx;
    const canvas = game.wheel.canvas;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 15;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save state for global rotation
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(game.wheel.angle);
    ctx.translate(-cx, -cy);
    
    // Draw slices
    if (game.entries.length === 0) {
        // Empty state - Draw a beautiful golden placeholder wheel
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        const placeholderGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, radius);
        placeholderGrad.addColorStop(0, '#1c1c24');
        placeholderGrad.addColorStop(1, '#0b0b0e');
        ctx.fillStyle = placeholderGrad;
        ctx.fill();
        
        ctx.strokeStyle = '#bf953f';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Draw centered helpful text
        ctx.restore(); // Restore to normal (non-rotated) coordinate system to write horizontal text
        ctx.fillStyle = '#8e8e93';
        ctx.font = '800 16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('WAITING FOR PLAYERS', cx, cy - 85);
        ctx.fillStyle = '#bf953f';
        ctx.fillText('SEND GIFT TO JOIN WHEEL', cx, cy + 95);
        return;
    }
    
    const sliceAngle = (2 * Math.PI) / game.entries.length;
    
    for (let i = 0; i < game.entries.length; i++) {
        const entry = game.entries[i];
        const player = entry.player;
        const startAngle = i * sliceAngle;
        const endAngle = (i + 1) * sliceAngle;
        
        // 1. Draw Slice sector
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        
        // Fill slice with color
        ctx.fillStyle = player.color;
        ctx.fill();
        
        // Draw sector boundary lines (thinner if we have a lot of slices, dark gold/brown instead of white or black)
        ctx.strokeStyle = '#523d1c';
        ctx.lineWidth = Math.max(1, 4 - (game.entries.length / 50));
        ctx.stroke();
        
        // 2. Draw Text and Profile inside the slice (only if slices are not extremely tiny)
        if (sliceAngle >= 0.03) {
            ctx.save();
            
            // Calculate text positioning along the center line of the slice
            const midAngle = startAngle + sliceAngle / 2;
            ctx.translate(cx, cy);
            ctx.rotate(midAngle);
            
            const avatarRadius = Math.min(24, Math.max(10, radius * Math.sin(sliceAngle / 2) * 0.8));
            const avatarX = radius - avatarRadius - 10; // pushed closer to edge
            
            // Draw text ONLY if there is enough vertical space
            if (sliceAngle >= 0.07) {
                const textX = 90; // Start writing text closer to the center circle
                const verticalLimit = Math.floor(145 * sliceAngle * 0.9);
                
                // Set dynamic font size based on slice thickness to prevent overlapping
                let fontSize = 32;
                if (sliceAngle < 0.15) fontSize = 15;
                else if (sliceAngle < 0.25) fontSize = 18;
                else if (sliceAngle < 0.45) fontSize = 20;
                else if (sliceAngle < 0.8) fontSize = 26;
                
                fontSize = Math.min(fontSize, verticalLimit);
                fontSize = Math.max(10, fontSize); // absolute minimum font size to remain legible

                ctx.font = `900 ${fontSize}px Outfit`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                // Determine maximum horizontal text width (leave a 10px gap before the avatar)
                const maxTextWidth = avatarX - avatarRadius - 10 - textX;

                // Adjust text size and content dynamically to fit the slice horizontally
                let currentText = player.nickname;
                let textWidth = ctx.measureText(currentText).width;

                // First try to shrink font size down to 10px
                while (textWidth > maxTextWidth && fontSize > 10) {
                    fontSize--;
                    ctx.font = `900 ${fontSize}px Outfit`;
                    textWidth = ctx.measureText(currentText).width;
                }

                // If it still doesn't fit, truncate text and add ellipsis
                if (textWidth > maxTextWidth) {
                    while (currentText.length > 0 && textWidth > maxTextWidth) {
                        currentText = currentText.slice(0, -1);
                        textWidth = ctx.measureText(currentText + '...').width;
                    }
                    currentText = currentText + '...';
                }

                // Draw player nickname
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = Math.min(4, Math.max(2, fontSize / 4)); // scale outline with font size
                
                // Draw outline stroke first for maximum readability, then fill text
                ctx.strokeText(currentText, textX, 0);
                ctx.fillText(currentText, textX, 0);
                
                // Remove text shadow for avatar drawing
                ctx.shadowBlur = 0;
            }
            
            // 3. Draw Player Profile Image Circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, 0, avatarRadius, 0, 2 * Math.PI);
            ctx.closePath();
            
            // Create circular clipping path for profile photo
            ctx.clip();
            
            if (player.avatarImg && player.avatarImg.complete) {
                ctx.drawImage(player.avatarImg, avatarX - avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
            } else {
                // Fallback: Fill circle with the player's custom frame color (pastel)
                ctx.fillStyle = player.frameColor;
                ctx.fillRect(avatarX - avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
                ctx.fillStyle = '#111116'; // Dark contrasting text
                ctx.font = `bold ${Math.max(8, avatarRadius * 0.75)}px Outfit`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(player.nickname.substring(0, 2).toUpperCase(), avatarX, 0);
            }
            
            ctx.restore(); // Remove avatar clipping path
            
            // Draw custom colored frame ring border instead of white
            ctx.beginPath();
            ctx.arc(avatarX, 0, avatarRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = player.frameColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.restore(); // Restore slice rotation
        }
    }
    
    // Restore global canvas rotation
    ctx.restore();
    
    // Draw outer glowing neon gold rim overlay
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    
    const goldGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    goldGrad.addColorStop(0, '#bf953f');
    goldGrad.addColorStop(0.5, '#fcf6ba');
    goldGrad.addColorStop(1, '#aa771c');
    
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 6;
    ctx.stroke();
}

// --- 8. Event Logging Console Utilities ---
function addLog(text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `feed-entry ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${time}] ${text}`;
    
    dom.eventFeed.appendChild(entry);
    
    // Clear placeholder
    const placeholder = dom.eventFeed.querySelector('.feed-placeholder');
    if (placeholder) placeholder.remove();
    
    // Scroll to bottom
    dom.eventFeed.scrollTop = dom.eventFeed.scrollHeight;
}

function renderShuffleGrid() {
    const container = document.getElementById('shuffle-grid-container');
    if (!container) return;

    if (game.entries.length === 0) {
        container.innerHTML = `
            <div class="shuffle-grid-placeholder">
                <div class="placeholder-title">WAITING FOR PLAYERS</div>
                <div class="placeholder-desc">SEND GIFT TO JOIN GAME</div>
            </div>
        `;
        return;
    }

    const playerMap = {};
    for (const entry of game.entries) {
        const uid = entry.player.uniqueId;
        if (!playerMap[uid]) {
            playerMap[uid] = {
                player: entry.player,
                count: 0
            };
        }
        playerMap[uid].count++;
    }

    let html = '';
    game.entries.forEach((entry, index) => {
        const player = entry.player;
        const entryCount = playerMap[player.uniqueId].count;
        
        let avatarHTML = '';
        if (player.avatarImg && player.avatarImg.complete) {
            avatarHTML = `<img src="${player.avatarImg.src}" alt="${player.nickname}" class="shuffle-card-avatar">`;
        } else if (player.avatarUrl) {
            const proxiedUrl = `/avatar?token=${token}&url=${encodeURIComponent(player.avatarUrl)}`;
            avatarHTML = `<img src="${proxiedUrl}" alt="${player.nickname}" class="shuffle-card-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                          <div class="shuffle-card-fallback" style="background-color: ${player.frameColor}">${player.nickname.substring(0, 2).toUpperCase()}</div>`;
        } else {
            avatarHTML = `<div class="shuffle-card-fallback" style="background-color: ${player.frameColor}">${player.nickname.substring(0, 2).toUpperCase()}</div>`;
        }

        const isHighlighted = (game.state === 'spinning' && game.shuffleGridActiveIndex === index);
        const highlightedClass = isHighlighted ? ' highlighted' : '';
        const isTargeted = (game.nextWinnerId === player.uniqueId);
        const targetedClass = isTargeted ? ' targeted-winner' : '';

        html += `
            <div class="shuffle-card${highlightedClass}${targetedClass}" style="background-color: ${player.frameColor}" data-uid="${player.uniqueId}">
                <div class="shuffle-card-avatar-wrapper">
                    ${avatarHTML}
                </div>
                <div class="shuffle-card-info">
                    <span class="shuffle-card-name">${player.nickname}</span>
                    <span class="shuffle-card-value">${entryCount}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateShuffleModeSpin(easedT, isFinal) {
    const activeLength = game.entries.length;
    if (activeLength === 0) return;
    
    const winnerIndex = game.wheel.winningEntryIdx;
    if (winnerIndex === undefined || winnerIndex === null || winnerIndex < 0 || winnerIndex >= activeLength) return;
    
    const minSteps = 25;
    let totalSteps = Math.max(minSteps, activeLength * 3);
    const remainder = totalSteps % activeLength;
    totalSteps = totalSteps + (winnerIndex - remainder);
    if (totalSteps < minSteps) {
        totalSteps += activeLength;
    }
    
    if (isFinal) {
        game.shuffleGridActiveIndex = winnerIndex;
        updateShuffleHighlightDOM();
    } else {
        const currentStep = Math.min(totalSteps - 1, Math.floor(easedT * totalSteps));
        const currentHighlightedIdx = currentStep % activeLength;
        
        if (currentStep !== game.shuffleGridPrevStep) {
            audio.playTick();
            game.shuffleGridPrevStep = currentStep;
            game.shuffleGridActiveIndex = currentHighlightedIdx;
            updateShuffleHighlightDOM();
        }
    }
}

function updateShuffleHighlightDOM() {
    const cards = document.querySelectorAll('.shuffle-card');
    cards.forEach((card, index) => {
        if (index === game.shuffleGridActiveIndex) {
            card.classList.add('highlighted');
        } else {
            card.classList.remove('highlighted');
        }
    });
}
