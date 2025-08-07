// メインゲームクラス - 修正版
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
        
        // 初期化フラグ
        this.isInitialized = false;
        
        try {
            // コンポーネント初期化
            this.socketClient = new SocketClient(this);
            this.roomManager = new RoomManager(this);
            this.gameBoard = new GameBoard(this);
            this.chat = new Chat(this);
            
            // 初期化
            this.initializeEventListeners();
            this.initializeErrorMonitoring();
            setupDebugInfo();
            
            // 再接続を試行（遅延実行）
            setTimeout(() => {
                this.roomManager.attemptReconnection();
            }, 1000);
            
            this.isInitialized = true;
            console.log('✅ PigManGame 初期化完了');
        } catch (error) {
            console.error('❌ PigManGame 初期化エラー:', error);
            UIManager.showError('ゲームの初期化に失敗しました。ページをリロードしてください。');
        }
    }

    
    returnToLobby() {
        try {
            if (!this.socketClient.isConnected()) {
                UIManager.showError('サーバーに接続されていません');
                return;
            }
            
            console.log('🏠 ロビー復帰要求');
            this.socketClient.returnToLobby();
            
        } catch (error) {
            console.error('ロビー復帰エラー:', error);
            UIManager.showError('ロビー復帰でエラーが発生しました');
        }
    }
    
    // 🔧 【追加】連戦開始
    restartGame() {
        try {
            if (!this.isHost) {
                UIManager.showError('連戦開始権限がありません');
                return;
            }
            
            if (!this.socketClient.isConnected()) {
                UIManager.showError('サーバーに接続されていません');
                return;
            }
            
            console.log('🔄 連戦開始要求');
            this.socketClient.restartGame();
            
        } catch (error) {
            console.error('連戦開始エラー:', error);
            UIManager.showError('連戦開始でエラーが発生しました');
        }
    }
    
    // 🔧 【追加】勝利画面からの復帰処理
    onReturnToLobby() {
        try {
            this.returnToLobby();
        } catch (error) {
            console.error('勝利画面からのロビー復帰エラー:', error);
            UIManager.showError('ロビー復帰でエラーが発生しました');
        }
    }
    
    // 🔧 【追加】勝利画面からの連戦開始処理
    onRestartGame() {
        try {
            this.restartGame();
        } catch (error) {
            console.error('勝利画面からの連戦開始エラー:', error);
            UIManager.showError('連戦開始でエラーが発生しました');
        }
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
        
        try {
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

            // return-to-lobbyボタンは動的生成されるため、条件付きで処理
const returnToLobbyBtn = safeGetElement('return-to-lobby');
if (returnToLobbyBtn) {
    returnToLobbyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.roomManager.leaveRoom();
    });
} else {
    console.log('return-to-lobbyボタンは動的生成のためスキップ');
}

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
        } catch (error) {
            console.error('イベントリスナー設定エラー:', error);
        }
    }

// public/js/core/game.js の addManualReconnectButton メソッドを修正

addManualReconnectButton() {
    try {
        // 既存のボタンがあれば削除
        const existingBtn = document.getElementById('manual-reconnect');
        if (existingBtn) {
            existingBtn.remove();
        }

        const reconnectBtn = document.createElement('button');
        reconnectBtn.id = 'manual-reconnect';
        reconnectBtn.className = 'btn btn-small';
        reconnectBtn.textContent = '🔄 再接続';
        reconnectBtn.style.cssText = `
            position: fixed;
            top: 10px;
            left: 200px;
            z-index: 1000;
            width: auto;
            font-size: 12px;
            padding: 6px 12px;
        `;
        
        reconnectBtn.onclick = () => {
            console.log('手動再接続ボタンクリック');
            
            // 🔧 ゲーム中の再接続を防止
            if (this.roomId && this.gameData) {
                console.warn('⚠️ ゲーム中の手動再接続はスキップします');
                UIManager.showError('ゲーム中は再接続ボタンを使用できません', 'warning');
                return;
            }
            
            try {
                this.socketClient.forceReconnect();
                UIManager.showError('再接続を試行中...', 'warning');
            } catch (error) {
                console.error('手動再接続エラー:', error);
                UIManager.showError('再接続に失敗しました');
            }
        };
        
        document.body.appendChild(reconnectBtn);
    } catch (error) {
        console.error('手動再接続ボタン追加エラー:', error);
    }
}

    // サーバーからのイベント処理 - roomManagerに委譲（エラーハンドリング強化）
    onRoomCreated(data) {
        try {
            this.roomManager.onRoomCreated(data);
            this.updateUI();
        } catch (error) {
            console.error('ルーム作成処理エラー:', error);
            UIManager.showError('ルーム作成後の処理でエラーが発生しました');
        }
    }

    onJoinSuccess(data) {
        try {
            this.roomManager.onJoinSuccess(data);
            this.updateUI();
        } catch (error) {
            console.error('ルーム参加処理エラー:', error);
            UIManager.showError('ルーム参加後の処理でエラーが発生しました');
        }
    }

    onSpectateSuccess(data) {
        try {
            this.roomManager.onSpectateSuccess(data);
            this.updateUI();
        } catch (error) {
            console.error('観戦処理エラー:', error);
            UIManager.showError('観戦後の処理でエラーが発生しました');
        }
    }

    onRejoinSuccess(data) {
        try {
            this.roomManager.onRejoinSuccess(data);
            this.updateUI();
        } catch (error) {
            console.error('再入場処理エラー:', error);
            UIManager.showError('再入場後の処理でエラーが発生しました');
        }
    }

    onReconnectSuccess(data) {
        try {
            this.roomManager.onReconnectSuccess(data);
            this.updateUI();
        } catch (error) {
            console.error('再接続処理エラー:', error);
            UIManager.showError('再接続後の処理でエラーが発生しました');
        }
    }

    // エラー時の処理
    onError(error) {
        console.error('❌ サーバーエラー:', error);
        
        try {
            // RoomManagerのエラー処理も呼び出し
            if (this.roomManager && typeof this.roomManager.onError === 'function') {
                this.roomManager.onError(error);
            } else {
                // フラグをリセット
                if (this.roomManager) {
                    this.roomManager.isJoining = false;
                    this.roomManager.isCreating = false;
                    this.roomManager.updateButtonStates();
                }
                
                UIManager.showError(error.message || 'エラーが発生しました');
            }
        } catch (e) {
            console.error('エラー処理中のエラー:', e);
            UIManager.showError('予期しないエラーが発生しました');
        }
    }

    updateUI() {
        try {
            console.log('🎨 UI更新');
            if (!this.gameData) {
                console.warn('⚠️ ゲームデータが存在しません');
                return;
            }

            // 安全にUI要素を更新
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
        } catch (error) {
            console.error('UI更新エラー:', error);
        }
    }

    startGame() {
        try {
            if (this.isSpectator) {
                UIManager.showError('観戦者はゲームを開始できません');
                return;
            }
            
            if (!this.isHost) {
                UIManager.showError('ゲーム開始権限がありません');
                return;
            }
            
            if (!this.socketClient.isConnected()) {
                UIManager.showError('サーバーに接続されていません');
                return;
            }
            
            this.socketClient.startGame();
        } catch (error) {
            console.error('ゲーム開始エラー:', error);
            UIManager.showError('ゲーム開始でエラーが発生しました');
        }
    }

    // 公開メソッド（観戦機能用）
    spectateRoom() {
        try {
            this.roomManager.spectateRoom();
        } catch (error) {
            console.error('観戦機能エラー:', error);
            UIManager.showError('観戦でエラーが発生しました');
        }
    }

    // デバッグ用メソッド
    getDebugInfo() {
        try {
            return {
                isInitialized: this.isInitialized,
                roomId: this.roomId,
                myName: this.myName,
                isHost: this.isHost,
                isSpectator: this.isSpectator,
                gameState: this.gameData?.gameState || 'なし',
                socketInfo: this.socketClient?.getDebugInfo() || 'なし',
                roomManagerInfo: this.roomManager?.getDebugInfo() || 'なし'
            };
        } catch (error) {
            console.error('デバッグ情報取得エラー:', error);
            return { error: error.message };
        }
    }
}
