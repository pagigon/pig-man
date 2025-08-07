// SocketClient クラス - SyntaxError完全修正版
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

    // 🔧 【追加】ロビーに戻る
    returnToLobby() {
        console.log('🏠 ロビー復帰要求');
        return this.emit('returnToLobby');
    }
    
    // 🔧 【追加】連戦開始
    restartGame() {
        console.log('🔄 連戦開始要求');
        return this.emit('restartGame');
    }

    // 安全なプロパティアクセス関数
    safeGetProperty(obj, path, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        
        try {
            const keys = path.split('.');
            let current = obj;
            
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
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

// public/js/core/socket-client.js - initializeSocket関数の設定部分のみ修正

    initializeSocket() {
        console.log('Socket.io 初期化開始 (Render.com最適化v2)');
        
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
            // 🔧 【修正】Render.com環境に最適化されたSocket.io設定v2
            const socketConfig = {
                transports: ['polling'],
                forceNew: true,
                timeout: 45000,                    // 45秒に短縮
                pingTimeout: 120000,               // 2分に延長
                pingInterval: 60000,               // 1分に延長
                reconnection: true,
                reconnectionAttempts: 3,           // 3回に削減
                reconnectionDelay: 5000,           // 5秒に延長
                reconnectionDelayMax: 15000,       // 15秒に延長
                upgrade: false,
                rememberUpgrade: false,
                autoConnect: true,
                withCredentials: false,
                timestampRequests: false,          // タイムスタンプ無効化
                
                // 🔧 【追加】Render.com特有の設定
                query: {
                    t: Date.now()                  // キャッシュ回避用タイムスタンプ
                },
                
                // 🔧 【追加】エラー対策
                jsonp: false,
                forceJSONP: false,
                forceBase64: false
            };

            console.log('Socket.io 設定 (Render.com v2):', socketConfig);
            
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

            console.log('Socket.io インスタンス作成成功 (Render.com対応v2)');
            this.setupEventListeners();
            this.setupConnectionMonitoring();
            
        } catch (error) {
            console.error('❌ Socket.io 初期化エラー:', error);
            UIManager.showError('サーバー接続の初期化に失敗しました');
            this.isConnecting = false;
        }
    }

    setupConnectionMonitoring() {
        const self = this;
        
        this.connectionTimeout = setTimeout(function() {
            if (!self.isConnected()) {
                console.warn('⚠️ 初期接続がタイムアウトしました');
                UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
                self.isConnecting = false;
            }
        }, 30000);

        setInterval(function() {
            if (self.socket && !self.socket.connected && !self.isConnecting) {
                console.warn('⚠️ Socket接続が切れています - 自動再接続中...');
            }
        }, 60000);
    }

    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始 (Render.com対応)');

        // 🔧 【追加】ホスト変更イベント
this.socket.on('hostChanged', function(data) {
    console.log('👑 ホスト変更通知:', data);
    
    try {
        if (data && data.newHostId && data.newHostName) {
            // 自分が新しいホストになった場合
            if (data.newHostId === self.socket.id) {
                self.game.isHost = true;
                UIManager.showError(`あなたが新しいホストになりました！`, 'success');
                
                // ゲーム開始ボタンを表示
                if (self.game.gameData && self.game.gameData.gameState === 'waiting') {
                    const startButton = document.getElementById('start-game');
                    if (startButton) {
                        startButton.style.display = 'block';
                    }
                }
            } else {
                UIManager.showError(`${data.newHostName} が新しいホストになりました`, 'warning');
            }
        }
    } catch (error) {
        console.error('ホスト変更処理エラー:', error);
    }
});
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            this.isConnecting = false;
            return;
        }

        const self = this;

        // 接続成功
        this.socket.on('connect', function() {
            console.log('✅ Socket.io 接続成功:', self.socket.id);
            
            // Transport情報の安全な取得
            let transportName = 'unknown';
            try {
                transportName = self.getTransportName();
            } catch (e) {
                console.warn('Transport名取得エラー:', e);
            }
            console.log('Transport:', transportName);
            
            self.game.mySocketId = self.socket.id;
            UIManager.showConnectionStatus('connected');
            self.reconnectAttempts = 0;
            self.isConnecting = false;
            
            // 接続後の処理を遅延実行
            setTimeout(function() {
                self.getRoomList();
                self.getOngoingGames();
            }, 2000);
        });

        // 切断イベント
        this.socket.on('disconnect', function(reason) {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            self.isConnecting = false;
            
            if (reason === 'transport close' || reason === 'transport error') {
                console.log('🔄 Render.com環境での切断を検出 - 再接続準備中...');
                UIManager.showError('接続が不安定です。自動的に再接続します...', 'warning');
                
                setTimeout(function() {
                    if (!self.socket.connected && !self.isConnecting) {
                        self.forceReconnect();
                    }
                }, 3000);
            } else if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', function(error) {
            console.error('❌ Socket.io 接続エラー:', error);
            self.reconnectAttempts++;
            self.isConnecting = false;
            
            // エラーメッセージの安全な取得
            let errorMessage = '';
            try {
                errorMessage = error && error.message ? error.message : 'Unknown error';
            } catch (e) {
                errorMessage = 'Error parsing failed';
            }
            
            if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
                console.warn('🔧 Render.com環境での400エラーを検出');
                UIManager.showError('サーバーが一時的に利用できません。しばらく待ってから再試行してください。', 'warning');
            } else if (self.reconnectAttempts >= self.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
            } else {
                UIManager.showError('接続エラー (' + self.reconnectAttempts + '/' + self.maxReconnectAttempts + '): ' + errorMessage, 'warning');
            }
        });

        // 再接続試行
        this.socket.on('reconnect_attempt', function(attemptNumber) {
            console.log('🔄 再接続試行 ' + attemptNumber + '/' + self.maxReconnectAttempts + ' (Render.com対応)');
            UIManager.showError('再接続中... (' + attemptNumber + '/' + self.maxReconnectAttempts + ')', 'warning');
        });

        // 再接続成功
        this.socket.on('reconnect', function(attemptNumber) {
            console.log('✅ 再接続成功 (試行回数: ' + attemptNumber + ')');
            UIManager.showError('サーバーに再接続しました！', 'success');
            self.isConnecting = false;
        });

        // ゲーム関連イベント
        this.socket.on('roomList', function(rooms) {
            console.log('📋 ルーム一覧受信:', rooms);
            try {
                UIManager.updateRoomList(rooms || []);
            } catch (error) {
                console.error('ルーム一覧更新エラー:', error);
            }
        });

        this.socket.on('ongoingGames', function(games) {
            console.log('📋 進行中ゲーム一覧受信:', games);
            try {
                UIManager.updateOngoingGames(games || []);
            } catch (error) {
                console.error('進行中ゲーム一覧更新エラー:', error);
            }
        });

        this.socket.on('roomCreated', function(data) {
            console.log('✅ ルーム作成成功:', data);
            try {
                self.game.onRoomCreated(data);
            } catch (error) {
                console.error('ルーム作成処理エラー:', error);
                UIManager.showError('ルーム作成後の処理でエラーが発生しました');
            }
        });

        this.socket.on('joinSuccess', function(data) {
            console.log('✅ ルーム参加成功:', data);
            try {
                self.game.onJoinSuccess(data);
            } catch (error) {
                console.error('ルーム参加処理エラー:', error);
                UIManager.showError('ルーム参加後の処理でエラーが発生しました');
            }
        });

        this.socket.on('rejoinSuccess', function(data) {
            console.log('✅ 再入場成功:', data);
            try {
                self.game.onRejoinSuccess(data);
            } catch (error) {
                console.error('再入場処理エラー:', error);
                UIManager.showError('再入場後の処理でエラーが発生しました');
            }
        });

        this.socket.on('spectateSuccess', function(data) {
            console.log('✅ 観戦成功:', data);
            try {
                self.game.onSpectateSuccess(data);
            } catch (error) {
                console.error('観戦処理エラー:', error);
                UIManager.showError('観戦後の処理でエラーが発生しました');
            }
        });

        this.socket.on('reconnectSuccess', function(data) {
            console.log('✅ 再接続成功:', data);
            try {
                self.game.onReconnectSuccess(data);
            } catch (error) {
                console.error('再接続処理エラー:', error);
                UIManager.showError('再接続後の処理でエラーが発生しました');
            }
        });

        this.socket.on('gameUpdate', function(gameData) {
            console.log('🎮 ゲーム状態更新');
            try {
                if (gameData && typeof gameData === 'object') {
                    self.game.gameData = gameData;
                    self.game.updateUI();
                } else {
                    console.warn('⚠️ 無効なゲームデータ:', gameData);
                }
            } catch (error) {
                console.error('ゲーム状態更新エラー:', error);
            }
        });

        this.socket.on('newMessage', function(messages) {
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

        this.socket.on('roundStart', function(roundNumber) {
            try {
                if (UIManager.showRoundStartWithRecycle) {
                    UIManager.showRoundStartWithRecycle(roundNumber);
                } else {
                    UIManager.showRoundStart(roundNumber);
                }
            } catch (error) {
                console.error('ラウンド開始表示エラー:', error);
            }
        });

            this.socket.on('error', function(error) {
            console.error('❌ サーバーエラー:', error);
            try {
                self.game.onError(error);
            } catch (e) {
                console.error('エラー処理中のエラー:', e);
                UIManager.showError(error.message || 'サーバーエラーが発生しました');
            }
        });

        // 🔧 【追加】切断プレイヤー待機の処理
this.socket.on('waitingForReconnect', function(data) {
    console.log('⏸️ プレイヤー切断により待機中:', data);
    
    try {
        if (data && data.disconnectedPlayers && Array.isArray(data.disconnectedPlayers)) {
            const playerNames = data.disconnectedPlayers.join(', ');
            const message = data.message || `${playerNames} が切断されました。復帰をお待ちください...`;
            UIManager.showError(message, 'warning');
        } else if (data && data.message) {
            UIManager.showError(data.message, 'warning');
        } else {
            UIManager.showError('プレイヤーの復帰をお待ちください...', 'warning');
        }
    } catch (error) {
        console.error('切断待機メッセージ処理エラー:', error);
    }
});

        // 🔧 【追加】プレイヤー切断時の待機処理
        this.socket.on('waitingForReconnect', function(data) {
            console.log('⏸️ プレイヤー切断により待機中:', data);
            
            if (data && data.disconnectedPlayers) {
                const playerNames = data.disconnectedPlayers.join(', ');
                UIManager.showError(`${playerNames} が切断されました。復帰をお待ちください...`, 'warning');
            } else {
                UIManager.showError('プレイヤーの復帰をお待ちください...', 'warning');
            }
        });

        console.log('✅ Socket イベントリスナー設定完了');
    }

    emit(event, data) {
        console.log('📤 Socket送信: ' + event, data);
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            UIManager.showError('サーバー接続が初期化されていません');
            return false;
        }

        if (!this.socket.connected) {
            console.error('❌ Socket 未接続');
            UIManager.showError('サーバーに接続されていません。接続を確認中...');
            
            if (!this.isConnecting) {
                this.forceReconnect();
            }
            return false;
        }

        try {
            this.socket.emit(event, data);
            console.log('✅ Socket送信成功: ' + event);
            return true;
        } catch (error) {
            console.error('❌ Socket送信エラー: ' + event, error);
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
        console.log('🏠 ルーム作成要求:', { playerName: playerName, hasPassword: !!hasPassword });
        
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
        console.log('👥 ルーム参加要求:', { roomId: roomId, playerName: playerName });
        
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
        console.log('🔄 再入場要求:', { roomId: roomId, playerName: playerName });
        
        if (!roomId || !playerName) {
            UIManager.showError('ルームIDとプレイヤー名を入力してください');
            return false;
        }
        
        return this.emit('rejoinRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            playerName: playerName.trim() 
        });
    }

    checkAutoReconnect(roomId, playerName) {
    console.log('🔍 自動復帰チェック要求:', { roomId, playerName });
    
    if (!this.socket || !this.socket.connected) {
        console.error('❌ Socket未接続のため自動復帰チェック不可');
        return false;
    }
    
    if (!roomId || !playerName) {
    console.log('🔍 復帰チェック: 情報不足のため無視（正常動作）');
    return false;
}
    
    try {
        this.socket.emit('checkAutoReconnect', {
            roomId: roomId.trim().toUpperCase(),
            playerName: playerName.trim()
        });
        
        console.log('✅ 自動復帰チェック送信成功');
        return true;
    } catch (error) {
        console.error('❌ 自動復帰チェック送信エラー:', error);
        return false;
    }
}

    tempLeaveRoom() {
        console.log('🚶 一時退出要求');
        return this.emit('tempLeaveRoom');
    }

    spectateRoom(roomId, spectatorName) {
        console.log('👁️ 観戦要求:', { roomId: roomId, spectatorName: spectatorName });
        
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
        console.log('🔄 ルーム再接続を試行: ' + playerName + ' -> ' + roomId);
        
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
        console.log('🃏 カード選択:', { targetPlayerId: targetPlayerId, cardIndex: cardIndex });
        
        if (!targetPlayerId || cardIndex === undefined || cardIndex === null) {
            UIManager.showError('無効なカード選択です');
            return false;
        }
        
        return this.emit('selectCard', { targetPlayerId: targetPlayerId, cardIndex: cardIndex });
    }

    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        return this.emit('leaveRoom');
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
        
        const self = this;
        setTimeout(function() {
            self.initializeSocket();
        }, 1000);
    }

    // デバッグ用メソッド
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
}
