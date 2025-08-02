// 豚小屋探検隊 - 完全版JavaScript（重複防止機能付き）
console.log('🐷 豚小屋探検隊 JavaScript 開始');

// Render環境の検出
const isRenderEnvironment = window.location.hostname.includes('render') || 
                           window.location.hostname.includes('onrender');
console.log('Render環境:', isRenderEnvironment);

// デバッグ用のグローバル関数
window.debugInfo = () => {
    console.log('=== デバッグ情報 ===');
    console.log('URL:', window.location.href);
    console.log('Render環境:', isRenderEnvironment);
    console.log('Socket.io 存在:', typeof io !== 'undefined');
    console.log('PigManGame インスタンス:', window.pigGame ? '存在' : '未作成');
    if (window.pigGame?.socketClient?.socket) {
        console.log('Socket ID:', window.pigGame.socketClient.socket.id);
        console.log('Socket 接続状態:', window.pigGame.socketClient.socket.connected);
        console.log('Socket Transport:', window.pigGame.socketClient.socket.io.engine.transport.name);
    }
    console.log('現在のルームID:', window.pigGame?.roomId || 'なし');
    console.log('プレイヤー名:', window.pigGame?.myName || 'なし');
    console.log('==================');
};

// ユーティリティ関数
const safeGetElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
    return element;
};

const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
        return true;
    }
    return false;
};

const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} に${event}イベント追加成功`);
        return true;
    } else {
        console.warn(`⚠️ イベント追加失敗: #${id}`);
        return false;
    }
};

// UIManager クラス
class UIManager {
    static showSpectatorMode(isSpectator) {
        const existingIndicator = document.getElementById('spectator-indicator');
        
        if (isSpectator) {
            if (!existingIndicator) {
                const indicator = document.createElement('div');
                indicator.id = 'spectator-indicator';
                indicator.className = 'spectator-indicator';
                indicator.textContent = '👁️ 観戦中';
                document.body.appendChild(indicator);
            }
            
            const gameBoard = safeGetElement('game-board');
            if (gameBoard) {
                gameBoard.classList.add('spectator-mode');
            }
            
            this.addSpectatorInfo();
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            const gameBoard = safeGetElement('game-board');
            if (gameBoard) {
                gameBoard.classList.remove('spectator-mode');
            }
            
            this.removeSpectatorInfo();
        }
    }

    static addSpectatorInfo() {
        const gameBoard = safeGetElement('game-board');
        if (!gameBoard || document.getElementById('spectator-controls')) return;

        const spectatorControls = document.createElement('div');
        spectatorControls.id = 'spectator-controls';
        spectatorControls.className = 'spectator-controls';
        spectatorControls.innerHTML = `
            <div class="spectator-info">
                観戦モード - ゲームの進行を見ることができますが、操作はできません
            </div>
        `;

        gameBoard.insertBefore(spectatorControls, gameBoard.firstChild);
    }

    static removeSpectatorInfo() {
        const spectatorControls = document.getElementById('spectator-controls');
        if (spectatorControls) {
            spectatorControls.remove();
        }
    }

    static showConnectionStatus(status) {
        console.log(`接続状態変更: ${status}`);
        const statusEl = safeGetElement('connection-status');
        if (!statusEl) return;
        
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    static showError(message, type = 'error') {
        console.log(`UI エラー表示: ${message} (タイプ: ${type})`);
        const errorEl = safeGetElement('error-message');
        if (!errorEl) return;
        
        errorEl.textContent = message;
        
        if (type === 'success') {
            errorEl.style.background = 'rgba(34, 139, 34, 0.9)';
            errorEl.style.borderColor = '#228B22';
        } else if (type === 'warning') {
            errorEl.style.background = 'rgba(255, 165, 0, 0.9)';
            errorEl.style.borderColor = '#FFA500';
        } else {
            errorEl.style.background = 'rgba(220, 20, 60, 0.9)';
            errorEl.style.borderColor = '#DC143C';
        }
        
        errorEl.style.display = 'block';
        
        const displayTime = type === 'success' ? 3000 : 8000;
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, displayTime);
    }

    static showPlayerName(name) {
        console.log(`プレイヤー名表示: ${name}`);
        const displayEl = safeGetElement('player-name-display');
        const nameEl = safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
        console.log(`ルーム一覧更新: ${rooms.length}個のルーム`);
        const container = safeGetElement('room-list-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'room-item-info';
            infoDiv.innerHTML = `
                <strong>ID: ${room.id}</strong>
                ${room.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
                <br>
                ホスト: ${room.hostName} | プレイヤー: ${room.playerCount}/10
            `;
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-small';
            joinBtn.textContent = '参加';
            joinBtn.onclick = () => {
                const roomIdInput = safeGetElement('room-id-input');
                if (roomIdInput) roomIdInput.value = room.id;
                if (room.hasPassword) {
                    const passwordGroup = safeGetElement('join-password-group');
                    if (passwordGroup) passwordGroup.style.display = 'block';
                }
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    static updateOngoingGames(games) {
        const container = safeGetElement('ongoing-games-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (games.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #32CD32;">現在進行中のゲームはありません</p>';
            return;
        }

        games.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'ongoing-game-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'ongoing-game-info';
            infoDiv.innerHTML = `
                <strong>ID: ${game.id}</strong>
                <br>
                ラウンド: ${game.currentRound}/4 | プレイヤー: ${game.playerCount}/10
                <br>
                救出: ${game.treasureFound}/${game.treasureGoal} | 罠: ${game.trapTriggered}/${game.trapGoal}
            `;
            
            const spectateBtn = document.createElement('button');
            spectateBtn.className = 'btn btn-small';
            spectateBtn.textContent = '観戦する';
            spectateBtn.onclick = () => {
                const spectateRoomInput = safeGetElement('spectate-room-id');
                const spectatorNameInput = safeGetElement('spectator-name');
                
                if (spectateRoomInput) spectateRoomInput.value = game.id;
                
                const spectatorName = `観戦者${Math.floor(Math.random() * 1000)}`;
                if (spectatorNameInput) spectatorNameInput.value = spectatorName;
                
                if (window.pigGame) {
                    window.pigGame.spectateRoom();
                }
            };
            
            gameDiv.appendChild(infoDiv);
            gameDiv.appendChild(spectateBtn);
            container.appendChild(gameDiv);
        });
    }

    static showScreen(screenName) {
        console.log(`画面切り替え: ${screenName}`);
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        
        screens.forEach(screen => {
            const element = safeGetElement(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        if (screenName) {
            const screen = safeGetElement(screenName);
            if (screen) {
                screen.style.display = 'block';
            }
        }
    }

    static updatePlayersList(players, hostId) {
        console.log(`プレイヤー一覧更新: ${players.length}人`);
        const container = safeGetElement('players-list');
        const countEl = safeGetElement('player-count');
        
        if (!container || !countEl) return;
        
        const count = players.filter(p => p.connected).length;
        countEl.textContent = count;
        
        container.innerHTML = '';
        players.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            if (player.id === hostId) {
                div.classList.add('host');
            }
            
            const status = player.connected ? '🟢' : '🔴';
            const disconnectedText = player.connected ? '' : ' (切断中)';
            div.textContent = `${status} ${player.name}${disconnectedText}`;
            
            if (!player.connected) {
                div.style.opacity = '0.6';
                div.style.fontStyle = 'italic';
            }
            
            container.appendChild(div);
        });
    }

    static updateGameOverview(playerCount) {
        let roleText = '';
        let cardText = '';

        switch (playerCount) {
            case 3:
                roleText = '探検家 1-2人、豚男 1-2人';
                cardText = '子豚5匹、罠2個、空き部屋8個';
                break;
            case 4:
                roleText = '探検家 2-3人、豚男 1-2人';
                cardText = '子豚6匹、罠2個、空き部屋12個';
                break;
            case 5:
                roleText = '探検家 3人、豚男 2人';
                cardText = '子豚7匹、罠2個、空き部屋16個';
                break;
            case 6:
                roleText = '探検家 4人、豚男 2人';
                cardText = '子豚8匹、罠2個、空き部屋20個';
                break;
            case 7:
                roleText = '探検家 4-5人、豚男 2-3人';
                cardText = '子豚7匹、罠2個、空き部屋26個';
                break;
            case 8:
                roleText = '探検家 5-6人、豚男 2-3人';
                cardText = '子豚8匹、罠2個、空き部屋30個';
                break;
            case 9:
                roleText = '探検家 6人、豚男 3人';
                cardText = '子豚9匹、罠2個、空き部屋34個';
                break;
            case 10:
                roleText = '探検家 6-7人、豚男 3-4人';
                cardText = '子豚10匹、罠3個、空き部屋37個';
                break;
        }

        safeSetText('role-possibility-text', roleText);
        safeSetText('card-distribution-text', cardText);
    }

    static updateProgressBars(gameData) {
        const treasureTotal = gameData.totalTreasures || gameData.treasureGoal || 7;
        const trapTotal = gameData.totalTraps || gameData.trapGoal || 2;
        const treasureFound = gameData.treasureFound || 0;
        const trapTriggered = gameData.trapTriggered || 0;

        // 財宝の進捗バー
        const treasureContainer = safeGetElement('treasure-icons');
        if (treasureContainer) {
            treasureContainer.innerHTML = '';
            for (let i = 0; i < treasureTotal; i++) {
                const icon = document.createElement('div');
                icon.className = 'progress-icon treasure';
                if (i < treasureFound) {
                    icon.classList.add('used');
                }
                treasureContainer.appendChild(icon);
            }
        }

        // 罠の進捗バー
        const trapContainer = safeGetElement('trap-icons');
        if (trapContainer) {
            trapContainer.innerHTML = '';
            for (let i = 0; i < trapTotal; i++) {
                const icon = document.createElement('div');
                icon.className = 'progress-icon trap';
                if (i < trapTriggered) {
                    icon.classList.add('used');
                }
                trapContainer.appendChild(icon);
            }
        }
    }

    static updateGameInfo(gameData) {
        safeSetText('current-round', gameData.currentRound);
        safeSetText('treasure-found', gameData.treasureFound || 0);
        safeSetText('trap-triggered', gameData.trapTriggered || 0);
        safeSetText('trap-goal', gameData.trapGoal || 2);
        safeSetText('cards-per-player', gameData.cardsPerPlayer || 5);
        safeSetText('cards-flipped', gameData.cardsFlippedThisRound || 0);
        safeSetText('treasure-goal', gameData.treasureGoal || 7);
    }

    static showRoundStart(roundNumber) {
        const overlay = safeGetElement('round-start-overlay');
        const message = safeGetElement('round-start-message');
        
        if (overlay && message) {
            message.textContent = `ラウンド ${roundNumber} スタート！`;
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000);
        }
    }

    static showVictoryScreen(gameData) {
        const screen = safeGetElement('victory-screen');
        const title = safeGetElement('victory-title');
        const messageEl = safeGetElement('victory-message');
        const winnersList = safeGetElement('winners-list');
        
        if (!screen || !title || !messageEl || !winnersList) return;
        
        if (gameData.winningTeam === 'adventurer') {
            title.textContent = '⛏️ 探検家チームの勝利！';
            title.style.color = '#FFD700';
        } else {
            title.textContent = '🐷 豚男チームの勝利！';
            title.style.color = '#DC143C';
        }
        
        messageEl.textContent = gameData.victoryMessage;
        
        winnersList.innerHTML = '<h3>勝利チーム:</h3>';
        gameData.players.forEach((player) => {
            if ((gameData.winningTeam === 'adventurer' && player.role === 'adventurer') ||
                (gameData.winningTeam === 'guardian' && player.role === 'guardian')) {
                const div = document.createElement('div');
                div.textContent = `🎉 ${player.name}`;
                div.style.color = '#FFD700';
                winnersList.appendChild(div);
            }
        });
        
        screen.style.display = 'flex';
    }

    static updateMessages(messages) {
        const container = safeGetElement('chat-container');
        if (!container) return;
        
        const recentMessages = messages.slice(-20);
        
        container.innerHTML = '';
        recentMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.type}`;
            
            if (msg.type === 'player') {
                div.textContent = `${msg.playerName}: ${msg.text}`;
            } else {
                div.textContent = msg.text;
            }
            
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }
}

// SocketClient クラス
class SocketClient {
    constructor(game) {
        console.log('SocketClient 初期化開始');
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.connectionTimeout = null;
        this.initializeSocket();
    }

    initializeSocket() {
        console.log('Socket.io 初期化開始 (Render対応)');
        
        if (typeof io === 'undefined') {
            console.error('❌ Socket.io が読み込まれていません');
            UIManager.showError('Socket.io ライブラリが読み込まれていません');
            return;
        }

        try {
            const socketConfig = {
                transports: ['polling', 'websocket'],
                timeout: 15000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 3000,
                reconnectionDelayMax: 15000,
                forceNew: false,
                pingInterval: 25000,
                pingTimeout: 20000,
                upgrade: true,
                autoConnect: true
            };

            console.log('Socket.io 設定:', socketConfig);
            this.socket = io(socketConfig);

            console.log('Socket.io インスタンス作成成功');
            this.setupEventListeners();
            this.setupConnectionMonitoring();
            
        } catch (error) {
            console.error('❌ Socket.io 初期化エラー:', error);
            UIManager.showError('サーバー接続の初期化に失敗しました');
        }
    }

    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始');
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            return;
        }

        // 接続イベント
        this.socket.on('connect', () => {
            console.log('✅ Socket.io 接続成功:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);
            
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            
            setTimeout(() => {
                this.getRoomList();
            }, 1000);
        });

        // Transport変更を監視
        this.socket.io.on('upgrade', (transport) => {
            console.log('🔄 Transport アップグレード:', transport.name);
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            
            if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket.io 接続エラー:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
            } else {
                UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`, 'warning');
            }
        });

        // 再接続試行
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`, 'warning');
        });

        // 再接続成功
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ 再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showError('サーバーに再接続しました！', 'success');
        });

        // ゲーム関連イベント
        this.socket.on('roomList', (rooms) => {
            console.log('📋 ルーム一覧受信:', rooms);
            UIManager.updateRoomList(rooms);
        });

        this.socket.on('ongoingGames', (games) => {
            console.log('📋 進行中ゲーム一覧受信:', games);
            UIManager.updateOngoingGames(games);
        });

        this.socket.on('roomCreated', (data) => {
            console.log('✅ ルーム作成成功:', data);
            this.game.onRoomCreated(data);
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('✅ ルーム参加成功:', data);
            this.game.onJoinSuccess(data);
        });

        this.socket.on('rejoinSuccess', (data) => {
            console.log('✅ 再入場成功:', data);
            this.game.onRejoinSuccess(data);
        });

        this.socket.on('spectateSuccess', (data) => {
            console.log('✅ 観戦成功:', data);
            this.game.onSpectateSuccess(data);
        });

        this.socket.on('reconnectSuccess', (data) => {
            console.log('✅ 再接続成功:', data);
            this.game.onReconnectSuccess(data);
        });

        this.socket.on('gameUpdate', (gameData) => {
            console.log('🎮 ゲーム状態更新');
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('newMessage', (messages) => {
            UIManager.updateMessages(messages);
        });

        this.socket.on('roundStart', (roundNumber) => {
            UIManager.showRoundStart(roundNumber);
        });

        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            this.game.onError(error);
        });

        console.log('✅ Socket イベントリスナー設定完了');
    }

    setupConnectionMonitoring() {
        this.connectionTimeout = setTimeout(() => {
            if (!this.socket.connected) {
                console.warn('⚠️ 初期接続がタイムアウトしました');
                UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
            }
        }, 10000);

        setInterval(() => {
            if (this.socket && !this.socket.connected) {
                console.warn('⚠️ Socket接続が切れています');
            }
        }, 30000);
    }

    emit(event, data) {
        console.log(`📤 Socket送信: ${event}`, data);
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            UIManager.showError('サーバー接続が初期化されていません');
            return false;
        }

        if (!this.socket.connected) {
            console.error('❌ Socket 未接続');
            UIManager.showError('サーバーに接続されていません。接続を確認中...');
            
            if (!this.socket.connecting) {
                this.socket.connect();
            }
            return false;
        }

        try {
            this.socket.emit(event, data);
            console.log(`✅ Socket送信成功: ${event}`);
            return true;
        } catch (error) {
            console.error(`❌ Socket送信エラー: ${event}`, error);
            UIManager.showError('通信エラーが発生しました');
            return false;
        }
    }

    getRoomList() {
        console.log('📋 ルーム一覧要求');
        return this.emit('getRoomList');
    }

    getOngoingGames() {
        console.log('📋 進行中ゲーム一覧要求');
        return this.emit('getOngoingGames');
    }

    createRoom(playerName, hasPassword, password) {
        console.log('🏠 ルーム作成要求:', { playerName, hasPassword: !!hasPassword });
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求:', { roomId, playerName });
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    rejoinRoom(roomId, playerName) {
        console.log('🔄 再入場要求:', { roomId, playerName });
        return this.emit('rejoinRoom', { roomId, playerName });
    }

    tempLeaveRoom() {
        console.log('🚶 一時退出要求');
        return this.emit('tempLeaveRoom');
    }

    spectateRoom(roomId, spectatorName) {
        console.log('👁️ 観戦要求:', { roomId, spectatorName });
        return this.emit('spectateRoom', { roomId, spectatorName });
    }

    reconnectToRoom(roomId, playerName) {
        console.log(`🔄 ルーム再接続を試行: ${playerName} -> ${roomId}`);
        return this.emit('reconnectToRoom', { roomId, playerName });
    }

    sendChat(message) {
        console.log('💬 チャット送信:', message);
        return this.emit('sendChat', message);
    }

    startGame() {
        console.log('🎮 ゲーム開始要求');
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🃏 カード選択:', { targetPlayerId, cardIndex });
        return this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        return this.emit('leaveRoom');
    }

    isConnected() {
        const connected = this.socket && this.socket.connected;
        return connected;
    }

    forceReconnect() {
        console.log('🔄 手動再接続開始');
        if (this.socket) {
            this.socket.disconnect();
            setTimeout(() => {
                this.socket.connect();
            }, 1000);
        }
    }
}

// メインゲームクラス
class PigManGame {
    constructor() {
        console.log('🐷 PigManGame 初期化開始');
        
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        // 重複防止機能
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.joinCooldown = 3000; // 3秒のクールダウン
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        
        this.attemptReconnection();
        
        console.log('✅ PigManGame 初期化完了');
    }

    initializeErrorMonitoring() {
        const self = this;
        
        window.addEventListener('error', (event) => {
            self.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
