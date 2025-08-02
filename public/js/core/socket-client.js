// SocketClient クラス - Socket.io通信の責任を持つ
import { UIManager } from './ui-manager.js';

export class SocketClient {
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
