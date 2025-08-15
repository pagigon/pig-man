// public/js/core/socket-client.js - 完全版（再接続システム対応 + チャット・ラウンド開始修正）

import { UIManager } from './ui-manager.js';

export class SocketClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connectionTimeout = null;
        // 🔧 【修正】各タブ/ウィンドウで独立したclientIdを生成
    this.clientId = 'pig-game-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + Math.floor(Math.random() * 10000);
    
    // 🔧 【追加】複数タブサポート
    this.tabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    // 🔧 【追加】再接続管理
    this.lastDisconnectReason = null;
    this.reconnectTimer = null;
    this.isInGame = false; // ゲーム中フラグ
    this.savedRoomData = null; // ルーム情報保存
    
    this.initialize();
}

    // 🔧 【修正】Socket.io設定で重複防止を無効化
initialize() {
    console.log('🔧 Socket.io 初期化開始（複数タブ対応版）');
    
    try {
        this.isConnecting = true;
        
        // Socket.io設定
        const socketConfig = {
            transports: ['websocket', 'polling'],
            timeout: 30000,
            forceNew: true,
            multiplex: false,
            upgrade: true,
            rememberUpgrade: true,
            autoConnect: true,
            query: {
                clientId: this.clientId,
                tabId: this.tabId,
                preventDuplicate: 'false', // 🔧 【重要】重複防止を無効化
                timestamp: Date.now(),
                allowMultipleTabs: 'true' // 🔧 【追加】複数タブ許可フラグ
            },
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'X-Client-Id': this.clientId,
                        'X-Tab-Id': this.tabId // 🔧 【追加】タブID
                    }
                },
                websocket: {
                    extraHeaders: {
                        'Cache-Control': 'no-cache',
                        'X-Client-Id': this.clientId,
                        'X-Tab-Id': this.tabId // 🔧 【追加】タブID
                    }
                }
            }
        };

        console.log('🔧 Socket.io設定（複数タブ対応）:', {
            transports: socketConfig.transports,
            forceNew: socketConfig.forceNew,
            clientId: socketConfig.query.clientId,
            tabId: socketConfig.query.tabId,
            preventDuplicate: socketConfig.query.preventDuplicate
        });
        
        // 既存のSocketがあれば完全に切断
        if (this.socket) {
            console.log('🔧 既存Socket切断中...');
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
        
        // 🔧 【修正】グローバル参照設定（タブIDを含む）
        if (!window.globalSocketInstances) {
            window.globalSocketInstances = new Map();
        }
        window.globalSocketInstances.set(this.tabId, this.socket);

        console.log('✅ Socket.io インスタンス作成成功（複数タブ対応版）');
        this.setupEventListeners();
        this.setupConnectionMonitoring();
        
    } catch (error) {
        console.error('❌ Socket.io 初期化エラー:', error);
        UIManager.showError('サーバー接続の初期化に失敗しました');
        this.isConnecting = false;
    }
}
    
    // 🔧 【追加】接続監視
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
    
    // 🔧 【修正】自動再参加システム
    handleAutoRejoin() {
        console.log('🔄 自動再参加チェック開始');
        
        try {
            // 保存されたゲーム情報を確認
            const savedPlayerInfo = this.getSavedGameInfo();
            
            if (!savedPlayerInfo || !savedPlayerInfo.roomId || !savedPlayerInfo.playerName) {
                console.log('📋 再参加情報なし - 通常ロビー表示');
                return false;
            }
            
            // ゲーム中だった場合のみ自動再参加
            if (savedPlayerInfo.gameState === 'playing') {
                console.log('🎮 ゲーム中断を検出 - 自動再参加実行');
                
                // 自動再参加実行（ユーザー確認付き）
                setTimeout(() => {
                    const shouldRejoin = confirm(
                        `前回のゲームが中断されました。\n` +
                        `ルーム: ${savedPlayerInfo.roomId}\n` +
                        `プレイヤー名: ${savedPlayerInfo.playerName}\n\n` +
                        `自動的に再参加しますか？`
                    );
                    
                    if (shouldRejoin) {
                        this.autoRejoinRoom(savedPlayerInfo);
                    } else {
                        this.clearSavedGameInfo();
                        UIManager.showError('再参加をキャンセルしました', 'warning');
                    }
                }, 1000);
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ 自動再参加チェックエラー:', error);
            return false;
        }
    }
    
    // 🔧 【追加】自動再参加実行
    autoRejoinRoom(savedInfo) {
        console.log('🔄 自動再参加実行:', savedInfo);
        
        try {
            // ゲーム状態を復元
            this.game.roomId = savedInfo.roomId;
            this.game.myName = savedInfo.playerName;
            this.game.isHost = savedInfo.isHost || false;
            this.isInGame = true;
            
            // 再参加リクエスト送信
            this.emit('rejoinRoom', {
                roomId: savedInfo.roomId,
                playerName: savedInfo.playerName
            });
            
            UIManager.showError('ゲームに再参加中...', 'warning');
            
        } catch (error) {
            console.error('❌ 自動再参加実行エラー:', error);
            this.clearSavedGameInfo();
            UIManager.showError('自動再参加に失敗しました');
        }
    }
    
    // 🔧 【修正】切断時の処理改良
    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始 (再接続対応)');
        
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
            self.lastDisconnectReason = null;
            
            // 接続後の処理を遅延実行
            setTimeout(function() {
                if (!self.handleAutoRejoin()) {
                    // 再参加しない場合は通常のロビー処理
                    self.getRoomList();
                    self.getOngoingGames();
                }
            }, 2000);
        });
        
        // 🔧 【修正】切断イベント処理強化
        this.socket.on('disconnect', function(reason) {
            console.log('❌ Socket.io 切断:', reason);
            
            self.lastDisconnectReason = reason;
            UIManager.showConnectionStatus('disconnected');
            self.isConnecting = false;
            
            // 🔧 【重要】ゲーム情報を保存（自動再参加用）
            if (self.isInGame && self.game.roomId && self.game.myName) {
                self.saveGameInfo({
                    roomId: self.game.roomId,
                    playerName: self.game.myName,
                    isHost: self.game.isHost,
                    gameState: self.game.gameData?.gameState || 'playing',
                    timestamp: Date.now()
                });
                console.log('💾 ゲーム情報を保存（再接続用）');
            }
            
            // フラグリセット
            if (self.game.roomManager && typeof self.game.roomManager.forceResetJoinState === 'function') {
                console.log('🔧 切断時のフラグリセット実行');
                self.game.roomManager.forceResetJoinState();
            }
            
            // 自動再接続の判定
            if (reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout') {
                console.log('🔄 ネットワーク問題による切断 - 自動再接続準備');
                UIManager.showError('接続が不安定です。自動的に再接続します...', 'warning');
                
                // 遅延再接続
                self.scheduleReconnect(3000);
                
            } else if (reason !== 'io client disconnect') {
                console.log('🔄 予期しない切断 - 再接続準備');
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
                
                self.scheduleReconnect(5000);
            }
        });
        
        // 接続エラー
        this.socket.on('connect_error', function(error) {
            console.error('❌ Socket.io 接続エラー:', error);
            self.reconnectAttempts++;
            self.isConnecting = false;
            
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
                self.clearSavedGameInfo(); // 失敗時は保存情報をクリア
            } else {
                UIManager.showError(`接続エラー (${self.reconnectAttempts}/${self.maxReconnectAttempts}): ${errorMessage}`, 'warning');
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
            
            // 再接続後の自動再参加チェックは connect イベントで処理される
        });
        
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
        
        // その他の既存イベントリスナー...
        this.setupOtherEventListeners();
        
        console.log('✅ Socket イベントリスナー設定完了（再接続対応）');
    }
    
    // 🔧 【修正】その他のイベントリスナー設定（完全版）
    setupOtherEventListeners() {
        const self = this;
        
        // ルーム一覧
        this.socket.on('roomList', function(rooms) {
            console.log('📋 ルーム一覧受信:', rooms);
            try {
                UIManager.updateRoomList(rooms || []);
            } catch (error) {
                console.error('ルーム一覧更新エラー:', error);
            }
        });
        
        // 進行中ゲーム
        this.socket.on('ongoingGames', function(games) {
            console.log('📋 進行中ゲーム一覧受信:', games);
            try {
                UIManager.updateOngoingGames(games || []);
            } catch (error) {
                console.error('進行中ゲーム一覧更新エラー:', error);
            }
        });
        
        // ルーム作成成功
        this.socket.on('roomCreated', function(data) {
            console.log('✅ ルーム作成成功:', data);
            try {
                self.game.onRoomCreated(data);
                self.isInGame = false; // まだゲーム開始前
            } catch (error) {
                console.error('ルーム作成処理エラー:', error);
                UIManager.showError('ルーム作成後の処理でエラーが発生しました');
            }
        });
        
        // ルーム参加成功
        this.socket.on('joinSuccess', function(data) {
            console.log('🎯 joinSuccess イベント受信確認!', data);
            console.log('✅ ルーム参加成功:', data);
            try {
                self.game.onJoinSuccess(data);
                self.isInGame = false; // まだゲーム開始前
            } catch (error) {
                console.error('ルーム参加処理エラー:', error);
                UIManager.showError('ルーム参加後の処理でエラーが発生しました');
            }
        });
        
        // 🔧 【追加】再入場成功処理
        this.socket.on('rejoinSuccess', function(data) {
            console.log('✅ 再入場成功:', data);
            try {
                self.game.onRejoinSuccess(data);
                self.isInGame = true;
                UIManager.showError('ゲームに再参加しました！', 'success');
            } catch (error) {
                console.error('再入場成功処理エラー:', error);
                UIManager.showError('再入場後の処理でエラーが発生しました');
            }
        });
        
        // 観戦成功
        this.socket.on('spectateSuccess', function(data) {
            console.log('✅ 観戦成功:', data);
            try {
                self.game.onSpectateSuccess(data);
            } catch (error) {
                console.error('観戦処理エラー:', error);
                UIManager.showError('観戦後の処理でエラーが発生しました');
            }
        });
        
        // 再接続失敗
        this.socket.on('reconnectFailed', function(data) {
            console.warn('❌ 再接続失敗:', data);
            try {
                // 🔧 【重要】再接続失敗時も必ずフラグリセット
                if (self.game.roomManager && typeof self.game.roomManager.forceResetJoinState === 'function') {
                    console.log('🔧 再接続失敗時のフラグリセット実行');
                    self.game.roomManager.forceResetJoinState();
                }
                
                const message = data?.message || '再接続に失敗しました';
                UIManager.showError(message, 'warning');
                
            } catch (error) {
                console.error('再接続失敗処理エラー:', error);
            }
        });
        
        // ゲーム更新
        this.socket.on('gameUpdate', function(gameData) {
            console.log('🎮 ゲーム状態更新');
            try {
                if (gameData && typeof gameData === 'object') {
                    self.game.gameData = gameData;
                    self.game.updateUI();
                    
                    // ゲーム状態の追跡
                    if (gameData.gameState === 'playing') {
                        self.isInGame = true;
                    } else if (gameData.gameState === 'finished') {
                        self.isInGame = false;
                        self.clearSavedGameInfo();
                    }
                }
            } catch (error) {
                console.error('ゲーム更新処理エラー:', error);
            }
        });
        
        // ゲーム開始/終了の追跡
        this.socket.on('gameStarted', function(gameData) {
            console.log('🎮 ゲーム開始検出');
            self.isInGame = true;
        });
        
        this.socket.on('gameEnded', function(data) {
            console.log('🏆 ゲーム終了検出');
            self.isInGame = false;
            self.clearSavedGameInfo(); // ゲーム終了時は保存情報をクリア
        });
        
        // 🔧 【修正】チャットメッセージ受信（正しいイベント名）
        this.socket.on('newMessage', function(messages) {
            console.log('💬 チャットメッセージ受信:', messages);
            try {
                if (messages && Array.isArray(messages)) {
                    UIManager.updateMessages(messages);
                }
            } catch (error) {
                console.error('チャットメッセージ処理エラー:', error);
            }
        });
        
        // 🔧 【追加】ラウンド開始イベント
        this.socket.on('roundStart', function(roundNumber) {
            console.log('🎮 ラウンド開始イベント受信:', roundNumber);
            try {
                // UIManagerでラウンド開始表示を実行
                UIManager.showRoundStartWithRecycle(roundNumber);
                console.log(`✅ ラウンド ${roundNumber} 開始表示完了`);
            } catch (error) {
                console.error('ラウンド開始表示エラー:', error);
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
        
        // エラー
        this.socket.on('error', function(error) {
            console.error('❌ サーバーエラー:', error);
            
            try {
                // フラグリセット
                if (self.game.roomManager && typeof self.game.roomManager.forceResetJoinState === 'function') {
                    console.log('🔧 エラー時：手動フラグリセット実行');
                    self.game.roomManager.forceResetJoinState();
                }
                
                if (self.game && typeof self.game.onError === 'function') {
                    self.game.onError(error);
                }
                
            } catch (resetError) {
                console.error('❌ エラー時フラグリセット失敗:', resetError);
                
                // 🔧 【最後の手段】DOM直接操作
                try {
                    const joinBtn = document.getElementById('join-room');
                    const createBtn = document.getElementById('create-room');
                    if (joinBtn) {
                        joinBtn.disabled = false;
                        joinBtn.textContent = 'ルームに参加';
                        joinBtn.style.opacity = '1';
                    }
                    if (createBtn) {
                        createBtn.disabled = false;
                        createBtn.textContent = 'ルームを作成';
                        createBtn.style.opacity = '1';
                    }
                    console.log('✅ DOM直接操作でボタン復旧完了');
                } catch (domError) {
                    console.error('❌ DOM直接操作も失敗:', domError);
                }
                
                // エラーメッセージ表示
                UIManager.showError(error?.message || 'サーバーエラーが発生しました');
            }
        });
    }
    
    // 🔧 【追加】スケジュール再接続
    scheduleReconnect(delay = 3000) {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectTimer = setTimeout(() => {
            if (!this.isConnected() && !this.isConnecting) {
                console.log('🔄 スケジュール再接続実行');
                this.forceReconnect();
            }
        }, delay);
    }
    
    // 🔧 【修正】強制再接続
    forceReconnect() {
        console.log('🔄 強制再接続開始');
        
        if (this.isConnecting) {
            console.warn('⚠️ 既に接続処理中');
            return;
        }
        
        this.isConnecting = true;
        
        try {
            // 既存接続を完全に切断
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
                this.socket.close();
                this.socket = null;
            }
            
            // 新しい接続を作成
            setTimeout(() => {
                this.initialize();
            }, 1000);
            
        } catch (error) {
            console.error('❌ 強制再接続エラー:', error);
            this.isConnecting = false;
            UIManager.showError('再接続に失敗しました');
        }
    }
    
    // 🔧 【追加】ゲーム情報の保存/取得（再接続用）
    saveGameInfo(gameInfo) {
        try {
            localStorage.setItem('pigGame_reconnectInfo', JSON.stringify(gameInfo));
            console.log('💾 ゲーム情報保存:', gameInfo);
        } catch (error) {
            console.error('❌ ゲーム情報保存エラー:', error);
        }
    }
    
    getSavedGameInfo() {
        try {
            const data = localStorage.getItem('pigGame_reconnectInfo');
            if (!data) return null;
            
            const gameInfo = JSON.parse(data);
            
            // 30分以上古い情報は削除
            if (Date.now() - gameInfo.timestamp > 30 * 60 * 1000) {
                this.clearSavedGameInfo();
                return null;
            }
            
            return gameInfo;
        } catch (error) {
            console.error('❌ ゲーム情報取得エラー:', error);
            return null;
        }
    }
    
    clearSavedGameInfo() {
        try {
            localStorage.removeItem('pigGame_reconnectInfo');
            console.log('🗑️ ゲーム情報クリア');
        } catch (error) {
            console.error('❌ ゲーム情報クリアエラー:', error);
        }
    }
    
    // 🔧 【追加】Transport名取得
    getTransportName() {
        try {
            return this.socket?.io?.engine?.transport?.name || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }
    
    // 基本的なSocket操作メソッド
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
        
        return this.emit('createRoom', { 
            playerName: playerName.trim(), 
            hasPassword: !!hasPassword, 
            password: password || '' 
        });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求:', { roomId, playerName, hasPassword: !!password });
        
        if (!roomId || !playerName) {
            UIManager.showError('ルームIDとプレイヤー名を入力してください');
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
        console.log('🔄 ルーム再入場要求:', { roomId, playerName });
        
        if (!roomId || !playerName) {
            UIManager.showError('ルームIDとプレイヤー名を入力してください');
            return false;
        }
        
        return this.emit('rejoinRoom', { 
            roomId: roomId.trim().toUpperCase(), 
            playerName: playerName.trim() 
        });
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

    leaveRoom() {
        console.log('🚪 ルーム退出要求');
        return this.emit('leaveRoom');
    }

    tempLeaveRoom() {
        console.log('⏸️ 一時退出要求');
        return this.emit('tempLeaveRoom');
    }

    returnToLobby() {
        console.log('🏠 ロビー復帰要求');
        return this.emit('returnToLobby');
    }

    startGame() {
        console.log('🎮 ゲーム開始要求');
        return this.emit('startGame');
    }

    restartGame() {
        console.log('🔄 連戦開始要求');
        return this.emit('restartGame');
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🎯 カード選択要求:', { targetPlayerId, cardIndex });
        return this.emit('selectCard', { targetPlayerId, cardIndex });
    }

    // 🔧 【修正】チャット送信（正しいイベント名・データ形式）
    sendChatMessage(message) {
        console.log('💬 チャット送信:', message);
        
        if (!message || message.trim().length === 0) {
            return false;
        }
        
        if (message.trim().length > 100) { // サーバー側に合わせて100文字制限
            UIManager.showError('メッセージは100文字以内で入力してください');
            return false;
        }
        
        // 🔧 【修正】サーバー側と一致するイベント名とデータ形式
        return this.emit('sendChat', message.trim());
    }
    
    // 状態確認メソッド
    isConnected() {
        return this.socket && this.socket.connected;
    }
    
    getSocketId() {
        return this.socket ? this.socket.id : null;
    }
    
    getDebugInfo() {
        return {
            connected: this.isConnected(),
            socketId: this.getSocketId(),
            isConnecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            lastDisconnectReason: this.lastDisconnectReason,
            isInGame: this.isInGame,
            hasSavedGameInfo: !!this.getSavedGameInfo(),
            clientId: this.clientId,
            transportName: this.getTransportName()
        };
    }
}
