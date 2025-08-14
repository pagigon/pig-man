// ルーム管理コンポーネント（完全修正版）
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
        this.joinCooldown = 2000; // 2秒に短縮
        this.createCooldown = 3000; // 3秒に短縮
        
        // 🔧 【修正】複数のタイマー管理
        this.timers = {
            join: null,
            create: null,
            autoReset: null
        };
        
        // 🔧 【追加】デバッグ情報
        this.debug = {
            lastError: null,
            resetCount: 0,
            joinAttempts: 0
        };
        
        console.log('✅ RoomManager 初期化完了（完全修正版）');
    }

// 🔧 【最重要】確実なフラグリセット機能
forceResetAllStates() {
    console.log('🔧 【緊急】全状態強制リセット開始');
    
    // 🔧 【追加】不適切な呼び出しを防ぐチェック
    const now = Date.now();
    if (this.lastResetTime && (now - this.lastResetTime) < 1000) {
        console.warn('⚠️ リセット間隔が短すぎます - スキップ');
        return false;
    }
    this.lastResetTime = now;
    
    try {
        // フラグリセット
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.lastCreateAttempt = 0;
        
        // 全タイマークリア
        Object.keys(this.timers).forEach(key => {
            if (this.timers[key]) {
                clearTimeout(this.timers[key]);
                this.timers[key] = null;
            }
        });
        
        // 🔧 【修正】ゲーム状態は条件付きリセット
        const shouldResetGameState = !this.game.roomId || !this.game.gameData;
        if (shouldResetGameState) {
            console.log('🔧 ゲーム状態もリセット（ルーム未参加のため）');
            this.game.roomId = null;
            this.game.gameData = null;
            this.game.isHost = false;
            this.game.isSpectator = false;
        } else {
            console.log('🔧 ゲーム状態は保持（ルーム参加済みのため）');
        }
        
        // ボタン状態修正
        this.updateButtonStates();
        
        // 🔧 【修正】ストレージは条件付きクリア
        if (shouldResetGameState) {
            try {
                StorageManager.clearAllData();
            } catch (e) {
                console.warn('ストレージクリア失敗:', e);
            }
        }
        
        // デバッグカウンター更新
        this.debug.resetCount++;
        
        console.log('✅ 全状態強制リセット完了');
        return true;
        
    } catch (error) {
        console.error('❌ 強制リセットエラー:', error);
        
        // 最後の手段：DOM直接操作
        try {
            const joinBtn = document.getElementById('join-room');
            const createBtn = document.getElementById('create-room');
            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.textContent = 'ルームに参加';
            }
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.textContent = 'ルームを作成';
            }
            console.log('✅ DOM直接修正完了');
        } catch (domError) {
            console.error('❌ DOM修正失敗:', domError);
        }
        
        return false;
    }
}

    // 🔧 【修正】安全な参加処理
    joinRoom() {
        console.log('👥 ルーム参加処理開始（完全修正版）');
        
        const now = Date.now();
        this.debug.joinAttempts++;
        
        // 🔧 【追加】自動リセット（古いフラグを強制クリア）
        if (this.isJoining) {
            const timeSinceLastAttempt = now - this.lastJoinAttempt;
            
            if (timeSinceLastAttempt > 15000) { // 15秒以上経過
                console.warn('⚠️ 古い参加フラグを強制リセット（15秒経過）');
                this.forceResetAllStates();
            } else if (timeSinceLastAttempt > 5000) { // 5秒以上経過
                console.warn('⚠️ 参加処理が継続中（5秒経過）- ユーザー選択肢提供');
                const shouldReset = confirm(`参加処理が${Math.round(timeSinceLastAttempt/1000)}秒続いています。\nリセットして再試行しますか？`);
                if (shouldReset) {
                    this.forceResetAllStates();
                } else {
                    UIManager.showError('参加処理を継続します...', 'warning');
                    return;
                }
            } else {
                console.warn('⚠️ 参加処理中 - 少し待ってから再試行してください');
                UIManager.showError('参加処理中です。少し待ってから再試行してください。', 'warning');
                return;
            }
        }
        
        // クールダウンチェック（短縮）
        if (now - this.lastJoinAttempt < this.joinCooldown) {
            const remaining = Math.ceil((this.joinCooldown - (now - this.lastJoinAttempt)) / 1000);
            UIManager.showError(`${remaining}秒後に再試行してください`, 'warning');
            return;
        }
        
        // 接続チェック
        if (!this.game.socketClient.isConnected()) {
            console.error('❌ Socket未接続');
            UIManager.showError('サーバーに接続されていません。再接続を試行中...');
            
            // 自動再接続試行
            try {
                this.game.socketClient.forceReconnect();
            } catch (e) {
                console.error('再接続試行失敗:', e);
            }
            return;
        }

        try {
            // UI要素取得
            const nameInput = safeGetElement('player-name-join');
            const roomInput = safeGetElement('room-id-input');
            const passwordInput = safeGetElement('join-password');

            if (!nameInput || !roomInput) {
                console.error('❌ 必要な入力欄が見つかりません');
                UIManager.showError('入力欄が見つかりません。ページをリロードしてください。');
                return;
            }

            // 入力値取得と検証
            const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 10000)}`;
            const roomId = roomInput.value.trim().toUpperCase();
            const password = passwordInput ? passwordInput.value : '';

            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                roomInput.focus();
                return;
            }

            if (roomId.length < 3) {
                UIManager.showError('ルームIDは3文字以上で入力してください');
                roomInput.focus();
                return;
            }

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内で入力してください');
                nameInput.focus();
                return;
            }

            console.log('✅ 参加データ検証完了:', { playerName, roomId, hasPassword: !!password });

            // ゲーム状態設定
            this.game.myName = playerName;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName);

            // フラグ設定
            this.isJoining = true;
            this.lastJoinAttempt = now;
            this.updateButtonStates();
            
            // 🔧 【重要】自動リセットタイマー（短縮）
            this.timers.join = setTimeout(() => {
                if (this.isJoining) {
                    console.warn('⏰ 参加処理タイムアウト（10秒）');
                    this.forceResetAllStates();
                    UIManager.showError('参加処理がタイムアウトしました。再度お試しください。', 'warning');
                }
            }, 10000); // 10秒に短縮
            
            // Socket送信
            const success = this.game.socketClient.joinRoom(roomId, playerName, password);
            
            if (success) {
                UIManager.showError('ルームに参加中...', 'warning');
            } else {
                console.error('❌ Socket送信失敗');
                this.forceResetAllStates();
                UIManager.showError('参加要求の送信に失敗しました');
            }
            
        } catch (error) {
            console.error('❌ 参加処理エラー:', error);
            this.debug.lastError = error;
            this.forceResetAllStates();
            UIManager.showError(`参加処理でエラーが発生しました: ${error.message}`);
        }
    }

    // 🔧 【修正】ルーム作成処理
    createRoom() {
        console.log('🏠 ルーム作成処理開始（完全修正版）');
        
        const now = Date.now();
        
        // 古いフラグチェック
        if (this.isCreating && (now - this.lastCreateAttempt) > 15000) {
            console.warn('⚠️ 古い作成フラグを強制リセット');
            this.forceResetAllStates();
        }
        
        // 重複作成防止
        if (this.isCreating) {
            const timeSinceLastAttempt = now - this.lastCreateAttempt;
            if (timeSinceLastAttempt > 5000) {
                const shouldReset = confirm(`作成処理が${Math.round(timeSinceLastAttempt/1000)}秒続いています。\nリセットして再試行しますか？`);
                if (shouldReset) {
                    this.forceResetAllStates();
                } else {
                    return;
                }
            } else {
                UIManager.showError('ルーム作成中です。少し待ってください。', 'warning');
                return;
            }
        }
        
        // クールダウンチェック
        if (now - this.lastCreateAttempt < this.createCooldown) {
            const remaining = Math.ceil((this.createCooldown - (now - this.lastCreateAttempt)) / 1000);
            UIManager.showError(`${remaining}秒後に再試行してください`, 'warning');
            return;
        }
        
        if (!this.game.socketClient.isConnected()) {
            UIManager.showError('サーバーに接続されていません');
            this.game.socketClient.forceReconnect();
            return;
        }

        try {
            const nameInput = safeGetElement('player-name-create');
            const passwordCheck = safeGetElement('use-password');
            const passwordInput = safeGetElement('room-password');

            if (!nameInput) {
                UIManager.showError('プレイヤー名入力欄が見つかりません');
                return;
            }

            const playerName = nameInput.value.trim() || `ホスト${Math.floor(Math.random() * 10000)}`;
            const hasPassword = passwordCheck ? passwordCheck.checked : false;
            const password = hasPassword && passwordInput ? passwordInput.value : '';

            if (playerName.length > 20) {
                UIManager.showError('プレイヤー名は20文字以内で入力してください');
                nameInput.focus();
                return;
            }

            this.game.myName = playerName;
            UIManager.showPlayerName(this.game.myName);

            // フラグ設定
            this.isCreating = true;
            this.lastCreateAttempt = now;
            this.updateButtonStates();
            
            // タイムアウトタイマー
            this.timers.create = setTimeout(() => {
                if (this.isCreating) {
                    console.warn('⏰ 作成処理タイムアウト');
                    this.forceResetAllStates();
                    UIManager.showError('ルーム作成がタイムアウトしました。再度お試しください。', 'warning');
                }
            }, 15000);
            
            const success = this.game.socketClient.createRoom(playerName, hasPassword, password);
            
            if (success) {
                UIManager.showError('ルームを作成中...', 'warning');
            } else {
                this.forceResetAllStates();
                UIManager.showError('ルーム作成要求の送信に失敗しました');
            }
            
        } catch (error) {
            console.error('❌ ルーム作成エラー:', error);
            this.debug.lastError = error;
            this.forceResetAllStates();
            UIManager.showError(`ルーム作成でエラーが発生しました: ${error.message}`);
        }
    }

    // 🔧 【修正】成功コールバック
    onJoinSuccess(data) {
    console.log('✅ 参加成功:', data);
    
    try {
        // 🔧 【重要修正】フラグのみリセット（ゲーム状態は保持）
        this.isJoining = false;
        this.isCreating = false;
        
        // タイマークリア
        Object.keys(this.timers).forEach(key => {
            if (this.timers[key]) {
                clearTimeout(this.timers[key]);
                this.timers[key] = null;
            }
        });
        
        // ボタン状態更新
        this.updateButtonStates();
        
        if (!data || typeof data !== 'object') {
            throw new Error('無効な参加データ');
        }
        
        // 🔧 【重要】ゲーム状態設定（成功確認後）
        this.game.roomId = data.roomId;
        this.game.gameData = data.gameData;
        this.game.isHost = data.playerInfo?.isHost || false;
        
        // 🔧 【追加】プレイヤー名設定（成功確認後）
        if (data.playerInfo && data.playerInfo.playerName) {
            this.game.myName = data.playerInfo.playerName;
            UIManager.showPlayerName(this.game.myName);
        }
        
        if (data.playerInfo) {
            StorageManager.savePlayerInfo(data.playerInfo);
        }

        // 🔧 【追加】再接続の場合の特別メッセージ
        if (data.playerInfo?.isReconnection) {
            UIManager.showError(`ルーム ${data.roomId} に再接続しました！`, 'success');
        } else {
            UIManager.showError(`ルーム ${data.roomId} に参加しました！`, 'success');
        }
        
        console.log('✅ 参加処理完全成功 - ゲーム状態保持');
        
    } catch (error) {
        console.error('❌ 参加成功処理エラー:', error);
        
        // 🔧 【修正】エラー時のみリセット
        this.isJoining = false;
        this.isCreating = false;
        this.updateButtonStates();
        
        UIManager.showError('参加後の処理でエラーが発生しました');
    }
}

    onRoomCreated(data) {
        console.log('✅ ルーム作成成功:', data);
        
        try {
            // フラグリセット
            this.forceResetAllStates();
            
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
            console.error('❌ ルーム作成成功処理エラー:', error);
            this.forceResetAllStates();
            UIManager.showError('ルーム作成後の処理でエラーが発生しました');
        }
    }

    // 🔧 【修正】エラーハンドリング
    onError(error) {
        console.error('❌ RoomManager エラー:', error);
        
        // 最優先でフラグリセット
        this.forceResetAllStates();
        
        this.debug.lastError = error;
        
        // エラーメッセージ表示
        const message = error?.message || 'エラーが発生しました';
        UIManager.showError(message);
        
        // 特定のエラーへの対応
        if (message.includes('ルームが見つかりません')) {
            UIManager.showError('指定されたルームが存在しません。ルームIDを確認してください。', 'warning');
        } else if (message.includes('接続')) {
            UIManager.showError('サーバー接続に問題があります。しばらく待ってから再試行してください。', 'warning');
        }
    }

    // 🔧 【修正】自動復帰処理
    attemptReconnection() {
        console.log('🔄 自動復帰処理開始（完全修正版）');
        
        try {
            // 最初にフラグリセット
            this.forceResetAllStates();

            const rejoinInfo = StorageManager.getRejoinInfo();
            if (rejoinInfo) {
                this.populateRejoinInfo(rejoinInfo);
                UIManager.showError('前回のゲームへの復帰情報が見つかりました。', 'warning');
                return;
            }

            const savedPlayerInfo = StorageManager.getPlayerInfo();
            if (savedPlayerInfo && savedPlayerInfo.roomId) {
                console.log('📋 保存された接続情報:', savedPlayerInfo);
                // 自動再接続は行わず、ユーザーに選択肢を提供
                UIManager.showError('前回の接続情報が見つかりました。手動で再接続してください。', 'warning');
            } else {
                console.log('📋 復帰情報なし - 新規開始');
            }
            
        } catch (error) {
            console.error('❌ 自動復帰エラー:', error);
            this.forceResetAllStates();
        }
    }

    // 🔧 【修正】ボタン状態更新
    updateButtonStates() {
        try {
            const createBtn = safeGetElement('create-room');
            const joinBtn = safeGetElement('join-room');
            
            if (createBtn) {
                createBtn.disabled = this.isCreating;
                createBtn.textContent = this.isCreating ? '作成中...' : 'ルームを作成';
                createBtn.style.opacity = this.isCreating ? '0.6' : '1';
            }
            
            if (joinBtn) {
                joinBtn.disabled = this.isJoining;
                joinBtn.textContent = this.isJoining ? '参加中...' : 'ルームに参加';
                joinBtn.style.opacity = this.isJoining ? '0.6' : '1';
            }
            
        } catch (error) {
            console.error('❌ ボタン状態更新エラー:', error);
        }
    }

    // 🔧 【追加】デバッグ情報
    getDebugInfo() {
        return {
            // フラグ状態
            isJoining: this.isJoining,
            isCreating: this.isCreating,
            
            // 時間情報
            lastJoinAttempt: this.lastJoinAttempt,
            lastCreateAttempt: this.lastCreateAttempt,
            timeSinceLastJoin: Date.now() - this.lastJoinAttempt,
            timeSinceLastCreate: Date.now() - this.lastCreateAttempt,
            
            // タイマー状態
            activeTimers: Object.keys(this.timers).filter(key => this.timers[key] !== null),
            
            // デバッグカウンター
            resetCount: this.debug.resetCount,
            joinAttempts: this.debug.joinAttempts,
            lastError: this.debug.lastError,
            
            // ゲーム状態
            roomId: this.game.roomId,
            isHost: this.game.isHost,
            gameState: this.game.gameData?.gameState || 'なし',
            
            // Socket状態
            socketConnected: this.game.socketClient?.isConnected() || false
        };
    }

    // 🔧 【基本機能】既存メソッドは簡略化
    rejoinRoom() {
        try {
            const nameInput = safeGetElement('rejoin-player-name');
            const roomInput = safeGetElement('rejoin-room-id');
            
            const playerName = nameInput?.value.trim();
            const roomId = roomInput?.value.trim().toUpperCase();

            if (!playerName || !roomId) {
                UIManager.showError('プレイヤー名とルームIDを入力してください');
                return;
            }

            this.game.myName = playerName;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName);
            
            this.game.socketClient.rejoinRoom(roomId, playerName);
            UIManager.showError('再入場を試行中...', 'warning');
            
        } catch (error) {
            console.error('再入場エラー:', error);
            UIManager.showError('再入場中にエラーが発生しました');
        }
    }

    spectateRoom() {
        try {
            const nameInput = safeGetElement('spectator-name');
            const roomInput = safeGetElement('spectate-room-id');
            
            const spectatorName = nameInput?.value.trim() || `観戦者${Math.floor(Math.random() * 1000)}`;
            const roomId = roomInput?.value.trim().toUpperCase();

            if (!roomId) {
                UIManager.showError('ルームIDを入力してください');
                return;
            }

            this.game.myName = spectatorName;
            this.game.isSpectator = true;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName + ' (観戦)');
            
            this.game.socketClient.spectateRoom(roomId, spectatorName);
            UIManager.showError('観戦を開始中...', 'warning');
            
        } catch (error) {
            console.error('観戦エラー:', error);
            UIManager.showError('観戦中にエラーが発生しました');
        }
    }

    leaveRoom() {
        try {
            if (this.game.socketClient.isConnected()) {
                this.game.socketClient.leaveRoom();
            }
            
            this.forceResetAllStates();
            UIManager.showSpectatorMode(false);
            UIManager.showScreen('lobby');
            UIManager.showError('ルームを退出しました', 'success');
            
        } catch (error) {
            console.error('退出エラー:', error);
            this.forceResetAllStates();
            UIManager.showScreen('lobby');
        }
    }

    showRoomInfo() {
        try {
            UIManager.showScreen('room-info');
            
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.game.roomId) {
                roomIdDisplay.textContent = this.game.roomId;
            }
            
            if (this.game.gameData?.players) {
                UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
            }
            
        } catch (error) {
            console.error('ルーム情報表示エラー:', error);
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

    // 🔧 【追加】その他の成功コールバック
    onSpectateSuccess(data) {
        console.log('✅ 観戦成功:', data);
        try {
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isSpectator = true;
            UIManager.showSpectatorMode(true);
            UIManager.showError(`ルーム ${data.roomId} の観戦を開始しました！`, 'success');
        } catch (error) {
            console.error('観戦成功処理エラー:', error);
        }
    }

    onRejoinSuccess(data) {
        console.log('✅ 再入場成功:', data);
        try {
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost;
            StorageManager.clearRejoinInfo();
            UIManager.showError('ゲームに再入場しました！', 'success');
        } catch (error) {
            console.error('再入場成功処理エラー:', error);
        }
    }

    onReconnectSuccess(data) {
        console.log('✅ 再接続成功:', data);
        try {
            this.forceResetAllStates();
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost;
            UIManager.showError('ゲームに再接続しました！', 'success');
        } catch (error) {
            console.error('再接続成功処理エラー:', error);
        }
    }

    // 🔧 【追加】その他の基本メソッド（簡略化）
    showTempLeaveDialog() {
        if (this.game.gameData?.gameState === 'playing') {
            const tempLeaveSection = safeGetElement('temp-leave-section');
            if (tempLeaveSection) tempLeaveSection.style.display = 'block';
            UIManager.showScreen('room-info');
        } else {
            this.leaveRoom();
        }
    }

    cancelTempLeave() {
        const tempLeaveSection = safeGetElement('temp-leave-section');
        if (tempLeaveSection) tempLeaveSection.style.display = 'none';
        if (this.game.gameData?.gameState === 'playing') {
            UIManager.showScreen('game-board');
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
            this.forceResetAllStates();
            UIManager.showScreen('lobby');
            this.populateRejoinInfo(rejoinInfo);
            UIManager.showError('一時退出しました。', 'warning');
            
        } catch (error) {
            console.error('一時退出エラー:', error);
        }
    }
}
