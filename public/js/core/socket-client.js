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

            this.socket = io(socketConfig);
            this.setupEventListeners();
            this.setupConnectionMonitoring();
            
        } catch (error) {
            console.error('❌ Socket.io 初期化エラー:', error);
            UIManager.showError('サーバー接続の初期化に失敗しました');
        }
    }

    setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Socket.io 接続成功:', this.socket.id);
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            
            setTimeout(() => {
                this.getRoomList();
            }, 1000);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
        });

        this.socket.on('roomList', (rooms) => {
            UIManager.updateRoomList(rooms);
        });

        this.socket.on('ongoingGames', (games) => {
            UIManager.updateOngoingGames(games);
        });

        this.socket.on('roomCreated', (data) => {
            console.log('✅ ルーム作成成功:', data);
            this.game.onRoomCreated(data);
        });

        this.socket.on('joinSuccess', (data) => {
            this.game.onJoinSuccess(data);
        });

        this.socket.on('gameUpdate', (gameData) => {
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            this.game.onError(error);
        });
    }

    setupConnectionMonitoring() {
        // 接続監視ロジック
    }

    emit(event, data) {
        if (!this.socket || !this.socket.connected) {
            UIManager.showError('サーバーに接続されていません');
            return false;
        }

        try {
            this.socket.emit(event, data);
            return true;
        } catch (error) {
            console.error(`Socket送信エラー: ${event}`, error);
            return false;
        }
    }

    getRoomList() {
        return this.emit('getRoomList');
    }

    createRoom(playerName, hasPassword, password) {
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    startGame() {
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        return this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    sendChat(message) {
        return this.emit('sendChat', message);
    }

    leaveRoom() {
        return this.emit('leaveRoom');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    forceReconnect() {
        if (this.socket) {
            this.socket.disconnect();
            setTimeout(() => {
                this.socket.connect();
            }, 1000);
        }
    }
}
