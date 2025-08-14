// main.js - 完全修正版

import { PigManGame } from './core/game.js';

console.log('🐷 豚小屋探検隊 JavaScript 開始');

// 折りたたみ機能
window.toggleSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    const button = section.previousElementSibling;
    const icon = button.querySelector('.toggle-icon');
    
    section.classList.toggle('collapsed');
    icon.textContent = section.classList.contains('collapsed') ? '▼' : '▲';
};

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM読み込み完了 - ゲーム初期化開始');
    
    try {
        const game = new PigManGame();
        window.pigGame = game;
        console.log('✅ PigManGame インスタンス作成完了');
        
        // ルール表示切り替え
        const toggleRulesBtn = document.getElementById('toggle-rules');
        if (toggleRulesBtn) {
            toggleRulesBtn.addEventListener('click', function() {
                const rules = document.getElementById('game-rules');
                const isHidden = rules.style.display === 'none';
                rules.style.display = isHidden ? 'block' : 'none';
                this.textContent = isHidden ? 'ルールを隠す' : 'ルールを表示';
            });
        }
        
        // 🔧 【重要】勝利画面の固定ボタンイベント処理
        const returnToLobbyBtn = document.getElementById('return-to-lobby');
        const restartGameBtn = document.getElementById('restart-game');
        
        if (returnToLobbyBtn) {
            returnToLobbyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🏠 固定ロビー復帰ボタンクリック');
                if (window.pigGame && typeof window.pigGame.returnToLobby === 'function') {
                    window.pigGame.returnToLobby();
                } else {
                    console.error('❌ pigGame.returnToLobby メソッドが見つかりません');
                    // フォールバック処理
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.returnToLobby();
                    }
                }
            });
            console.log('✅ 固定ロビー復帰ボタンのイベントリスナー登録完了');
        } else {
            console.warn('⚠️ return-to-lobby ボタンが見つかりません');
        }
        
        if (restartGameBtn) {
            restartGameBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔄 固定連戦開始ボタンクリック');
                if (window.pigGame && typeof window.pigGame.restartGame === 'function') {
                    window.pigGame.restartGame();
                } else {
                    console.error('❌ pigGame.restartGame メソッドが見つかりません');
                    // フォールバック処理
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.restartGame();
                    }
                }
            });
            console.log('✅ 固定連戦開始ボタンのイベントリスナー登録完了');
        } else {
            console.warn('⚠️ restart-game ボタンが見つかりません');
        }
        
        // 🔧 【追加】動的ボタンのフォールバック処理（既存コード）
        document.addEventListener('click', function(e) {
            // 動的に生成されるボタンのクリックイベント処理
            if (e.target && e.target.textContent && e.target.textContent.includes('ロビーに戻る')) {
                e.preventDefault();
                console.log('🏠 フォールバック: 動的ロビー復帰ボタンクリック');
                if (window.pigGame && typeof window.pigGame.returnToLobby === 'function') {
                    window.pigGame.returnToLobby();
                } else if (window.pigGame && typeof window.pigGame.onReturnToLobby === 'function') {
                    window.pigGame.onReturnToLobby();
                } else {
                    console.error('❌ pigGame.returnToLobby メソッドが見つかりません');
                    // 最終フォールバック
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.returnToLobby();
                    }
                }
            }
            
            if (e.target && e.target.textContent && e.target.textContent.includes('もう一戦')) {
                e.preventDefault();
                console.log('🔄 フォールバック: 動的連戦開始ボタンクリック');
                if (window.pigGame && typeof window.pigGame.restartGame === 'function') {
                    window.pigGame.restartGame();
                } else if (window.pigGame && typeof window.pigGame.onRestartGame === 'function') {
                    window.pigGame.onRestartGame();
                } else {
                    console.error('❌ pigGame.restartGame メソッドが見つかりません');
                    // 最終フォールバック
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.restartGame();
                    }
                }
            }
        });
        
        // 🔧 【追加】デバッグ用グローバル関数
        window.debugVictory = function() {
            console.log('=== 勝利画面デバッグ ===');
            console.log('pigGame:', window.pigGame);
            console.log('isHost:', window.pigGame?.isHost);
            console.log('returnToLobby:', typeof window.pigGame?.returnToLobby);
            console.log('onReturnToLobby:', typeof window.pigGame?.onReturnToLobby);
            console.log('restartGame:', typeof window.pigGame?.restartGame);
            console.log('onRestartGame:', typeof window.pigGame?.onRestartGame);
            console.log('socketClient:', window.pigGame?.socketClient);
            console.log('socketClient.returnToLobby:', typeof window.pigGame?.socketClient?.returnToLobby);
            console.log('socketClient.restartGame:', typeof window.pigGame?.socketClient?.restartGame);
            console.log('==================');
        };
        
        // 🔧 【追加】ゲーム状態デバッグ関数
        window.debugGame = function() {
            console.log('=== ゲーム状態デバッグ ===');
            console.log('roomId:', window.pigGame?.roomId);
            console.log('gameData:', window.pigGame?.gameData);
            console.log('mySocketId:', window.pigGame?.mySocketId);
            console.log('myName:', window.pigGame?.myName);
            console.log('isHost:', window.pigGame?.isHost);
            console.log('isSpectator:', window.pigGame?.isSpectator);
            console.log('Socket接続状態:', window.pigGame?.socketClient?.isConnected());
            console.log('Socket ID:', window.pigGame?.socketClient?.getSocketId());
            console.log('Transport:', window.pigGame?.socketClient?.getTransportName());
            console.log('===================');
        };
        
        // 🔧 【追加】エラー状態デバッグ関数
        window.debugError = function() {
            console.log('=== エラー状態デバッグ ===');
            console.log('RoomManager状態:', window.pigGame?.roomManager?.getDebugInfo());
            console.log('SocketClient状態:', window.pigGame?.socketClient?.getDebugInfo());
            console.log('最後のエラー:', window.pigGame?.roomManager?.debug?.lastError);
            console.log('リセット回数:', window.pigGame?.roomManager?.debug?.resetCount);
            console.log('参加試行回数:', window.pigGame?.roomManager?.debug?.joinAttempts);
            console.log('===================');
        };
        
        // 🔧 【追加】強制リセット関数
        window.forceReset = function() {
            console.log('🔧 強制リセット実行');
            if (window.pigGame && window.pigGame.roomManager && typeof window.pigGame.roomManager.forceResetAllStates === 'function') {
                window.pigGame.roomManager.forceResetAllStates();
                console.log('✅ 強制リセット完了');
            } else {
                console.error('❌ 強制リセット関数が見つかりません');
            }
        };
        
        // 🔧 【追加】手動再接続関数
        window.manualReconnect = function() {
            console.log('🔄 手動再接続実行');
            if (window.pigGame && window.pigGame.socketClient && typeof window.pigGame.socketClient.forceReconnect === 'function') {
                window.pigGame.socketClient.forceReconnect();
                console.log('✅ 手動再接続要求送信');
            } else {
                console.error('❌ 手動再接続関数が見つかりません');
            }
        };
        
        // 🔧 【追加】ボタン状態チェック関数
        window.checkButtons = function() {
            console.log('=== ボタン状態チェック ===');
            const buttons = [
                'create-room', 'join-room', 'rejoin-room', 'spectate-room',
                'start-game', 'leave-room', 'return-to-lobby', 'restart-game'
            ];
            
            buttons.forEach(buttonId => {
                const btn = document.getElementById(buttonId);
                if (btn) {
                    console.log(`${buttonId}: 存在=${btn ? 'あり' : 'なし'}, 無効=${btn?.disabled}, 表示=${btn?.style.display || 'デフォルト'}`);
                } else {
                    console.log(`${buttonId}: 要素が見つかりません`);
                }
            });
            console.log('=======================');
        };
        
        // 🔧 【追加】完全な状態表示関数
        window.fullStatus = function() {
            console.log('=== 完全状態表示 ===');
            window.debugGame();
            window.debugError();
            window.checkButtons();
            window.debugVictory();
            console.log('==================');
        };
        
        // 🔧 【追加】緊急修復関数
        window.emergencyFix = function() {
            console.log('🚨 緊急修復開始');
            
            try {
                // 1. 強制リセット
                if (window.pigGame && window.pigGame.roomManager) {
                    window.pigGame.roomManager.forceResetAllStates();
                }
                
                // 2. Socket再接続
                if (window.pigGame && window.pigGame.socketClient) {
                    window.pigGame.socketClient.forceReconnect();
                }
                
                // 3. UI画面をロビーに戻す
                const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
                screens.forEach(screenName => {
                    const screen = document.getElementById(screenName);
                    if (screen) {
                        screen.style.display = screenName === 'lobby' ? 'block' : 'none';
                    }
                });
                
                // 4. エラーメッセージをクリア
                const errorEl = document.getElementById('error-message');
                if (errorEl) {
                    errorEl.style.display = 'none';
                }
                
                console.log('✅ 緊急修復完了');
                
            } catch (error) {
                console.error('❌ 緊急修復エラー:', error);
            }
        };
        
        // 🔧 【追加】ヘルプ関数
        window.gameHelp = function() {
            console.log(`
=== 豚小屋探検隊 デバッグコマンド ===
debugGame()      - ゲーム状態を表示
debugVictory()   - 勝利画面の状態を表示
debugError()     - エラー状態を表示
checkButtons()   - ボタンの状態を確認
fullStatus()     - 全ての状態を表示
forceReset()     - 強制リセット実行
manualReconnect() - 手動再接続
emergencyFix()   - 緊急修復（全リセット）
gameHelp()       - このヘルプを表示

=== 使用例 ===
1. ゲームが動かない時: emergencyFix()
2. 参加できない時: forceReset()
3. 接続が切れた時: manualReconnect()
4. 状態確認: fullStatus()
=====================================
            `);
        };
        
        // 初期状態をコンソールに表示
        console.log('🎮 豚小屋探検隊初期化完了！');
        console.log('💡 困った時は gameHelp() をコンソールで実行してください');
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        
        // UIManagerが使えない場合のフォールバック
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = 'ゲームの初期化に失敗しました。ページをリロードしてください。';
            errorEl.style.display = 'block';
        }
        
        // エラー時も基本的なデバッグ関数は提供
        window.emergencyReload = function() {
            console.log('🔄 緊急リロード実行');
            window.location.reload();
        };
        
        console.log('💡 緊急時は emergencyReload() でページをリロードできます');
    }
});
