// public/js/components/room-manager.js - 完全版（再接続システム対応）

import { UIManager } from '../core/ui-manager.js';
import { StorageManager } from '../utils/storage.js';
import { safeGetElement } from '../utils/helpers.js';

export class RoomManager {
    constructor(game) {
        this.game = game;
        
        // 状態管理フラグ
        this.isJoining = false;
        this.isCreating = false;
        this.lastJoinAttempt = 0;
        this.lastCreateAttempt = 0;
        
        // タイマー管理
        this.timers = {
            joinTimeout: null,
            createTimeout: null,
            stateReset: null,
            reconnectTimeout: null
        };
        
        // デバッグ情報
        this.debug = {
            resetCount: 0,
            joinAttempts: 0,
            lastError: null
        };
        
        // 🔧 【追加】再接続管理
        this.reconnectInfo = {
            isReconnecting: false,
            lastReconnectAttempt: 0,
            maxReconnectAttempts: 3,
            reconnectAttempts: 0
        };
    }
    
    // 🔧 【修正】自動復帰処理の改良
    attemptReconnection() {
        console.log('🔄 自動復帰処理開始（再接続対応版）');
        
        try {
            // 最初にフラグリセット
            this.forceResetAllStates();
            
            // 🔧 【重要】再接続情報の確認
            const reconnectInfo = this.getReconnectInfo();
            if (reconnectInfo) {
                console.log('🔄 再接続情報発見:', reconnectInfo);
                
                // ゲーム中だった場合の自動復帰
                if (reconnectInfo.gameState === 'playing') {
                    this.showReconnectDialog(reconnectInfo);
                    return;
                }
            }
            
            // 通常の復帰情報チェック
            const rejoinInfo = StorageManager.getRejoinInfo();
            if (rejoinInfo) {
                this.populateRejoinInfo(rejoinInfo);
                UIManager.showError('前回のゲームへの復帰情報が見つかりました。', 'warning');
                return;
            }
            
            // 保存されたプレイヤー情報
            const savedPlayerInfo = StorageManager.getPlayerInfo();
            if (savedPlayerInfo && savedPlayerInfo.roomId) {
                console.log('📋 保存された接続情報:', savedPlayerInfo);
                UIManager.showError('前回の接続情報が見つかりました。手動で再接続してください。', 'warning');
            } else {
                console.log('📋 復帰情報なし - 新規開始');
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

    onRoomCreated(data) {
        console.log('✅ ルーム作成成功:', data);
        
        try {
            // タイマークリア
            if (this.timers.createTimeout) {
                clearTimeout(this.timers.createTimeout);
                this.timers.createTimeout = null;
            }
            
            this.forceResetAllStates();
            
            // ゲーム状態を更新
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = true;
            
            // 🔧 【追加】再接続用の情報保存
            if (this.game.myName && this.game.roomId) {
                this.saveReconnectInfo(
                    this.game.roomId,
                    this.game.myName,
                    'waiting',
                    true
                );
            }
            
            // プレイヤー情報保存
            if (data.playerInfo) {
                StorageManager.savePlayerInfo(data.playerInfo);
            }
            
            // 画面遷移
            UIManager.showScreen('room-info');
            this.showRoomInfo();
            
            UIManager.showError(`ルーム ${data.roomId} を作成しました！`, 'success');
            
        } catch (error) {
            console.error('ルーム作成成功処理エラー:', error);
        }
    }

    // 🔧 【追加】一時退出関連
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

    // 🔧 【追加】強制リセット（公開メソッド）
    forceResetJoinState() {
        console.log('🔧 参加状態強制リセット（外部呼出）');
        this.forceResetAllStates();
    }

    // 🔧 【追加】デバッグ情報拡張
    getDebugInfo() {
        return {
            // 基本フラグ状態
            isJoining: this.isJoining,
            isCreating: this.isCreating,
            
            // 再接続関連
            isReconnecting: this.reconnectInfo.isReconnecting,
            reconnectAttempts: this.reconnectInfo.reconnectAttempts,
            lastReconnectAttempt: this.reconnectInfo.lastReconnectAttempt,
            hasReconnectInfo: !!this.getReconnectInfo(),
            
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
}error('❌ 自動復帰エラー:', error);
            this.forceResetAllStates();
        }
    }
    
    // 🔧 【追加】再接続ダイアログ表示
    showReconnectDialog(reconnectInfo) {
        const shouldReconnect = confirm(
            `前回のゲームが中断されました。\n\n` +
            `ルーム: ${reconnectInfo.roomId}\n` +
            `プレイヤー名: ${reconnectInfo.playerName}\n` +
            `状態: ${reconnectInfo.gameState === 'playing' ? 'ゲーム進行中' : '待機中'}\n\n` +
            `自動的に再参加しますか？`
        );
        
        if (shouldReconnect) {
            this.executeAutoReconnect(reconnectInfo);
        } else {
            this.clearReconnectInfo();
            UIManager.showError('再接続をキャンセルしました', 'warning');
        }
    }
    
    // 🔧 【追加】自動再接続実行
    executeAutoReconnect(reconnectInfo) {
        console.log('🔄 自動再接続実行:', reconnectInfo);
        
        try {
            this.reconnectInfo.isReconnecting = true;
            this.reconnectInfo.lastReconnectAttempt = Date.now();
            this.reconnectInfo.reconnectAttempts++;
            
            // ゲーム状態を復元
            this.game.roomId = reconnectInfo.roomId;
            this.game.myName = reconnectInfo.playerName;
            this.game.isHost = reconnectInfo.isHost || false;
            
            // プレイヤー名表示
            UIManager.showPlayerName(this.game.myName);
            
            // 再参加実行
            const success = this.game.socketClient.rejoinRoom(
                reconnectInfo.roomId, 
                reconnectInfo.playerName
            );
            
            if (success) {
                UIManager.showError('ゲームに再参加中...', 'warning');
                
                // タイムアウト設定
                this.timers.reconnectTimeout = setTimeout(() => {
                    if (this.reconnectInfo.isReconnecting) {
                        this.onReconnectTimeout();
                    }
                }, 10000); // 10秒タイムアウト
                
            } else {
                this.onReconnectFailed('再参加リクエストの送信に失敗しました');
            }
            
        } catch (error) {
            console.error('❌ 自動再接続実行エラー:', error);
            this.onReconnectFailed('自動再接続処理でエラーが発生しました');
        }
    }
    
    // 🔧 【追加】再接続成功処理
    onReconnectSuccess(data) {
        console.log('✅ 再接続成功:', data);
        
        try {
            this.reconnectInfo.isReconnecting = false;
            this.reconnectInfo.reconnectAttempts = 0;
            
            // タイマークリア
            if (this.timers.reconnectTimeout) {
                clearTimeout(this.timers.reconnectTimeout);
                this.timers.reconnectTimeout = null;
            }
            
            // ゲーム状態を更新
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost || false;
            
            // 画面遷移
            if (data.gameData?.gameState === 'playing') {
                UIManager.showScreen('game-board');
            } else {
                UIManager.showScreen('room-info');
            }
            
            // 再接続情報をクリア
            this.clearReconnectInfo();
            
            UIManager.showError('ゲームに再接続しました！', 'success');
            
        } catch (error) {
            console.error('❌ 再接続成功処理エラー:', error);
        }
    }
    
    // 🔧 【追加】再接続失敗処理
    onReconnectFailed(message) {
        console.warn('❌ 再接続失敗:', message);
        
        try {
            this.reconnectInfo.isReconnecting = false;
            
            // タイマークリア
            if (this.timers.reconnectTimeout) {
                clearTimeout(this.timers.reconnectTimeout);
                this.timers.reconnectTimeout = null;
            }
            
            // リトライ判定
            if (this.reconnectInfo.reconnectAttempts < this.reconnectInfo.maxReconnectAttempts) {
                const shouldRetry = confirm(
                    `再接続に失敗しました：${message}\n\n` +
                    `リトライしますか？ (${this.reconnectInfo.reconnectAttempts}/${this.reconnectInfo.maxReconnectAttempts})`
                );
                
                if (shouldRetry) {
                    setTimeout(() => {
                        const reconnectInfo = this.getReconnectInfo();
                        if (reconnectInfo) {
                            this.executeAutoReconnect(reconnectInfo);
                        }
                    }, 2000);
                    return;
                }
            }
            
            // 諦める場合
            this.clearReconnectInfo();
            this.forceResetAllStates();
            UIManager.showError(message, 'warning');
            UIManager.showScreen('lobby');
            
        } catch (error) {
            console.error('❌ 再接続失敗処理エラー:', error);
        }
    }
    
    // 🔧 【追加】再接続タイムアウト
    onReconnectTimeout() {
        console.warn('⏰ 再接続タイムアウト');
        this.onReconnectFailed('再接続がタイムアウトしました');
    }
    
    // 🔧 【修正】強制リセット処理強化
    forceResetAllStates() {
        console.log('🔧 状態強制リセット（再接続対応版）');
        
        try {
            this.debug.resetCount++;
            
            // 基本フラグリセット
            this.isJoining = false;
            this.isCreating = false;
            this.lastJoinAttempt = 0;
            this.lastCreateAttempt = 0;
            
            // 🔧 【追加】再接続フラグもリセット
            this.reconnectInfo.isReconnecting = false;
            this.reconnectInfo.lastReconnectAttempt = 0;
            // 再接続試行回数は保持（完全失敗判定用）
            
            // 全タイマークリア
            Object.keys(this.timers).forEach(key => {
                if (this.timers[key]) {
                    clearTimeout(this.timers[key]);
                    this.timers[key] = null;
                }
            });
            
            // ボタン状態更新
            this.updateButtonStates();
            
            console.log('✅ 状態強制リセット完了（再接続対応）');
            
        } catch (error) {
            console.error('❌ 状態強制リセットエラー:', error);
        }
    }
    
    // 🔧 【追加】再接続情報の管理
    saveReconnectInfo(roomId, playerName, gameState, isHost = false) {
        try {
            const reconnectInfo = {
                roomId,
                playerName,
                gameState,
                isHost,
                timestamp: Date.now()
            };
            
            localStorage.setItem('pigGame_reconnectInfo', JSON.stringify(reconnectInfo));
            console.log('💾 再接続情報保存:', reconnectInfo);
            
        } catch (error) {
            console.error('❌ 再接続情報保存エラー:', error);
        }
    }
    
    getReconnectInfo() {
        try {
            const data = localStorage.getItem('pigGame_reconnectInfo');
            if (!data) return null;
            
            const reconnectInfo = JSON.parse(data);
            
            // 30分以上古い情報は削除
            if (Date.now() - reconnectInfo.timestamp > 30 * 60 * 1000) {
                this.clearReconnectInfo();
                return null;
            }
            
            return reconnectInfo;
            
        } catch (error) {
            console.error('❌ 再接続情報取得エラー:', error);
            return null;
        }
    }
    
    clearReconnectInfo() {
        try {
            localStorage.removeItem('pigGame_reconnectInfo');
            console.log('🗑️ 再接続情報クリア');
        } catch (error) {
            console.error('❌ 再接続情報クリアエラー:', error);
        }
    }
    
    // 🔧 【修正】参加成功時に再接続情報保存
    onJoinSuccess(data) {
        console.log('✅ ルーム参加成功:', data);
        
        try {
            this.forceResetAllStates();
            
            // ゲーム状態を更新
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.playerInfo?.isHost || false;
            
            // 🔧 【追加】再接続用の情報保存
            if (this.game.myName && this.game.roomId) {
                this.saveReconnectInfo(
                    this.game.roomId,
                    this.game.myName,
                    data.gameData?.gameState || 'waiting',
                    this.game.isHost
                );
            }
            
            // プレイヤー情報保存
            if (data.playerInfo) {
                StorageManager.savePlayerInfo(data.playerInfo);
            }
            
            // 画面遷移
            UIManager.showScreen('room-info');
            this.showRoomInfo();
            
            UIManager.showError('ルームに参加しました！', 'success');
            
        } catch (error) {
            console.error('参加成功処理エラー:', error);
        }
    }
    
    // 🔧 【修正】再入場成功処理
    onRejoinSuccess(data) {
        console.log('✅ 再入場成功:', data);
        
        try {
            // 再接続フラグをクリア
            this.reconnectInfo.isReconnecting = false;
            this.reconnectInfo.reconnectAttempts = 0;
            
            this.forceResetAllStates();
            
            // ゲーム状態を更新
            this.game.roomId = data.roomId;
            this.game.gameData = data.gameData;
            this.game.isHost = data.isHost || false;
            
            // 🔧 【追加】再接続情報を更新
            this.saveReconnectInfo(
                this.game.roomId,
                this.game.myName,
                data.gameData?.gameState || 'playing',
                this.game.isHost
            );
            
            // 復帰情報をクリア
            StorageManager.clearRejoinInfo();
            
            // 画面遷移
            if (data.gameData?.gameState === 'playing') {
                UIManager.showScreen('game-board');
            } else {
                UIManager.showScreen('room-info');
            }
            
            UIManager.showError('ゲームに再入場しました！', 'success');
            
        } catch (error) {
            console.error('再入場成功処理エラー:', error);
        }
    }
    
    // 🔧 【修正】ルーム退出時に再接続情報をクリア
    leaveRoom() {
        try {
            console.log('🚪 ルーム退出処理');
            
            // 再接続情報をクリア（意図的な退出のため）
            this.clearReconnectInfo();
            
            if (this.game.socketClient && this.game.socketClient.isConnected()) {
                this.game.socketClient.leaveRoom();
            }
            
            this.forceResetAllStates();
            this.game.roomId = null;
            this.game.gameData = null;
            this.game.isHost = false;
            
            StorageManager.clearPlayerInfo();
            StorageManager.clearRejoinInfo();
            
            UIManager.showScreen('lobby');
            UIManager.showError('ルームを退出しました', 'warning');
            
        } catch (error) {
            console.error('ルーム退出エラー:', error);
        }
    }
    
    // 🔧 【修正】一時退出時の処理改良
    tempLeaveRoom() {
        try {
            console.log('⏸️ 一時退出処理');
            
            // 一時退出情報を保存
            const rejoinInfo = {
                roomId: this.game.roomId,
                playerName: this.game.myName,
                tempLeft: true,
                timestamp: Date.now()
            };
            
            StorageManager.saveRejoinInfo(rejoinInfo);
            
            // 🔧 【重要】再接続情報は保持（自動復帰用）
            // this.clearReconnectInfo(); ← これは実行しない
            
            // Socket切断
            if (this.game.socketClient && this.game.socketClient.isConnected()) {
                this.game.socketClient.tempLeaveRoom();
            }
            
            this.forceResetAllStates();
            UIManager.showScreen('lobby');
            this.populateRejoinInfo(rejoinInfo);
            UIManager.showError('一時退出しました。再入場情報が入力されています。', 'warning');
            
        } catch (error) {
            console.error('一時退出エラー:', error);
        }
    }
    
    // 🔧 【追加】エラーハンドリング強化
    onError(error) {
        console.error('❌ RoomManager エラー:', error);
        
        // 最優先でフラグリセット（再接続フラグも含む）
        this.forceResetAllStates();
        
        this.debug.lastError = error;
        
        // エラーメッセージ表示
        const message = error?.message || 'エラーが発生しました';
        UIManager.showError(message);
        
        // 特定のエラーへの対応
        if (message.includes('ルームが見つかりません')) {
            this.clearReconnectInfo(); // ルームが存在しない場合は再接続情報もクリア
            UIManager.showError('指定されたルームが存在しません。ルームIDを確認してください。', 'warning');
        } else if (message.includes('接続')) {
            UIManager.showError('サーバー接続に問題があります。しばらく待ってから再試行してください。', 'warning');
        } else if (message.includes('既に接続中')) {
            this.clearReconnectInfo(); // 重複接続の場合も再接続情報をクリア
            UIManager.showError('このプレイヤーは既に接続中です。', 'warning');
        }
    }
    
    // 🔧 【追加】ボタン状態更新（再接続状態も考慮）
    updateButtonStates() {
        try {
            const createBtn = safeGetElement('create-room');
            const joinBtn = safeGetElement('join-room');
            const rejoinBtn = safeGetElement('rejoin-room');
            
            const isOperationInProgress = this.isCreating || this.isJoining || this.reconnectInfo.isReconnecting;
            
            if (createBtn) {
                createBtn.disabled = isOperationInProgress;
                createBtn.textContent = this.isCreating ? '作成中...' : 'ルームを作成';
                createBtn.style.opacity = isOperationInProgress ? '0.6' : '1';
            }
            
            if (joinBtn) {
                joinBtn.disabled = isOperationInProgress;
                joinBtn.textContent = this.isJoining ? '参加中...' : 'ルームに参加';
                joinBtn.style.opacity = isOperationInProgress ? '0.6' : '1';
            }
            
            if (rejoinBtn) {
                rejoinBtn.disabled = isOperationInProgress;
                rejoinBtn.textContent = this.reconnectInfo.isReconnecting ? '再接続中...' : 'ゲームに再入場';
                rejoinBtn.style.opacity = isOperationInProgress ? '0.6' : '1';
            }
            
        } catch (error) {
            console.error('❌ ボタン状態更新エラー:', error);
        }
    }
    
    // 🔧 【基本機能】再入場機能
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

            // 🔧 【追加】再接続フラグ設定
            this.reconnectInfo.isReconnecting = true;
            this.reconnectInfo.lastReconnectAttempt = Date.now();
            
            this.game.myName = playerName;
            this.game.roomId = roomId;
            UIManager.showPlayerName(this.game.myName);
            
            const success = this.game.socketClient.rejoinRoom(roomId, playerName);
            
            if (success) {
                this.updateButtonStates();
                
                // タイムアウト設定
                this.timers.reconnectTimeout = setTimeout(() => {
                    if (this.reconnectInfo.isReconnecting) {
                        this.onReconnectTimeout();
                    }
                }, 10000);
            } else {
                this.reconnectInfo.isReconnecting = false;
                UIManager.showError('再入場リクエストの送信に失敗しました');
            }
            
        } catch (error) {
            console.error('再入場エラー:', error);
            this.reconnectInfo.isReconnecting = false;
            this.updateButtonStates();
            UIManager.showError('再入場処理でエラーが発生しました');
        }
    }
    
    // 🔧 【基本機能】ルーム作成
    createRoom() {
        console.log('🏠 ルーム作成処理開始（完全修正版）');
        
        const now = Date.now();
        this.debug.createAttempts = (this.debug.createAttempts || 0) + 1;

        // 重複防止チェック
        if (this.isCreating) {
            const timeSinceLastAttempt = now - this.lastCreateAttempt;
            
            if (timeSinceLastAttempt > 15000) {
                console.warn('⚠️ 古い作成フラグを強制リセット（15秒経過）');
                this.forceResetAllStates();
            } else {
                console.warn('⚠️ ルーム作成は既に進行中です');
                UIManager.showError('ルーム作成は既に進行中です。しばらくお待ちください。');
                return;
            }
        }

        try {
            const nameInput = safeGetElement('player-name');
            const passwordCheckbox = safeGetElement('use-password');
            const passwordInput = safeGetElement('room-password');

            const playerName = nameInput?.value.trim();
            const hasPassword = passwordCheckbox?.checked || false;
            const password = hasPassword ? passwordInput?.value.trim() : '';

            if (!playerName) {
                UIManager.showError('プレイヤー名を入力してください');
                return;
            }

            if (hasPassword && !password) {
                UIManager.showError('パスワードを入力してください');
                return;
            }

            this.isCreating = true;
            this.lastCreateAttempt = now;
            this.game.myName = playerName;
            UIManager.showPlayerName(this.game.myName);

            // タイムアウト設定
            this.timers.createTimeout = setTimeout(() => {
                if (this.isCreating) {
                    this.isCreating = false;
                    this.updateButtonStates();
                    UIManager.showError('ルーム作成がタイムアウトしました。再試行してください。');
                }
            }, 10000);

            const success = this.game.socketClient.createRoom(playerName, hasPassword, password);
            
            if (success) {
                this.updateButtonStates();
            } else {
                this.isCreating = false;
                this.updateButtonStates();
                UIManager.showError('ルーム作成リクエストの送信に失敗しました');
            }

        } catch (error) {
            console.error('ルーム作成エラー:', error);
            this.isCreating = false;
            this.updateButtonStates();
            UIManager.showError('ルーム作成でエラーが発生しました');
        }
    }
    
    // 🔧 【基本機能】ルーム参加
    joinRoom() {
        console.log('👥 ルーム参加処理開始（完全修正版）');
        
        const now = Date.now();
        this.debug.joinAttempts++;

        // 🔧 【追加】既にルームに参加している場合は即座に拒否
        if (this.game.roomId) {
            console.warn(`⚠️ 既にルーム ${this.game.roomId} に参加中 - 重複参加防止`);
            UIManager.showError('既に他のルームに参加しています。一度退出してから参加してください。');
            return;
        }
        
        // 重複防止チェック
        if (this.isJoining) {
            const timeSinceLastAttempt = now - this.lastJoinAttempt;
            
            if (timeSinceLastAttempt > 15000) {
                console.warn('⚠️ 古い参加フラグを強制リセット（15秒経過）');
                this.forceResetAllStates();
            } else if (timeSinceLastAttempt > 5000) {
                console.warn('⚠️ 参加処理が継続中（5秒経過）- ユーザー選択肢提供');
                const shouldReset = confirm(`参加処理が${Math.round(timeSinceLastAttempt/1000)}秒続いています。\nリセットして再試行しますか？`);
                if (shouldReset) {
                    this.forceResetAllStates();
                } else {
                    UIManager.showError('参加処理を継続します...', 'warning');
                    return;
                }
            } else {
                console.warn('⚠️ ルーム参加は既に進行中です');
                UIManager.showError('ルーム参加は既に進行中です。しばらくお待ちください。');
                return;
            }
        }

        try {
            const nameInput = safeGetElement('join-player-name');
            const roomInput = safeGetElement('join-room-id');
            const passwordInput = safeGetElement('join-password');

            const playerName = nameInput?.value.trim();
            const roomId = roomInput?.value.trim().toUpperCase();
            const password = passwordInput?.value.trim();

            if (!playerName || !roomId) {
                UIManager.showError('プレイヤー名とルームIDを入力してください');
                return;
            }

            this.isJoining = true;
            this.lastJoinAttempt = now;
            this.game.myName = playerName;
            UIManager.showPlayerName(this.game.myName);

            // タイムアウト設定
            this.timers.joinTimeout = setTimeout(() => {
                if (this.isJoining) {
                    this.isJoining = false;
                    this.updateButtonStates();
                    UIManager.showError('ルーム参加がタイムアウトしました。再試行してください。');
                }
            }, 10000);

            const success = this.game.socketClient.joinRoom(roomId, playerName, password);
            
            if (success) {
                this.updateButtonStates();
            } else {
                this.isJoining = false;
                this.updateButtonStates();
                UIManager.showError('ルーム参加リクエストの送信に失敗しました');
            }

        } catch (error) {
            console.error('ルーム参加エラー:', error);
            this.isJoining = false;
            this.updateButtonStates();
            UIManager.showError('ルーム参加でエラーが発生しました');
        }
    }
    
    // その他のメソッド（observeモード、ルーム情報表示など）
    spectateRoom() {
        try {
            const nameInput = safeGetElement('spectator-name');
            const roomInput = safeGetElement('spectate-room-id');
            
            const spectatorName = nameInput?.value.trim();
            const roomId = roomInput?.value.trim().toUpperCase();

            if (!spectatorName || !roomId) {
                UIManager.showError('観戦者名とルームIDを入力してください');
                return;
            }

            this.game.myName = spectatorName;
            UIManager.showPlayerName(this.game.myName);
            
            this.game.socketClient.spectateRoom(roomId, spectatorName);
            
        } catch (error) {
            console.error('観戦エラー:', error);
            UIManager.showError('観戦処理でエラーが発生しました');
        }
    }
    
    // ルーム情報表示
    showRoomInfo() {
        try {
            const roomIdDisplay = safeGetElement('room-id-display');
            if (roomIdDisplay && this.game.roomId) {
                roomIdDisplay.textContent = this.game.roomId;
            }
            
            if (this.game.gameData?.players) {
                UIManager.updatePlayersList(this.game.gameData.players, this.game.gameData.host);
            }
            
        } catch (error) {
            console.
