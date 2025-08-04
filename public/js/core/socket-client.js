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

    // 🔧 安全なプロパティアクセス関数を追加
    safeGetProperty(obj, path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let current = obj;
            
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }
            
            return current;
        } catch (error) {
            console.warn('プロパティアクセスエラー:', error);
            return defaultValue;
        }
    }

    // Transport名の安全な取得
    getTransportName() {
        return this.safeGetProperty(this.socket, 'io.engine.transport.name', 'unknown');
    }

    // Socket IDの安全な取得
    getSocketId() {
        return this.safeGetProperty(this.socket, 'id', 'なし');
    }

    // 接続状態の確認
    isConnected() {
        try {
            return this.socket && this.socket.connected === true;
        } catch (error) {
            console.warn('接続状態確認エラー:', error);
            return false;
        }
    }

    // 修正されたデバッグ情報取得
    getDebugInfo() {
        try {
            return {
                socketId: this.getSocketId(),
                connected: this.isConnected(),
                connecting: this.isConnecting,
                transport: this.getTransportName(),
                reconnectAttempts: this.reconnectAttempts
            };
        } catch (error) {
            console.error('デバッグ情報取得エラー:', error);
            return {
                error: 'デバッグ情報取得失敗'
            };
        }
    }
    
initializeSocket() {
    console.log('Socket.io 初期化開始 (Render.com最適化)');
    
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
        // 🔧 Render.com環境に最適化されたSocket.io設定
        const socketConfig = {
            // Render.comでの接続問題を回避
            transports: ['polling'],          // pollingのみ使用（WebSocket無効）
            forceNew: true,                   // 強制的に新しい接続を作成
            
            // タイムアウト設定
            timeout: 30000,                   // 接続タイムアウトを30秒に延長
            pingTimeout: 60000,               // pingタイムアウトを60秒に延長
            pingInterval: 25000,              // pingを25秒間隔で送信
            
            // 再接続設定
            reconnection: true,
            reconnectionAttempts: 5,          // 再接続試行回数を削減
            reconnectionDelay: 3000,          // 再接続間隔を3秒に延長
            reconnectionDelayMax: 10000,
            
            // Render.com固有の設定
            upgrade: false,                   // transport upgradeを無効化
            rememberUpgrade: false,
            autoConnect: true,
            
            // 追加のステーブル化設定
            withCredentials: false,
            timestampRequests: true,
            timestampParam: 't'
        };

        console.log('Socket.io 設定 (Render.com最適化):', socketConfig);
        
        // 既存のSocketがあれば完全に切断
        if (this.socket) {
            console.log('既存Socket切断中...');
            try {
                this.socket.removeAllListeners();
                this.socket.disconnect();
                this.socket.close();
            } catch (e) {
                console.warn('既存Socket切断時のエラー:', e);
            }
            this.socket = null;
        }

        // 新しいSocket接続を作成
        this.socket = io(socketConfig);

        console.log('Socket.io インスタンス作成成功 (Render.com対応)');
        this.setupEventListeners();
        this.setupConnectionMonitoring();
        
    } catch (error) {
        console.error('❌ Socket.io 初期化エラー:', error);
        UIManager.showError('サーバー接続の初期化に失敗しました');
        this.isConnecting = false;
    }
}

// 🔧 接続監視の改良
setupConnectionMonitoring() {
    this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected()) {
            console.warn('⚠️ 初期接続がタイムアウトしました');
            UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
            this.isConnecting = false;
        }
    }, 30000); // タイムアウトを30秒に延長

    // 🔧 定期的な接続チェックの頻度を削減（負荷軽減）
    setInterval(() => {
        if (this.socket && !this.socket.connected && !this.isConnecting) {
            console.warn('⚠️ Socket接続が切れています - 自動再接続中...');
            // 自動再接続を無効化（Render.comでは手動制御の方が安定）
        }
    }, 60000); // 60秒間隔に変更
}

// 🔧 エラーハンドリングの強化
setupEventListeners() {
    console.log('Socket イベントリスナー設定開始 (Render.com対応)');
    
    if (!this.socket) {
        console.error('❌ Socket が存在しません');
        this.isConnecting = false;
        return;
    }

    // 接続成功
    this.socket.on('connect', () => {
        console.log('✅ Socket.io 接続成功:', this.socket.id);
        console.log('Transport:', this.socket && this.socket.io && this.socket.io.engine && this.socket.io.engine.transport ? this.socket.io.engine.transport.name : 'unknown');
        
        this.game.mySocketId = this.socket.id;
        UIManager.showConnectionStatus('connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // 接続後の処理を遅延実行（Render.com環境での安定化）
        setTimeout(() => {
            this.getRoomList();
            this.getOngoingGames();
        }, 2000); // 2秒遅延
    });

    // 切断イベント（改良版）
    this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket.io 切断:', reason);
        UIManager.showConnectionStatus('disconnected');
        this.isConnecting = false;
        
        // Render.com環境でよくある切断理由への対応
        if (reason === 'transport close' || reason === 'transport error') {
            console.log('🔄 Render.com環境での切断を検出 - 再接続準備中...');
            UIManager.showError('接続が不安定です。自動的に再接続します...', 'warning');
            
            // 3秒後に再接続を試行
            setTimeout(() => {
                if (!this.socket.connected && !this.isConnecting) {
                    this.forceReconnect();
                }
            }, 3000);
        } else if (reason !== 'io client disconnect') {
            UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
        }
    });

    // エラーイベント（改良版）
    this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.io 接続エラー:', error);
        this.reconnectAttempts++;
        this.isConnecting = false;
        
        // Render.com環境での一般的なエラーへの対応
        if (error.message.includes('400') || error.message.includes('Bad Request')) {
            console.warn('🔧 Render.com環境での400エラーを検出');
            UIManager.showError('サーバーが一時的に利用できません。しばらく待ってから再試行してください。', 'warning');
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
        } else {
            UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`, 'warning');
        }
    });

    // 再接続試行（改良版）
    this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 再接続試行 ${attemptNumber}/${this.maxReconnectAttempts} (Render.com対応)`);
        UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`, 'warning');
    });

    // 再接続成功
    this.socket.on('reconnect', (attemptNumber) => {
        console.log(`✅ 再接続成功 (試行回数: ${attemptNumber})`);
        UIManager.showError('サーバーに再接続しました！', 'success');
        this.isConnecting = false;
    });

}

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

    // デバッグ用メソッドの修正
getDebugInfo() {
    try {
        return {
            socketId: this.socket && this.socket.id ? this.socket.id : 'なし',
            connected: this.isConnected(),
            connecting: this.isConnecting,
            transport: this.socket && this.socket.io && this.socket.io.engine && this.socket.io.engine.transport ? this.socket.io.engine.transport.name : 'なし',
            reconnectAttempts: this.reconnectAttempts
        };
    } catch (error) {
        console.error('デバッグ情報取得エラー:', error);
        return {
            error: 'デバッグ情報取得失敗',
            socketId: 'エラー',
            connected: false,
            connecting: false,
            transport: 'エラー',
            reconnectAttempts: 0
        };
    }
}

// setupEventListeners内の接続成功処理も修正
this.socket.on('connect', () => {
    console.log('✅ Socket.io 接続成功:', this.socket.id);
    
    // Transport情報の安全な取得
    let transportName = 'unknown';
    try {
        if (this.socket && this.socket.io && this.socket.io.engine && this.socket.io.engine.transport) {
            transportName = this.socket.io.engine.transport.name;
        }
    } catch (e) {
        console.warn('Transport名取得エラー:', e);
    }
    console.log('Transport:', transportName);
    
    this.game.mySocketId = this.socket.id;
    UIManager.showConnectionStatus('connected');
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    
    // 接続後の処理を遅延実行
    setTimeout(() => {
        this.getRoomList();
        this.getOngoingGames();
    }, 2000);
});

// エラーハンドリングでのオプショナルチェーニング修正
this.socket.on('connect_error', (error) => {
    console.error('❌ Socket.io 接続エラー:', error);
    this.reconnectAttempts++;
    this.isConnecting = false;
    
    // エラーメッセージの安全な取得
    let errorMessage = '';
    try {
        errorMessage = error && error.message ? error.message : 'Unknown error';
    } catch (e) {
        errorMessage = 'Error parsing failed';
    }
    
    // 400エラーの検出
    if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        console.warn('🔧 Render.com環境での400エラーを検出');
        UIManager.showError('サーバーが一時的に利用できません。しばらく待ってから再試行してください。', 'warning');
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
    } else {
        UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${errorMessage}`, 'warning');
    }
});
