// ルーム管理コンポーネント
import { UIManager } from '../core/ui-manager.js';
import { StorageManager } from '../utils/storage.js';
import { safeGetElement } from '../utils/helpers.js';

export class RoomManager {
    constructor(game) {
        this.game = game;
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.joinCooldown = 3000; // 3秒のクールダウン
    }

    // 重複防止付きルーム作成
    createRoom() {
        console.log('🏠 ルーム作成処理開始');
        
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

        console.log('ルーム作成パラメータ:', {
            playerName,
            hasPassword,
            passwordLength: password.length
        });

        this.game.myName = playerName;
        UIManager.showPlayerName(this.game.myName);

        // 作成中フラグを設定
        this.isCreating = true;
        this.updateButtonStates();
        
        const success = this.game.socketClient.createRoom(playerName, hasPassword, password);
        
        if (success) {
            UIManager.showError('ルームを作成中...', 'warning');
            
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

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
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
    }

    rejoinRoom() {
        console.log('🔄 再入場処理開始');
        
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

        this.game.myName = playerName;
        UIManager.showPlayerName(this.game.myName);
        this.game.roomId = roomId;
        
        this.game.socketClient.rejoinRoom(roomId, playerName);
    }

    spectateRoom() {
        console.log('👁️ 観戦処理開始');
        
        const nameInput = safeGetElement('spectator-name');
        const roomInput = safeGetElement('spectate-room-id');
        
        const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput?.value.trim().toUpperCase() || '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        this.game.myName = spectatorName;
        this.game.isSpectator = true;
        UIManager.showPlayerName(this.game.myName + ' (観戦)');
        this.game.roomId = roomId;
        
        this.game.socketClient.spectateRoom(roomId, spectatorName);
    }

    showTempLeaveDialog() {
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
    }

    cancelTempLeave() {
        const tempLeaveSection = safeGetElement('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
        if (this.game.gameData && this.game.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

    tempLeaveRoom() {
        const rejoinInfo = {
            roomId: this.game.roomId,
            playerName: this.game.myName,
            tempLeft: true,
            timestamp: Date.now()
        };
        
        StorageManager.saveRejoinInfo(rejoinInfo);

        this.game.socketClient.tempLeaveRoom();
        
        this.game.roomId = null;
        this.game.gameData = null;
        this.game.isHost = false;
        this.game.isSpectator = false;
        
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

    leaveRoom() {
        this.game.socketClient.leaveRoom();
        this.game.roomId = null;
        this.game.gameData = null;
        this.game.isHost = false;
        this.game.isSpectator = false;
        
        StorageManager.clearPlayerInfo();
        
        UIManager.showSpectatorMode(false);
        UIManager.showScreen('lobby');
    }

    // ボタンの無効化/有効化
    updateButtonStates() {
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
    }

    // 再接続の試行
    attemptReconnection() {
        try {
            // 一時的に再接続を無効化してテスト
            console.log('再接続処理をスキップ（デバッグ用）');
            return;
            
            const rejoinInfo = StorageManager.getRejoinInfo();
            if (rejoinInfo) {
                console.log('保存された再入場情報:', rejoinInfo);
                this.populateRejoinInfo(rejoinInfo);
                UIManager.showError('前回のゲームへの再入場情報が見つかりました', 'warning');
                return;
            }

            const savedPlayerInfo = StorageManager.getPlayerInfo();
            if (savedPlayerInfo) {
                console.log('保存された情報で再接続を試行:', savedPlayerInfo);
                
                this.game.myName = savedPlayerInfo.playerName;
                this.game.isHost = savedPlayerInfo.isHost;
                UIManager.showPlayerName(this.game.myName);
                
                setTimeout(() => {
                    this.game.socketClient.reconnectToRoom(savedPlayerInfo.roomId, savedPlayerInfo.playerName);
                }, 1000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            StorageManager.clearAllData();
        }
    }

    // 成功コールバック
    onRoomCreated(data) {
        console.log('✅ ルーム作成成功コールバック:', data);
        
        // 作成中フラグをリセット
        this.isCreating = false;
        this.updateButtonStates();
        
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isHost = true;
        
        StorageManager.savePlayerInfo(data.playerInfo);

        UIManager.showError(`ルーム ${data.roomId} を作成しました！`, 'success');
        this.showRoomInfo();
    }

    onJoinSuccess(data) {
        console.log('✅ ルーム参加成功コールバック:', data);
        
        // 参加中フラグをリセット
        this.isJoining = false;
        this.updateButtonStates();
        
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isHost = data.playerInfo?.isHost || false;
        
        StorageManager.savePlayerInfo(data.playerInfo);

        UIManager.showError(`ルーム ${data.roomId} に参加しました！`, 'success');
    }

    onSpectateSuccess(data) {
        console.log('✅ 観戦成功コールバック:', data);
        
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isSpectator = true;
        
        UIManager.showSpectatorMode(true);
    }

    onRejoinSuccess(data) {
        console.log('✅ 再入場成功コールバック:', data);
        
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isHost = data.isHost;
        
        StorageManager.clearRejoinInfo();
        
        UIManager.showError('ゲームに再入場しました！', 'success');
    }

    onReconnectSuccess(data) {
        console.log('✅ 再接続成功コールバック:', data);
        
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isHost = data.isHost;
        
        UIManager.showError('ゲームに再接続しました！', 'success');
    }

    showRoomInfo() {
        console.log('🏠 ルーム情報画面表示');
        UIManager.showScreen('room-info');
        
        const roomIdDisplay = safeGetElement('room-id-display');
        if (roomIdDisplay && this.game.roomId) {
            roomIdDisplay.textContent = this.game.roomId;
        }
        
        if (this.game.gameData && this.game.gameData.players) {
            UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
        }
    }
}
