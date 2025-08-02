// メインゲームクラス - 整理版
import { SocketClient } from './socket-client.js';
import { UIManager } from './ui-manager.js';
import { RoomManager } from '../components/room-manager.js';
import { GameBoard } from '../components/game-board.js';
import { Chat } from '../components/chat.js';
import { StorageManager } from '../utils/storage.js';
import { setupDebugInfo, logError, safeAddEventListener, safeGetElement } from '../utils/helpers.js';

export class PigManGame {
    constructor() {
        console.log('🐷 PigManGame 初期化開始');
        
        // ゲーム状態
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        // コンポーネント初期化
        this.socketClient = new SocketClient(this);
        this.roomManager = new RoomManager(this);
        this.gameBoard = new GameBoard(this);
        this.chat = new Chat(this);
        
        // 初期化
        this.initializeEventListeners();
        this.initializeErrorMonitoring();
        setupDebugInfo();
        
        // 再接続を試行
        this.roomManager.attemptReconnection();
        
        console.log('✅ PigManGame 初期化完了');
    }

    initializeErrorMonitoring() {
        const self = this;
        
        window.addEventListener('error', (event) => {
            logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            }, self.socketClient);
        });

        window.addEventListener('unhandledrejection', (event) => {
            logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            }, self.socketClient);
        });
    }

    initializeEventListeners() {
        console.log('🎮 イベントリスナー設定開始');
        
        // パスワード表示切り替え
        safeAddEventListener('use-password', 'change', (e) => {
            const passwordGroup = safeGetElement('password-group');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // ルーム関連
        safeAddEventListener('create-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.createRoom();
        });

        safeAddEventListener('join-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.joinRoom();
        });

        safeAddEventListener('rejoin-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.rejoinRoom();
        });

        safeAddEventListener('spectate-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.spectateRoom();
        });

        safeAddEventListener('leave-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.leaveRoom();
        });

        safeAddEventListener('temp-leave-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.tempLeaveRoom();
        });

        safeAddEventListener('cancel-temp-leave', 'click', (e) => {
            e.preventDefault();
            this.roomManager.cancelTempLeave();
        });

        safeAddEventListener('game-leave-room', 'click', (e) => {
            e.preventDefault();
            this.roomManager.showTempLeaveDialog();
        });

        // ゲーム関連
        safeAddEventListener('start-game', 'click', (e) => {
            e.preventDefault();
            this.startGame();
        });

        safeAddEventListener('return-to-lobby', 'click', (e) => {
            e.preventDefault();
            this.roomManager.leaveRoom();
        });

        // リフレッシュボタン
        safeAddEventListener('refresh-rooms', 'click', (e) => {
            e.preventDefault();
            this.socketClient.getRoomList();
        });

        safeAddEventListener('refresh-ongoing', 'click', (e) => {
            e.preventDefault();
            this.socketClient.getOngoingGames();
        });

        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.roomId && this.gameData && this.gameData.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });

        // 手動再接続ボタンを追加
        this.addManualReconnectButton();

        console.log('✅ イベントリスナー設定完了');
    }

    addManualReconnectButton() {
        const reconnectBtn = document.createElement('button');
        reconnectBtn.id = 'manual-reconnect';
        reconnectBtn.className = 'btn btn-small';
        reconnectBtn.textContent = '🔄 再接続';
        reconnectBtn.style.position = 'fixed';
        reconnectBtn.style.top = '10px';
        reconnectBtn.style.left = '200px';
        reconnectBtn.style.zIndex = '1000';
        reconnectBtn.style.width = 'auto';
        
        reconnectBtn.onclick = () => {
            console.log('手動再接続ボタンクリック');
            this.socketClient.forceReconnect();
            UIManager.showError('再接続を試行中...', 'warning');
        };
        
        document.body.appendChild(reconnectBtn);
    }

    // サーバーからのイベント処理 - roomManagerに委譲
    onRoomCreated(data) {
        this.roomManager.onRoomCreated(data);
        this.updateUI();
    }

    onJoinSuccess(data) {
        this.roomManager.onJoinSuccess(data);
        this.updateUI();
    }

    onSpectateSuccess(data) {
        this.roomManager.onSpectateSuccess(data);
        this.updateUI();
    }

    onRejoinSuccess(data) {
        this.roomManager.onRejoinSuccess(data);
        this.updateUI();
    }

    onReconnectSuccess(data) {
        this.roomManager.onReconnectSuccess(data);
        this.updateUI();
    }

    // エラー時の処理
    onError(error) {
        console.error('❌ サーバーエラー:', error);
        
        // フラグをリセット
        this.roomManager.isJoining = false;
        this.roomManager.isCreating = false;
        this.roomManager.updateButtonStates();
        
        UIManager.showError(error.message || 'エラーが発生しました');
    }

    updateUI() {
        console.log('🎨 UI更新');
        if (!this.gameData) {
            console.warn('⚠️ ゲームデータが存在しません');
            return;
        }

        const treasureGoalEl = safeGetElement('treasure-goal');
        if (treasureGoalEl) {
            treasureGoalEl.textContent = this.gameData.treasureGoal || 7;
        }

        if (this.gameData.gameState === 'waiting') {
            this.gameBoard.updateLobbyUI();
        } else if (this.gameData.gameState === 'playing') {
            this.gameBoard.updateGameUI();
        } else if (this.gameData.gameState === 'finished') {
            this.gameBoard.handleVictoryScreen(this.gameData);
        }
    }

    startGame() {
        if (this.isSpectator) {
            UIManager.showError('観戦者はゲームを開始できません');
            return;
        }
        
        this.socketClient.startGame();
    }

    // 公開メソッド（観戦機能用）
    spectateRoom() {
        this.roomManager.spectateRoom();
    }
}
