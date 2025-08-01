// Socket通信クライアント

console.log('🔌 Socket-Client.js 読み込み開始');

class SocketClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isConnecting = false;
        this.connectionTimeout = null;
        
        this.initializeSocket();
    }

    initializeSocket() {
        if (this.isConnecting) {
            console.log('既に接続処理中です');
            return;
        }

        this.isConnecting = true;
        
        try {
            console.log('Socket.io初期化開始...');
            
            this.socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000,
                pingInterval: 25000,
                pingTimeout: 60000
            });
            
            this.setupEventListeners();
            
            // 接続タイムアウト設定
            this.connectionTimeout = setTimeout(() => {
                if (!this.socket.connected) {
                    console.error('接続タイムアウト');
                    UIManager.showError('サーバーへの接続がタイムアウトしました');
                    this.isConnecting = false;
                }
            }, 15000);
            
        } catch (error) {
            console.error('Socket初期化エラー:', error);
            UIManager.showError('通信の初期化に失敗しました');
            this.isConnecting = false;
        }
    }

    setupEventListeners() {
        if (!this.socket) return;

        // 接続成功
        this.socket.on('connect', () => {
            console.log('✅ Socket.io接続成功:', this.socket.id);
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.game.mySocketId = this.socket.id;
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            
            UIManager.showConnectionStatus('connected');
            
            // 初回接続時のみウェルカムメッセージ
            if (!this.hasConnectedBefore) {
                UIManager.showToast('サーバーに接続しました', 'success');
                this.hasConnectedBefore = true;
            }
        });

        // 切断
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            
            const reasonMessages = {
                'io server disconnect': 'サーバーから切断されました',
                'io client disconnect': '手動で切断しました',
                'ping timeout': '通信がタイムアウトしました',
                'transport close': '通信が中断されました',
                'transport error': '通信エラーが発生しました'
            };
            
            const message = reasonMessages[reason] || `接続が切断されました (${reason})`;
            UIManager.showToast(message, 'warning');
            
            // サーバー側から切断された場合は手動で再接続
            if (reason === 'io server disconnect') {
                setTimeout(() => {
                    if (!this.socket.connected) {
                        this.manualReconnect();
                    }
                }, 2000);
            }
        });

        // 再接続試行
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showToast(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`, 'info', 2000);
        });

        // 再接続成功
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ 再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showToast('再接続しました！', 'success');
            
            // 保存された情報で自動的にルームに再参加を試行
            const savedPlayerInfo = Utils.storage.get('pigGamePlayerInfo');
            if (savedPlayerInfo && this.game.roomId) {
                setTimeout(() => {
                    console.log('保存された情報で再接続を試行');
                    this.reconnectToRoom(savedPlayerInfo.roomId, savedPlayerInfo.playerName);
                }, 1000);
            }
        });

        // 再接続失敗
        this.socket.on('reconnect_failed', () => {
            console.log('❌ 再接続に失敗しました');
            UIManager.showError('サーバーに接続できません。ページを更新してください。');
            
            // 手動再接続ボタンを表示
            this.showManualReconnectButton();
        });

        // 接続エラー
        this.socket.on('connect_error', (error) => {
            console.error('接続エラー:', error);
            this.reconnectAttempts++;
            
            const errorMessages = {
                'websocket error': 'WebSocket接続に失敗しました',
                'polling error': 'ポーリング接続に失敗しました',
                'timeout': '接続がタイムアウトしました'
            };
            
            const message = errorMessages[error.type] || `接続エラー: ${error.message}`;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。しばらく待ってから再試行してください。');
                this.showManualReconnectButton();
            } else {
                UIManager.showToast(message, 'error', 3000);
            }
            
            this.isConnecting = false;
        });

        // ゲーム関連イベント
        this.socket.on('roomCreated', (data) => {
            console.log('🏠 ルーム作成成功:', data);
            this.game.onRoomCreated(data);
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('🚪 ルーム参加成功:', data);
            this.game.onJoinSuccess(data);
        });

        this.socket.on('rejoinSuccess', (data) => {
            console.log('🔄 再入場成功:', data);
            this.game.onRejoinSuccess(data);
        });

        this.socket.on('spectateSuccess', (data) => {
            console.log('👁️ 観戦開始:', data);
            this.game.onSpectateSuccess(data);
        });

        this.socket.on('reconnectSuccess', (data) => {
            console.log('🔌 再接続成功:', data);
            this.game.onReconnectSuccess(data);
        });

        this.socket.on('gameUpdate', (gameData) => {
            console.log('🎮 ゲーム状態更新');
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('newMessage', (messages) => {
            console.log('💬 新しいメッセージ受信');
            UIManager.updateMessages(messages);
        });

        this.socket.on('roundStart', (roundNumber) => {
            console.log('🎯 ラウンド開始:', roundNumber);
            UIManager.showRoundStart(roundNumber);
        });

        this.socket.on('roomList', (rooms) => {
            console.log('📋 ルーム一覧受信:', rooms.length);
            // UIManager.updateRoomList(rooms); // 実装時に有効化
        });

        this.socket.on('ongoingGames', (games) => {
            console.log('🎮 進行中ゲーム一覧受信:', games.length);
            // UIManager.updateOngoingGames(games); // 実装時に有効化
        });

        // エラーハンドリング
        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            
            const errorMessages = {
                'ROOM_NOT_FOUND': 'ルームが見つかりません',
                'ROOM_FULL': 'ルームが満員です',
                'INVALID_PASSWORD': 'パスワードが違います',
                'GAME_ALREADY_STARTED': 'ゲームが既に開始されています',
                'PLAYER_NOT_FOUND': 'プレイヤーが見つかりません',
                'NOT_YOUR_TURN': 'あなたのターンではありません',
                'INVALID_MOVE': '無効な操作です',
                'RATE_LIMITED': '操作が制限されています。しばらく待ってから再試行してください。',
                'VALIDATION_ERROR': '入力内容に問題があります',
                'SERVER_ERROR': 'サーバーエラーが発生しました'
            };
            
            const message = errorMessages[error.code] || error.message || '不明なエラーが発生しました';
            UIManager.showError(message);
        });
    }

    // 安全な送信
    emit(event, data) {
        if (!this.socket) {
            console.warn('Socket not initialized');
            UIManager.showError('通信が初期化されていません');
            return false;
        }

        if (!this.socket.connected) {
            console.warn('Socket not connected');
            UIManager.showError('サーバーに接続されていません');
            
            // 自動再接続を試行
            if (!this.isConnecting) {
                setTimeout(() => this.manualReconnect(), 1000);
            }
            return false;
        }

        try {
            console.log(`📤 送信: ${event}`, data);
            this.socket.emit(event, data);
            return true;
        } catch (error) {
            console.error('送信エラー:', error);
            UIManager.showError('データの送信に失敗しました');
            return false;
        }
    }

    // ルーム操作
    createRoom(playerName, hasPassword, password) {
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    rejoinRoom(roomId, playerName) {
        return this.emit('rejoinRoom', { roomId, playerName });
    }

    spectateRoom(roomId, spectatorName) {
        return this.emit('spectateRoom', { roomId, spectatorName });
    }

    reconnectToRoom(roomId, playerName) {
        console.log(`🔄 ルーム再接続を試行: ${playerName} -> ${roomId}`);
        return this.emit('reconnectToRoom', { roomId, playerName });
    }

    tempLeaveRoom() {
        return this.emit('tempLeaveRoom');
    }

    leaveRoom() {
        return this.emit('leaveRoom');
    }

    // ゲーム操作
    startGame() {
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        return this.
