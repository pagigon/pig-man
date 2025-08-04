// SocketClient クラス - Socket.io通信の責任を持つ（修正版）
import { UIManager } from './ui-manager.js';

export class SocketClient {
    constructor(game) {
        console.log('SocketClient 初期化開始');
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.connectionTimeout = null;
        this.isConnecting = false;
        this.initializeSocket();
    }

initializeSocket() {
    console.log('Socket.io 初期化開始 (Render対応)');
    
    if (typeof io === 'undefined') {
        console.error('❌ Socket.io が読み込まれていません');
        UIManager.showError('Socket.io ライブラリが読み込まれていません');
        return;
    }

    if (this.isConnecting) {
        console.warn('⚠️ Socket初期化中のため処理をスキップ');
        return;
    }

    this.isConnecting = true;

    try {
        const socketConfig = {
            transports: ['polling', 'websocket'],
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            forceNew: false,
            pingInterval: 25000,
            pingTimeout: 20000,
            upgrade: true,
            autoConnect: true,
            // 🔧 Render.com 対応の追加設定
            rememberUpgrade: false,
            transports: ['polling'], // WebSocket接続エラーを避けるため polling のみ使用
        };

        console.log('Socket.io 設定:', socketConfig);
        
        // 既存のSocketがあれば切断
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.socket = io(socketConfig);

        console.log('Socket.io インスタンス作成成功');
        this.setupEventListeners();
        this.setupConnectionMonitoring();
        
    } catch (error) {
        console.error('❌ Socket.io 初期化エラー:', error);
        UIManager.showError('サーバー接続の初期化に失敗しました');
        this.isConnecting = false;
    }
}

    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始');
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            this.isConnecting = false;
            return;
        }

        // 接続イベント
        this.socket.on('connect', () => {
            console.log('✅ Socket.io 接続成功:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);
            
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            
            // 接続後少し待ってからルーム一覧を取得
            setTimeout(() => {
                this.getRoomList();
                this.getOngoingGames();
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
            this.isConnecting = false;
            
            if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket.io 接続エラー:', error);
            this.reconnectAttempts++;
            this.isConnecting = false;
            
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
            this.isConnecting = false;
        });

        // ゲーム関連イベント
        this.socket.on('roomList', (rooms) => {
            console.log('📋 ルーム一覧受信:', rooms);
            try {
                UIManager.updateRoomList(rooms || []);
            } catch (error) {
                console.error('ルーム一覧更新エラー:', error);
            }
        });

        this.socket.on('ongoingGames', (games) => {
            console.log('📋 進行中ゲーム一覧受信:', games);
            try {
                UIManager.updateOngoingGames(games || []);
            } catch (error) {
                console.error('進行中ゲーム一覧更新エラー:', error);
            }
        });

        this.socket.on('roomCreated', (data) => {
            console.log('✅ ルーム作成成功:', data);
            try {
                this.game.onRoomCreated(data);
            } catch (error) {
                console.error('ルーム作成処理エラー:', error);
                UIManager.showError('ルーム作成後の処理でエラーが発生しました');
            }
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('✅ ルーム参加成功:', data);
            try {
                this.game.onJoinSuccess(data);
            } catch (error) {
                console.error('ルーム参加処理エラー:', error);
                UIManager.showError('ルーム参加後の処理でエラーが発生しました');
            }
        });

        this.socket.on('rejoinSuccess', (data) => {
            console.log('✅ 再入場成功:', data);
            try {
                this.game.onRejoinSuccess(data);
            } catch (error) {
                console.error('再入場処理エラー:', error);
                UIManager.showError('再入場後の処理でエラーが発生しました');
            }
        });

        this.socket.on('spectateSuccess', (data) => {
            console.log('✅ 観戦成功:', data);
            try {
                this.game.onSpectateSuccess(data);
            } catch (error) {
                console.error('観戦処理エラー:', error);
                UIManager.showError('観戦後の処理でエラーが発生しました');
            }
        });

        this.socket.on('reconnectSuccess', (data) => {
            console.log('✅ 再接続成功:', data);
            try {
                this.game.onReconnectSuccess(data);
            } catch (error) {
                console.error('再接続処理エラー:', error);
                UIManager.showError('再接続後の処理でエラーが発生しました');
            }
        });

        this.socket.on('gameUpdate', (gameData) => {
            console.log('🎮 ゲーム状態更新');
            try {
                if (gameData && typeof gameData === 'object') {
                    this.game.gameData = gameData;
                    this.game.updateUI();
                } else {
                    console.warn('⚠️ 無効なゲームデータ:', gameData);
                }
            } catch (error) {
                console.error('ゲーム状態更新エラー:', error);
            }
        });

        this.socket.on('newMessage', (messages) => {
            try {
                if (Array.isArray(messages)) {
                    UIManager.updateMessages(messages);
                } else {
                    console.warn('⚠️ 無効なメッセージデータ:', messages);
                }
            } catch (error) {
                console.error('メッセージ更新エラー:', error);
            }
        });

        this.socket.on('roundStart', (roundNumber) => {
            try {
                // 🔧 正しいカードリサイクル対応のラウンド開始表示
                if (UIManager.showRoundStartWithRecycle) {
                    UIManager.showRoundStartWithRecycle(roundNumber);
                } else {
                    UIManager.showRoundStart(roundNumber);
                }
            } catch (error) {
                console.error('ラウンド開始表示エラー:', error);
            }
        });

        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            try {
                this.game.onError(error);
            } catch (e) {
                console.error('エラー処理中のエラー:', e);
                UIManager.showError(error.message || 'サーバーエラーが発生しました');
            }
        });

        console.log('✅ Socket イベントリスナー設定完了');
    }

    setupConnectionMonitoring() {
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected()) {
                console.warn('⚠️ 初期接続がタイムアウトしました');
                UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
                this.isConnecting = false;
            }
        }, 15000);

        // 定期的な接続チェック
        setInterval(() => {
            if (this.socket && !this.socket.connected && !this.isConnecting) {
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
            
            // 再接続を試行
            if (!this.isConnecting) {
                this.forceReconnect();
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

    // 基本的なSocket操作メソッド
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
        
        // バリデーション
        if (!playerName || playerName.trim().length === 0) {
            UIManager.showError('プレイヤー名を入力してください');
            return false;
        }
        
        if (playerName.trim().length > 20) {
            UIManager.showError('プレイヤー名は20文字以内で入力してください');
            return false;
        }
        
        return this.emit('createRoom', { 
            playerName: playerName.trim(), 
            hasPassword: !!hasPassword, 
            password: password || '' 
        });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求:', { roomId, playerName });
        
        // バリデーション
        if (!roomId || roomId.trim().length === 0) {
            UIManager.showError('ルームIDを入力してください');
            return false;
        }
        
        if (!playerName || playerName.trim().length === 0) {
            UIManager.showError('プレイヤー名を入力してください');
            return false;
        }
        
        if (playerName.trim().length > 20) {
            UIManager.showError('プレイヤー名は20文字以内で入力してください');
            return false;
        }
        
        return this.emit('joinRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            playerName: playerName.trim(), 
            password: password || '' 
        });
    }

    rejoinRoom(roomId, playerName) {
        console.log('🔄 再入場要求:', { roomId, playerName });
        
        if (!roomId || !playerName) {
            UIManager.showError('ルームIDとプレイヤー名を入力してください');
            return false;
        }
        
        return this.emit('rejoinRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            playerName: playerName.trim() 
        });
    }

    tempLeaveRoom() {
        console.log('🚶 一時退出要求');
        return this.emit('tempLeaveRoom');
    }

    spectateRoom(roomId, spectatorName) {
        console.log('👁️ 観戦要求:', { roomId, spectatorName });
        
        if (!roomId || !spectatorName) {
            UIManager.showError('ルームIDと観戦者名を入力してください');
            return false;
        }
        
        return this.emit('spectateRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            spectatorName: spectatorName.trim() 
        });
    }

    reconnectToRoom(roomId, playerName) {
        console.log(`🔄 ルーム再接続を試行: ${playerName} -> ${roomId}`);
        
        if (!roomId || !playerName) {
            console.warn('再接続に必要な情報が不足');
            return false;
        }
        
        return this.emit('reconnectToRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            playerName: playerName.trim() 
        });
    }

    sendChat(message) {
        console.log('💬 チャット送信:', message);
        
        if (!message || message.trim().length === 0) {
            return false;
        }
        
        if (message.trim().length > 100) {
            UIManager.showError('メッセージは100文字以内で入力してください');
            return false;
        }
        
        return this.emit('sendChat', message.trim());
    }

    startGame() {
        console.log('🎮 ゲーム開始要求');
        return this.emit('startGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🃏 カード選択:', { targetPlayerId, cardIndex });
        
        if (!targetPlayerId || cardIndex === undefined || cardIndex === null) {
            UIManager.showError('無効なカード選択です');
            return false;
        }
        
        return this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        return this.emit('leaveRoom');
    }

    // ユーティリティメソッド
    isConnected() {
        return this.socket && this.socket.connected;
    }

    forceReconnect() {
        console.log('🔄 手動再接続開始');
        
        if (this.isConnecting) {
            console.warn('⚠️ 既に接続処理中');
            return;
        }
        
        this.isConnecting = true;
        
        if (this.socket) {
            try {
                this.socket.disconnect();
            } catch (error) {
                console.error('切断エラー:', error);
            }
        }
        
        setTimeout(() => {
            this.initializeSocket();
        }, 1000);
    }

    // デバッグ用メソッド
    getDebugInfo() {
        return {
            socketId: this.socket?.id || 'なし',
            connected: this.isConnected(),
            connecting: this.isConnecting,
            transport: this.socket?.io?.engine?.transport?.name || 'なし',
            reconnectAttempts: this.reconnectAttempts
        };
    }
}
