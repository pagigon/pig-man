// public/js/core/socket-client.js - 再接続システム修正版

class SocketClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connectionTimeout = null;
        this.clientId = 'pig-game-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // 🔧 【追加】再接続管理
        this.lastDisconnectReason = null;
        this.reconnectTimer = null;
        this.isInGame = false; // ゲーム中フラグ
        this.savedRoomData = null; // ルーム情報保存
        
        this.initialize();
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
            
            self.game.mySocketId = self.socket.id;
            UIManager.showConnectionStatus('connected');
            self.reconnectAttempts = 0;
            self.isConnecting = false;
            self.lastDisconnectReason = null;
            
            // 🔧 【重要】接続後に自動再参加チェック
            setTimeout(() => {
                if (!self.handleAutoRejoin()) {
                    // 再参加しない場合は通常のロビー処理
                    self.getRoomList();
                    self.getOngoingGames();
                }
            }, 1000);
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
            
            if (self.reconnectAttempts >= self.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
                self.clearSavedGameInfo(); // 失敗時は保存情報をクリア
            } else {
                UIManager.showError(`接続エラー (${self.reconnectAttempts}/${self.maxReconnectAttempts}): ${errorMessage}`, 'warning');
            }
        });
        
        // 再接続成功
        this.socket.on('reconnect', function(attemptNumber) {
            console.log('✅ 再接続成功 (試行回数: ' + attemptNumber + ')');
            UIManager.showError('サーバーに再接続しました！', 'success');
            self.isConnecting = false;
            
            // 再接続後の自動再参加チェックは connect イベントで処理される
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
        
        // 🔧 【追加】再入場失敗処理
        this.socket.on('rejoinFailed', function(data) {
            console.warn('❌ 再入場失敗:', data);
            self.clearSavedGameInfo();
            self.isInGame = false;
            
            const message = data?.message || '再入場に失敗しました';
            UIManager.showError(message, 'warning');
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
        
        // その他の既存イベントリスナー...
        this.setupOtherEventListeners();
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
    
    // 🔧 【追加】ゲーム情報の保存/取得
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
    
    // 🔧 【修正】その他のイベントリスナー設定
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
            console.log('✅ ルーム参加成功:', data);
            try {
                self.game.onJoinSuccess(data);
                self.isInGame = false; // まだゲーム開始前
            } catch (error) {
                console.error('ルーム参加処理エラー:', error);
                UIManager.showError('ルーム参加後の処理でエラーが発生しました');
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
                UIManager.showError(error?.message || 'サーバーエラーが発生しました');
            }
        });
        
        console.log('✅ Socket イベントリスナー設定完了（再接続対応）');
    }
    
    // 既存のメソッドはそのまま維持...
    
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
            clientId: this.clientId
        };
    }
}

export { SocketClient };
