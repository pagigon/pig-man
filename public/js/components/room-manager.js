// ルーム管理コンポーネント（修正版）
import { UIManager } from '../core/ui-manager.js';
import { StorageManager } from '../utils/storage.js';
import { safeGetElement } from '../utils/helpers.js';

export class RoomManager {
    constructor(game) {
        this.game = game;
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.lastCreateAttempt = 0;
        this.joinCooldown = 3000; // 3秒のクールダウン
        this.createCooldown = 5000; // 5秒のクールダウン
    }

    // 重複防止付きルーム作成
    createRoom() {
        console.log('🏠 ルーム作成処理開始');
        
        const now = Date.now();
        
        // クールダウンチェック
        if (now - this.lastCreateAttempt < this.createCooldown) {
            const remaining = Math.ceil((this.createCooldown - (now - this.lastCreateAttempt)) / 1000);
            console.warn(`⚠️ 作成クールダウン中: あと${remaining}秒`);
            UIManager.showError(`${remaining}秒後に再試行してください`, 'warning');
            return;
        }
        
        // 重複作成防止
        if (this.isCreating) {
            console.warn('⚠️ ルーム作成中のため処理をスキップ');
            UIManager.showError('ルーム作成中です。しばらくお待ちください。', 'warning');
            return;
        }
        
        if (!this.game.socketClient.isConnected()) {
            console.error('❌ ルーム作成失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません。再接続ボタンを押してください。');
            return;
        }

        try {
            const nameInput = safeGetElement('player-name-create');
            const passwordCheck = safeGetElement('use-password');
            const passwordInput = safeGetElement('room-password');

            if (!nameInput) {
                console.error('❌ プレイヤー名入力欄が見つかりません');
                UIManager.showError('プレイヤー名入力欄が見つかりません');
                return;
            }

            const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
            const hasPassword = passwordCheck ? passwordCheck.checked : false;
            const password = hasPassword && passwordInput ? passwordInput.value : '';

            // バリデーション
            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内で入力してください');
                return;
            }

            console.log('ルーム作成パラメータ:', {
                playerName,
                hasPassword,
                passwordLength: password.length
            });

            this.game.myName = playerName;
            UIManager.showPlayerName(this.game.myName);

            // 作成中フラグを設定
            this.isCreating = true;
            this.lastCreateAttempt = now;
            this.updateButtonStates();
            
            const success = this.game.socketClient.createRoom(playerName, hasPassword, password);
            
            if (success) {
                UIManager.showError('ルームを作成中...', 'warning');
                
                // タイムアウト処理
                setTimeout(() => {
                    if (this.isCreating && !this.game.roomId) {
                        console.warn('⚠️ ルーム作成がタイムアウトしました');
                        this.isCreating = false;
                        this.updateButtonStates();
                        UIManager.showError('ルーム作成に時間がかかっています。もう一度お試しください。', 'warning');
                    }
                }, 15000);
            } else {
                this.isCreating = false;
                this.updateButtonStates();
            }
        } catch (error) {
            console.error('ルーム作成処理エラー:', error);
            this.isCreating = false;
            this.updateButtonStates();
            UIManager.showError('ルーム作成中にエラーが発生しました');
        }
    }

    // 重複防止付きルーム参加
    joinRoom() {
        console.log('👥 ルーム参加処理開始');
        
        const now = Date.now();
        
        // クールダウンチェック
        if (now - this.lastJoinAttempt < this.joinCooldown) {
            const remaining = Math.ceil((this.joinCooldown - (now - this.lastJoinAttempt)) / 1000);
            console.warn(`⚠️ クールダウン中: あと${remaining}秒`);
            UIManager.showError(`${remaining}秒後に再試行してください`, 'warning');
            return;
        }
        
        // 重複参加防止
        if (this.isJoining) {
            console.warn('⚠️ ルーム参加中のため処理をスキップ');
            UIManager.showError('ルーム参加中です。しばらくお待ちください。', 'warning');
            return;
        }
        
        if (!this.game.socketClient.isConnected()) {
            console.error('❌ ルーム参加失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません');
            return;
        }

        try {
            const nameInput = safeGetElement('player-name-join');
            const roomInput = safeGetElement('room-id-input');
            const passwordInput = safeGetElement('join-password');

            if (!nameInput || !roomInput) {
                console.error('❌ 必要な入力欄が見つかりません');
                UIManager.showError('入力欄が見つかりません');
                return;
            }

            const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
            const roomId = roomInput.value.trim().toUpperCase();
            const password = passwordInput ? passwordInput.value : '';

            // バリデーション
            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                return;
            }

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内で入力してください');
                return;
            }

            console.log('ルーム参加パラメータ:', { playerName, roomId });

            this.game.myName = playerName;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName);

            // 参加中フラグを設定
            this.isJoining = true;
            this.lastJoinAttempt = now;
            this.updateButtonStates();
            
            const success = this.game.socketClient.joinRoom(roomId, playerName, password);
            
            if (success) {
                UIManager.showError('ルームに参加中...', 'warning');
                
                // タイムアウト処理
                setTimeout(() => {
                    if (this.isJoining && (!this.game.gameData || this.game.gameData.id !== roomId)) {
                        console.warn('⚠️ ルーム参加がタイムアウトしました');
                        this.isJoining = false;
                        this.updateButtonStates();
                        UIManager.showError('ルーム参加に時間がかかっています。もう一度お試しください。', 'warning');
                    }
                }, 10000);
            } else {
                this.isJoining = false;
                this.updateButtonStates();
            }
        } catch (error) {
            console.error('ルーム参加処理エラー:', error);
            this.isJoining = false;
            this.updateButtonStates();
            UIManager.showError('ルーム参加中にエラーが発生しました');
        }
    }

    rejoinRoom() {
        console.log('🔄 再入場処理開始');
        
        try {
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

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内で入力してください');
                return;
            }

            this.game.myName = playerName;
            UIManager.showPlayerName(this.game.myName);
            this.game.roomId = roomId;
            
            const success = this.game.socketClient.rejoinRoom(roomId, playerName);
            if (success) {
                UIManager.showError('再入場を試行中...', 'warning');
            }
        } catch (error) {
            console.error('再入場処理エラー:', error);
            UIManager.showError('再入場中にエラーが発生しました');
        }
    }

    spectateRoom() {
        console.log('👁️ 観戦処理開始');
        
        try {
            const nameInput = safeGetElement('spectator-name');
            const roomInput = safeGetElement('spectate-room-id');
            
            const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
            const roomId = roomInput?.value.trim().toUpperCase() || '';

            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                return;
            }

            if (spectatorName.length > 20) {
                UIManager.showError('観戦者名は20文字以内で入力してください');
                return;
            }

            this.game.myName = spectatorName;
            this.game.isSpectator = true;
            UIManager.showPlayerName(this.game.myName + ' (観戦)');
            this.game.roomId = roomId;
            
            const success = this.game.socketClient.spectateRoom(roomId, spectatorName);
            if (success) {
                UIManager.showError('観戦を開始中...', 'warning');
            }
        } catch (error) {
            console.error('観戦処理エラー:', error);
            UIManager.showError('観戦中にエラーが発生しました');
        }
    }

    showTempLeaveDialog() {
        try {
            if (this.game.gameData && this.game.gameData.gameState === 'playing') {
                const tempLeaveSection = safeGetElement('temp-leave-section');
                if (tempLeaveSection) {
                    tempLeaveSection.style.display = 'block';
                }
                UIManager.showScreen('room-info');
                const roomIdDisplay = safeGetElement('room-id-display');
                if (roomIdDisplay && this.game.roomId) {
                    roomIdDisplay.textContent = this.game.roomId;
                }
            } else {
                this.leaveRoom();
            }
        } catch (error) {
            console.error('一時退出ダイアログ表示エラー:', error);
            this.leaveRoom(); // フォールバック
        }
    }

    cancelTempLeave() {
        try {
            const tempLeaveSection = safeGetElement('temp-leave-section');
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'none';
            }
            if (this.game.gameData && this.game.gameData.gameState === 'playing') {
                UIManager.showScreen('game-board');
            }
        } catch (error) {
            console.error('一時退出キャンセルエラー:', error);
        }
    }

    tempLeaveRoom() {
        try {
            const rejoinInfo = {
                roomId: this.game.roomId,
                playerName: this.game.myName,
                tempLeft: true,
                timestamp: Date.now()
            };
            
            StorageManager.saveRejoinInfo(rejoinInfo);

            this.game.socketClient.tempLeaveRoom();
            
            this.resetGameState();
            
            UIManager.showSpectatorMode(false);
            UIManager.showScreen('lobby');
            
            this.populateRejoinInfo(rejoinInfo);
            
            UIManager.showError('一時退出しました。同じプレイヤー名とルームIDで再入場できます。', 'warning');
        } catch (error) {
            console.error('一時退出処理エラー:', error);
            UIManager.showError('一時退出中にエラーが発生しました');
        }
    }

    populateRejoinInfo(rejoinInfo) {
        try {
            if (!rejoinInfo || typeof rejoinInfo !== 'object') return;
            
            const rejoinPlayerNameEl = safeGetElement('rejoin-player-name');
            const rejoinRoomIdEl = safeGetElement('rejoin-room-id');
            
            if (rejoinPlayerNameEl && rejoinInfo.playerName) {
                rejoinPlayerNameEl.value = rejoinInfo.playerName;
            }
            if (rejoinRoomIdEl && rejoinInfo.roomId) {
                rejoinRoomIdEl.value = rejoinInfo.roomId;
            }
        } catch (error) {
            console.error('再入場情報設定エラー:', error);
        }
    }

    leaveRoom() {
        try {
            if (this.game.socketClient.isConnected()) {
                this.game.socketClient.leaveRoom();
            }
            
            this.resetGameState();
            
            StorageManager.clearPlayerInfo();
            
            UIManager.showSpectatorMode(false);
            UIManager.showScreen('lobby');
            
            UIManager.showError('ルームを退出しました', 'success');
        } catch (error) {
            console.error('ルーム退出処理エラー:', error);
            this.resetGameState(); // エラーでもゲーム状態はリセット
            UIManager.showScreen('lobby');
        }
    }

    // ゲーム状態のリセット
    resetGameState() {
        this.game.roomId = null;
        this.game.gameData = null;
        this.game.isHost = false;
        this.game.isSpectator = false;
        
        // フラグもリセット
        this.isJoining = false;
        this.isCreating = false;
        this.updateButtonStates();
    }

    // ボタンの無効化/有効化
    updateButtonStates() {
        try {
            const createBtn = safeGetElement('create-room');
            const joinBtn = safeGetElement('join-room');
            
            if (createBtn) {
                createBtn.disabled = this.isCreating;
                createBtn.textContent = this.isCreating ? '作成中...' : 'ルームを作成';
            }
            
            if (joinBtn) {
                joinBtn.disabled = this.isJoining;
                joinBtn.textContent = this.isJoining ? '参加中...' : 'ルームに参加';
            }
        } catch (error) {
            console.error('ボタン状態更新エラー:', error);
        }
    }

    // 再接続の試行
attemptReconnection() {
    try {
        console.log('🔄 自動復帰処理開始');

        const rejoinInfo = StorageManager.getRejoinInfo();
if (rejoinInfo) {
    console.log('保存された再入場情報:', rejoinInfo);
    
    // 自動復帰を試行
    if (this.game.socketClient.isConnected() && rejoinInfo.roomId && rejoinInfo.playerName) {
    console.log('🔍 自動復帰可能性をチェック中...');
    this.game.socketClient.checkAutoReconnect(rejoinInfo.roomId, rejoinInfo.playerName);
} else {
    console.log('🔍 復帰情報が不完全のため自動復帰チェックをスキップ');
}
    
    // UIに情報を設定
    this.populateRejoinInfo(rejoinInfo);
    UIManager.showError('前回のゲームへの復帰情報が見つかりました。「ゲームに再入場」ボタンから復帰できます。', 'warning');
    return;
}

// 通常の再接続情報もチェック
const savedPlayerInfo = StorageManager.getPlayerInfo();
if (savedPlayerInfo && savedPlayerInfo.roomId) {
    console.log('保存された接続情報で再接続を試行:', savedPlayerInfo);
    
    // 少し遅延させて接続を試行
    setTimeout(() => {
        if (this.game.socketClient.isConnected()) {
            console.log('🔄 自動再接続を試行します');
            this.game.socketClient.reconnectToRoom(savedPlayerInfo.roomId, savedPlayerInfo.playerName);
        }
    }, 2000);
} else {
    console.log('復帰可能な情報が見つかりませんでした');
}

        
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            StorageManager.clearAllData();
        }
    }

    // 成功コールバック
    onRoomCreated(data) {
        console.log('✅ ルーム作成成功コールバック:', data);
        
        try {
            // 作成中フラグをリセット
            this.isCreating = false;
            this.updateButtonStates();
            
            if (!data || typeof data !== 'object') {
                throw new Error('無効なルーム作成データ');
            }
            
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = true;
            
            if (data.playerInfo) {
                StorageManager.savePlayerInfo(data.playerInfo);
            }

            UIManager.showError(`ルーム ${data.roomId} を作成しました！`, 'success');
            this.showRoomInfo();
        } catch (error) {
            console.error('ルーム作成成功処理エラー:', error);
            this.isCreating = false;
            this.updateButtonStates();
            UIManager.showError('ルーム作成後の処理でエラーが発生しました');
        }
    }

    onJoinSuccess(data) {
        console.log('✅ ルーム参加成功コールバック:', data);
        
        try {
            // 参加中フラグをリセット
            this.isJoining = false;
            this.updateButtonStates();
            
            if (!data || typeof data !== 'object') {
                throw new Error('無効なルーム参加データ');
            }
            
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.playerInfo?.isHost || false;
            
            if (data.playerInfo) {
                StorageManager.savePlayerInfo(data.playerInfo);
            }

            UIManager.showError(`ルーム ${data.roomId} に参加しました！`, 'success');
        } catch (error) {
            console.error('ルーム参加成功処理エラー:', error);
            this.isJoining = false;
            this.updateButtonStates();
            UIManager.showError('ルーム参加後の処理でエラーが発生しました');
        }
    }

    onSpectateSuccess(data) {
        console.log('✅ 観戦成功コールバック:', data);
        
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('無効な観戦データ');
            }
            
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isSpectator = true;
            
            UIManager.showSpectatorMode(true);
            UIManager.showError(`ルーム ${data.roomId} の観戦を開始しました！`, 'success');
        } catch (error) {
            console.error('観戦成功処理エラー:', error);
            UIManager.showError('観戦後の処理でエラーが発生しました');
        }
    }

    onRejoinSuccess(data) {
        console.log('✅ 再入場成功コールバック:', data);
        
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('無効な再入場データ');
            }
            
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost;
            
            StorageManager.clearRejoinInfo();
            
            UIManager.showError('ゲームに再入場しました！', 'success');
        } catch (error) {
            console.error('再入場成功処理エラー:', error);
            UIManager.showError('再入場後の処理でエラーが発生しました');
        }
    }

    onReconnectSuccess(data) {
        console.log('✅ 再接続成功コールバック:', data);
        
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('無効な再接続データ');
            }
            
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost;
            
            UIManager.showError('ゲームに再接続しました！', 'success');
        } catch (error) {
            console.error('再接続成功処理エラー:', error);
            UIManager.showError('再接続後の処理でエラーが発生しました');
        }
    }

    showRoomInfo() {
        try {
            console.log('🏠 ルーム情報画面表示');
            UIManager.showScreen('room-info');
            
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.game.roomId) {
                roomIdDisplay.textContent = this.game.roomId;
            }
            
            if (this.game.gameData && this.game.gameData.players) {
                UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
            }
        } catch (error) {
            console.error('ルーム情報表示エラー:', error);
            UIManager.showError('ルーム情報の表示でエラーが発生しました');
        }
    }

    // エラー時の処理（追加）
    onError(error) {
        console.error('RoomManager エラー:', error);
        
        // フラグをリセット
        this.isJoining = false;
        this.isCreating = false;
        this.updateButtonStates();
        
        // 具体的なエラーメッセージがあれば表示
        if (error && error.message) {
            UIManager.showError(error.message);
        } else {
            UIManager.showError('予期しないエラーが発生しました');
        }
    }

    // デバッグ用メソッド
    getDebugInfo() {
        return {
            isJoining: this.isJoining,
            isCreating: this.isCreating,
            lastJoinAttempt: this.lastJoinAttempt,
            lastCreateAttempt: this.lastCreateAttempt,
            roomId: this.game.roomId,
            isHost: this.game.isHost,
            isSpectator: this.game.isSpectator,
            gameState: this.game.gameData?.gameState || 'なし'
        };
    }
}
