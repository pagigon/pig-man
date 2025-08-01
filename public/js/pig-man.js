// 豚小屋探検隊 - 統合JavaScript
console.log('🐷 豚小屋探検隊 - 開始');

// ユーティリティ関数
const safeGetElement = (id) => document.getElementById(id);
const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) el.textContent = text;
};
const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} にイベント追加成功`);
    } else {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
};

// UIManager クラス
class UIManager {
    // 観戦モード表示の切り替え
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
            
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.classList.add('spectator-mode');
            }
            
            this.addSpectatorInfo();
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.classList.remove('spectator-mode');
            }
            
            this.removeSpectatorInfo();
        }
    }

    static addSpectatorInfo() {
        const gameBoard = document.getElementById('game-board');
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
        
        const displayTime = type === 'success' ? 3000 : 5000;
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, displayTime);
    }

    static showPlayerName(name) {
        const displayEl = safeGetElement('player-name-display');
        const nameEl = safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
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
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.initializeSocket();
    }

    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            pingInterval: 25000,
            pingTimeout: 60000
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 接続イベント
        this.socket.on('connect', () => {
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            console.log('サーバーに接続しました');
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
            UIManager.showConnectionStatus('disconnected');
            console.log('サーバーから切断されました:', reason);
            
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
        });

        // 再接続試行イベント
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`);
        });

        // 再接続成功イベント
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showError('再接続しました！', 'success');
            
            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                setTimeout(() => {
                    this.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 500);
            }
        });

        // 再接続失敗イベント
        this.socket.on('reconnect_failed', () => {
            console.log('再接続に失敗しました');
            UIManager.showError('サーバーに接続できません。ページを更新してください。');
        });

        // ルーム一覧受信
        this.socket.on('roomList', (rooms) => {
            UIManager.updateRoomList(rooms);
        });

        // 進行中ゲーム一覧受信
        this.socket.on('ongoingGames', (games) => {
            UIManager.updateOngoingGames(games);
        });

        // ルーム作成完了
        this.socket.on('roomCreated', (data) => {
            this.game.onRoomCreated(data);
        });

        // ルーム参加成功
        this.socket.on('joinSuccess', (data) => {
            this.game.onJoinSuccess(data);
        });

        // 再入場成功
        this.socket.on('rejoinSuccess', (data) => {
            this.game.onRejoinSuccess(data);
        });

        // 観戦成功
        this.socket.on('spectateSuccess', (data) => {
            this.game.onSpectateSuccess(data);
        });

        // 再接続成功
        this.socket.on('reconnectSuccess', (data) => {
            this.game.onReconnectSuccess(data);
        });

        // ゲーム状態更新
        this.socket.on('gameUpdate', (gameData) => {
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        // メッセージ受信
        this.socket.on('newMessage', (messages) => {
            UIManager.updateMessages(messages);
        });

        // ラウンド開始受信
        this.socket.on('roundStart', (roundNumber) => {
            UIManager.showRoundStart(roundNumber);
        });

        // エラー処理
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            UIManager.showError(error.message);
        });

        // 接続エラー処理
        this.socket.on('connect_error', (error) => {
            console.error('接続エラー:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。しばらく待ってから再試行してください。');
            } else {
                UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            }
        });
    }

    // Socket.io通信メソッド
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('Socket not connected, cannot emit:', event);
            UIManager.showError('サーバーに接続されていません');
        }
    }

    getRoomList() {
        this.emit('getRoomList');
    }

    getOngoingGames() {
        this.emit('getOngoingGames');
    }

    createRoom(playerName, hasPassword, password) {
        this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        this.emit('joinRoom', { roomId, playerName, password });
    }

    rejoinRoom(roomId, playerName) {
        this.emit('rejoinRoom', { roomId, playerName });
    }

    tempLeaveRoom() {
        this.emit('tempLeaveRoom');
    }

    spectateRoom(roomId, spectatorName) {
        this.emit('spectateRoom', { roomId, spectatorName });
    }

    reconnectToRoom(roomId, playerName) {
        console.log(`ルーム再接続を試行: ${playerName} -> ${roomId}`);
        this.emit('reconnectToRoom', { roomId, playerName });
    }

    sendChat(message) {
        this.emit('sendChat', message);
    }

    startGame() {
        this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        this.emit('leaveRoom');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }
}

// メインゲームクラス
class PigManGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        
        // ページ読み込み時に再接続を試行
        this.attemptReconnection();
    }

    // エラー監視の初期化
    initializeErrorMonitoring() {
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });

        this.socketErrorCount = 0;
        this.lastSocketError = null;
    }

    logError(type, details) {
        const errorInfo = {
            type,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            roomId: this.roomId,
            playerName: this.myName,
            isSpectator: this.isSpectator
        };

        console.error('Game Error:', errorInfo);

        if (this.socketClient && this.socketClient.isConnected()) {
            this.socketClient.emit('clientError', errorInfo);
        }

        if (type === 'JavaScript Error' || type === 'Unhandled Promise Rejection') {
            UIManager.showError('予期しないエラーが発生しました。ページをリロードしてください。', 'error');
        }
    }

    // バイブレーション機能
    vibrate(pattern) {
        if (navigator.vibrate && ('ontouchstart' in window || typeof window.DeviceMotionEvent !== 'undefined')) {
            try {
                const result = navigator.vibrate(pattern);
                console.log('Vibration result:', result, 'Pattern:', pattern);
                return result;
            } catch (error) {
                console.warn('Vibration error:', error);
                return false;
            }
        } else {
            console.log('Vibration not supported on this device');
            return false;
        }
    }

    initializeEventListeners() {
        // パスワード表示切り替え
        safeAddEventListener('use-password', 'change', (e) => {
            const passwordGroup = safeGetElement('password-group');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // ルーム操作
        safeAddEventListener('create-room', 'click', () => this.createRoom());
        safeAddEventListener('join-room', 'click', () => this.joinRoom());
        safeAddEventListener('rejoin-room', 'click', () => this.rejoinRoom());
        safeAddEventListener('spectate-room', 'click', () => this.spectateRoom());
        safeAddEventListener('leave-room', 'click', () => this.leaveRoom());
        safeAddEventListener('temp-leave-room', 'click', () => this.tempLeaveRoom());
        safeAddEventListener('cancel-temp-leave', 'click', () => this.cancelTempLeave());
        safeAddEventListener('game-leave-room', 'click', () => this.showTempLeaveDialog());
        safeAddEventListener('start-game', 'click', () => this.startGame());
        safeAddEventListener('return-to-lobby', 'click', () => this.returnToLobby());
        
        // リフレッシュボタン
        safeAddEventListener('refresh-rooms', 'click', () => {
            this.socketClient.getRoomList();
        });
        
        safeAddEventListener('refresh-ongoing', 'click', () => {
            this.socketClient.getOngoingGames();
        });

        // チャット
        safeAddEventListener('send-chat', 'click', () => this.sendChat());
        
        const chatInput = safeGetElement('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChat();
            });
        }

        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });

        console.log('イベントリスナーの初期化完了');
    }

    // 再接続処理
    attemptReconnection() {
        try {
            const rejoinInfo = localStorage.getItem('pigGameRejoinInfo');
            if (rejoinInfo) {
                const info = JSON.parse(rejoinInfo);
                console.log('保存された再入場情報:', info);
                
                if (Date.now() - info.timestamp < 24 * 60 * 60 * 1000) {
                    this.populateRejoinInfo(info);
                    UIManager.showError('前回のゲームへの再入場情報が見つかりました', 'warning');
                } else {
                    localStorage.removeItem('pigGameRejoinInfo');
                }
                return;
            }

            const savedPlayerInfo = localStorage.getItem('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                const playerInfo = JSON.parse(savedPlayerInfo);
                console.log('保存された情報で再接続を試行:', playerInfo);
                
                this.myName = playerInfo.playerName;
                this.isHost = playerInfo.isHost;
                UIManager.showPlayerName(this.myName);
                
                setTimeout(() => {
                    this.socketClient.reconnectToRoom(playerInfo.roomId, playerInfo.playerName);
                }, 1000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            localStorage.removeItem('pigGamePlayerInfo');
            localStorage.removeItem('pigGameRejoinInfo');
        }
    }

    // プレイヤー情報を保存
    savePlayerInfo(playerInfo) {
        try {
            localStorage.setItem('pigGamePlayerInfo', JSON.stringify(playerInfo));
            console.log('プレイヤー情報を保存:', playerInfo);
        } catch (error) {
            console.error('プレイヤー情報の保存エラー:', error);
        }
    }

    // プレイヤー情報を削除
    clearPlayerInfo() {
        try {
            localStorage.removeItem('pigGamePlayerInfo');
            console.log('プレイヤー情報を削除');
        } catch (error) {
            console.error('プレイヤー情報の削除エラー:', error);
        }
    }

    createRoom() {
        const nameInput = safeGetElement('player-name-create');
        const playerName = nameInput?.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = safeGetElement('use-password')?.checked || false;
        const password = hasPassword ? (safeGetElement('room-password')?.value || '') : '';
        
        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        
        this.socketClient.createRoom(playerName, hasPassword, password);
    }

    joinRoom() {
        const nameInput = safeGetElement('player-name-join');
        const roomInput = safeGetElement('room-id-input');
        const passwordInput = safeGetElement('join-password');
        
        const playerName = nameInput?.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';
        const password = passwordInput?.value || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        this.socketClient.joinRoom(roomId, playerName, password);
    }

    rejoinRoom() {
        const nameInput = safeGetElement('rejoin-player-name');
        const roomInput = safeGetElement('rejoin-room-id');
        
        const playerName = nameInput?.value.trim() || '';
        const roomId = roomInput?.value.trim().toUpperCase() || '';

        if (!playerName) {
            UIManager.showError('プレイヤー名を入力してください');
            return;
        }

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        this.socketClient.rejoinRoom(roomId, playerName);
    }

    spectateRoom() {
        const nameInput = safeGetElement('spectator-name');
        const roomInput = safeGetElement('spectate-room-id');
        
        const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.myName = spectatorName;
        this.isSpectator = true;
        UIManager.showPlayerName(this.myName + ' (観戦)');
        this.roomId = roomId;
        
        this.socketClient.spectateRoom(roomId, spectatorName);
    }

    showTempLeaveDialog() {
        if (this.gameData && this.gameData.gameState === 'playing') {
            const tempLeaveSection = safeGetElement('temp-leave-section');
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'block';
            }
            UIManager.showScreen('room-info');
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.roomId) {
                roomIdDisplay.textContent = this.roomId;
            }
        } else {
            this.leaveRoom();
        }
    }

    cancelTempLeave() {
        const tempLeaveSection = safeGetElement('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
        if (this.gameData && this.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

    tempLeaveRoom() {
        const rejoinInfo = {
            roomId: this.roomId,
            playerName: this.myName,
            tempLeft: true,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('pigGameRejoinInfo', JSON.stringify(rejoinInfo));
        } catch (error) {
            console.error('再入場情報の保存エラー:', error);
        }

        this.socketClient.tempLeaveRoom();
        
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
        
        this.populateRejoinInfo(rejoinInfo);
        
        UIManager.showError('一時退出しました。同じプレイヤー名とルームIDで再入場できます。', 'warning');
    }

    populateRejoinInfo(rejoinInfo) {
        const rejoinPlayerNameEl = safeGetElement('rejoin-player-name');
        const rejoinRoomIdEl = safeGetElement('rejoin-room-id');
        
        if (rejoinPlayerNameEl) rejoinPlayerNameEl.value = rejoinInfo.playerName;
        if (rejoinRoomIdEl) rejoinRoomIdEl.value = rejoinInfo.roomId;
    }

    // サーバーからのイベント処理
    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        this.savePlayerInfo(data.playerInfo);
        
        this.showRoomInfo();
    }

    onJoinSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo.isHost;
        
        this.savePlayerInfo(data.playerInfo);
        
        this.updateUI();
    }

    onSpectateSuccess(data) {
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
        this.updateUI();
    }

    onRejoinSuccess(data) {
        console.log('再入場成功:', data);
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        try {
            localStorage.removeItem('pigGameRejoinInfo');
        } catch (error) {
            console.error('再入場情報の削除エラー:', error);
        }
        
        UIManager.showError('ゲームに再入場しました！', 'success');
        this.updateUI();
    }

    onReconnectSuccess(data) {
        console.log('再接続成功:', data);
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        UIManager.showError('ゲームに再接続しました！', 'success');
        this.updateUI();
    }

    showRoomInfo() {
        UIManager.showScreen('room-info');
        const roomIdDisplay = safeGetElement('room-id-display');
        if (roomIdDisplay && this.roomId) {
            roomIdDisplay.textContent = this.roomId;
        }
    }

    updateUI() {
        if (!this.gameData) return;

        const treasureGoalEl = safeGetElement('treasure-goal');
        if (treasureGoalEl) {
            treasureGoalEl.textContent = this.gameData.treasureGoal || 7;
        }

        UIManager.updatePlayersList(this.gameData.players, this.gameData.host);

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            UIManager.showVictoryScreen(this.gameData);
            
            if (this.gameData.winningTeam === 'adventurer') {
                this.vibrate([200, 100, 200, 100, 200]);
            } else {
                this.vibrate([100, 50, 100, 50, 300]);
            }
        }
    }

    updateLobbyUI() {
        UIManager.showScreen('room-info');
        
        const startButton = safeGetElement('start-game');
        const tempLeaveSection = safeGetElement('temp-leave-section');
        
        const count = this.gameData.players.filter(p => p.connected).length;
        if (this.isHost && count >= 3 && startButton) {
            startButton.style.display = 'block';
        } else if (startButton) {
            startButton.style.display = 'none';
        }
        
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
    }

    updateGameUI() {
        UIManager.showScreen('game-board');

        UIManager.updateGameOverview(this.gameData.players.length);
        UIManager.updateProgressBars(this.gameData);
        UIManager.updateGameInfo(this.gameData);

        const keyHolder = this.gameData.players.find(p => p.id === this.gameData.keyHolderId);
        safeSetText('key-holder-name', keyHolder?.name || '不明');
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        safeSetText('turn-message', isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...');

        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);

        this.addCardRevealEffects();
    }

    addCardRevealEffects() {
        if (this.gameData.lastRevealedCard) {
            const cardType = this.gameData.lastRevealedCard.type;
            
            switch (cardType) {
                case 'treasure':
                    this.vibrate([100, 50, 100]);
                    break;
                case 'trap':
                    this.vibrate([200, 100, 200, 100, 200]);
                    break;
                case 'empty':
                    this.vibrate([50]);
                    break;
            }
            
            delete this.gameData.lastRevealedCard;
        }
    }

    showPlayerRole() {
        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        const myRole = myPlayer?.role;
        const roleCard = safeGetElement('role-reveal');
        const roleText = safeGetElement('player-role');
        const roleDesc = safeGetElement('role-description');
        const roleImage = safeGetElement('role-image');

        if (!roleCard || !roleText || !roleDesc || !roleImage) return;

        if (myRole === 'adventurer') {
            roleCard.className = 'role-card role-adventurer compact';
            roleText.textContent = '⛏️ 探検家 (Explorer)';
            roleDesc.textContent = `子豚に変えられた子供を${this.gameData.treasureGoal || 7}匹すべて救出することが目標です！`;
            roleImage.src = '/images/role-adventurer.png';
            roleImage.alt = '探検家';
            
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '⛏️';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
        } else if (myRole === 'guardian') {
            roleCard.className = 'role-card role-guardian compact';
            roleText.textContent = '🐷 豚男 (Pig Man)';
            roleDesc.textContent = `罠を${this.gameData.trapGoal || 2}個すべて発動させるか、4ラウンド終了まで子豚たちを隠し続けることが目標です！`;
            roleImage.src = '/images/role-guardian.png';
            roleImage.alt = '豚男';
            
            roleImage.onerror = () => {
                roleImage.style.display = 'none';
                const emoji = document.createElement('div');
                emoji.textContent = '🐷';
                emoji.style.fontSize = '4em';
                emoji.style.textAlign = 'center';
                roleImage.parentNode.insertBefore(emoji, roleImage.nextSibling);
            };
        }
    }

    renderMyCards() {
        const myCardsSection = document.querySelector('.my-cards-section');
        if (this.isSpectator) {
            if (myCardsSection) myCardsSection.style.display = 'none';
            return;
        } else {
            if (myCardsSection) myCardsSection.style.display = 'block';
        }

        const myPlayer = this.gameData.players.find(p => p.id === this.mySocketId);
        if (!myPlayer || !myPlayer.hand) return;

        const container = safeGetElement('my-cards-grid');
        if (!container) return;
        
        container.innerHTML = '';

        let treasureCount = 0, trapCount = 0, emptyCount = 0;
        
        myPlayer.hand.forEach((card, index) => {
            const div = document.createElement('div');
            div.className = 'card';
            
            if (card.revealed) {
                div.classList.add('revealed', card.type);
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = `/images/card-${card.type}-large.png`;
                img.alt = card.type;
                
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    switch (card.type) {
                        case 'treasure':
                            emoji.textContent = '🐷';
                            break;
                        case 'trap':
                            emoji.textContent = '💀';
                            break;
                        case 'empty':
                            emoji.textContent = '🏠';
                            break;
                    }
                    div.appendChild(emoji);
                };
                
                div.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.className = 'card-image';
                img.src = '/images/card-back-large.png';
                img.alt = 'カード裏面';
                
                img.onerror = () => {
                    img.style.display = 'none';
                    const emoji = document.createElement('div');
                    emoji.textContent = '❓';
                    emoji.style.fontSize = '2.5em';
                    emoji.style.textAlign = 'center';
                    emoji.style.lineHeight = '1';
                    div.appendChild(emoji);
                };
                
                div.appendChild(img);
                
                switch (card.type) {
                    case 'treasure':
                        treasureCount++;
                        break;
                    case 'trap':
                        trapCount++;
                        break;
                    case 'empty':
                        emptyCount++;
                        break;
                }
            }
            
            container.appendChild(div);
        });

        safeSetText('my-treasure', treasureCount);
        safeSetText('my-trap', trapCount);
        safeSetText('my-empty', emptyCount);
    }

    renderOtherPlayers(isMyTurn) {
        const container = safeGetElement('other-players-container');
        if (!container) return;
        
        container.innerHTML = '';

        this.gameData.players.forEach((player) => {
            if (player.id === this.mySocketId) return;

            const playerBox = document.createElement('div');
            playerBox.className = 'other-player-box';
            if (player.id === this.gameData.keyHolderId) {
                playerBox.classList.add('has-key');
            }

            const header = document.createElement('h4');
            header.textContent = player.name;
            
            if (!player.connected) {
                header.textContent += ' (切断中)';
                header.style.color = '#888';
            }
            
            if (player.id === this.gameData.keyHolderId) {
                const keyImg = document.createElement('img');
                keyImg.src = '/images/key-icon.png';
                keyImg.className = 'key-icon-small';
                keyImg.alt = '鍵';
                
                keyImg.onerror = () => {
                    keyImg.style.display = 'none';
                    const emoji = document.createElement('span');
                    emoji.textContent = '🗝️';
                    emoji.style.fontSize = '20px';
                    emoji.style.marginLeft = '8px';
                    header.appendChild(emoji);
                };
                
                header.appendChild(keyImg);
            }
            playerBox.appendChild(header);

            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'other-player-cards';

            if (player.hand) {
                player.hand.forEach((card, index) => {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'other-card';
                    
                    if (card.revealed) {
                        cardDiv.classList.add('revealed', card.type);
                        const img = document.createElement('img');
                        img.className = 'other-card-image';
                        img.src = `/images/card-${card.type}-medium.png`;
                        img.alt = card.type;
                        
                        img.onerror = () => {
                            img.style.display = 'none';
                            const emoji = document.createElement('div');
                            emoji.style.fontSize = '1.5em';
                            emoji.style.textAlign = 'center';
                            emoji.style.lineHeight = '1';
                            switch (card.type) {
                                case 'treasure':
                                    emoji.textContent = '🐷';
                                    break;
                                case 'trap':
                                    emoji.textContent = '💀';
                                    break;
                                case 'empty':
                                    emoji.textContent = '🏠';
                                    break;
                            }
                            cardDiv.appendChild(emoji);
                        };
                        
                        cardDiv.appendChild(img);
                    } else {
                        const img = document.createElement('img');
                        img.className = 'other-card-image';
                        img.src = '/images/card-back-medium.png';
                        img.alt = 'カード裏面';
                        
                        img.onerror = () => {
                            img.style.display = 'none';
                            const emoji = document.createElement('div');
                            emoji.textContent = '❓';
                            emoji.style.fontSize = '1.5em';
                            emoji.style.textAlign = 'center';
                            emoji.style.lineHeight = '1';
                            cardDiv.appendChild(emoji);
                        };
                        
                        cardDiv.appendChild(img);
                        
                        if (isMyTurn && !card.revealed && player.connected) {
                            cardDiv.addEventListener('click', () => {
                                this.selectCard(player.id, index);
                            });
                        } else {
                            cardDiv.classList.add('disabled');
                        }
                    }
                    
                    cardsGrid.appendChild(cardDiv);
                });
            }

            playerBox.appendChild(cardsGrid);
            container.appendChild(playerBox);
        });
    }

    selectCard(targetPlayerId, cardIndex) {
        if (this.isSpectator) {
            UIManager.showError('観戦者はカードを選択できません');
            return;
        }
        
        this.socketClient.selectCard(targetPlayerId, cardIndex);
    }

    sendChat() {
        const input = safeGetElement('chat-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        if (!message || !this.roomId) return;
        
        this.socketClient.sendChat(message);
        input.value = '';
    }

    startGame() {
        if (this.isSpectator) {
            UIManager.showError('観戦者はゲームを開始できません');
            return;
        }
        
        this.socketClient.startGame();
    }

    leaveRoom() {
        this.socketClient.leaveRoom();
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        this.clearPlayerInfo();
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
    }

    returnToLobby() {
        this.leaveRoom();
    }
}

// グローバルに公開
window.UIManager = UIManager;
window.SocketClient = SocketClient;
window.PigManGame = PigManGame;

// DOM読み込み完了後の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🐷 DOM読み込み完了');
    
    // 必須要素の存在確認
    const requiredElements = ['lobby', 'room-info', 'game-board', 'error-message'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('必須要素が不足:', missingElements);
        alert('ページの読み込みに問題があります。ページをリロードしてください。\n不足要素: ' + missingElements.join(', '));
        return;
    }
    
    console.log('✅ 必須要素確認完了');
    
    // Socket.io の存在確認
    if (typeof io === 'undefined') {
        console.error('Socket.io が読み込まれていません');
        UIManager.showError('Socket.io ライブラリの読み込みに失敗しました');
        return;
    }
    
    console.log('✅ Socket.io ライブラリ確認完了');
    
    try {
        // ゲームインスタンス作成
        const pigGame = new PigManGame();
        window.pigGame = pigGame;
        
        console.log('✅ 豚小屋探検隊ゲーム初期化成功！');
        UIManager.showError('🐷 豚小屋探検隊へようこそ！', 'success');
        
    } catch (error) {
        console.error('ゲーム初期化エラー:', error);
        UIManager.showError('ゲームの初期化に失敗しました: ' + error.message);
    }
});

// エラーハンドリング
window.addEventListener('error', function(event) {
    console.error('JavaScript エラー:', event.error);
    UIManager.showError('予期しないエラーが発生しました');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promise エラー:', event.reason);
    UIManager.showError('通信エラーが発生しました');
});

console.log('🐷 豚小屋探検隊 JavaScript 読み込み完了');
