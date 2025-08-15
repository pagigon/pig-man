// public/js/main.js - 完全版（再接続システム対応）

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 豚小屋探検隊 - DOMロード完了');
    
    // 🔧 【重要】重複初期化防止
    if (window.pigGameInitialized) {
        console.warn('⚠️ PigGame は既に初期化済み - 重複初期化をスキップ');
        return;
    }
    
    // ページリロード警告無効化（開発時用）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔧 開発環境検出 - ページリロード警告を無効化');
        window.addEventListener('beforeunload', function(e) {
            delete e['returnValue'];
        });
    }
    
    // エラー情報をクリア
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    
    try {
        // 動的import使用
        import('./core/game.js').then(module => {
            console.log('✅ PigManGame モジュール読み込み成功');
            
            const { PigManGame } = module;
            
            // インスタンス作成
            window.pigGame = new PigManGame();
            window.pigGameInitialized = true;
            
            console.log('✅ PigManGame インスタンス作成完了');
            
            // 🔧 【追加】再接続関連デバッグ関数
            window.debugReconnect = function() {
                try {
                    const socketInfo = window.pigGame?.socketClient?.getDebugInfo() || {};
                    const roomInfo = window.pigGame?.roomManager?.getDebugInfo() || {};
                    const reconnectInfo = window.pigGame?.roomManager?.getReconnectInfo() || null;
                    
                    console.log('=== 再接続デバッグ情報 ===');
                    console.log('Socket状態:', socketInfo);
                    console.log('Room Manager状態:', roomInfo);
                    console.log('保存された再接続情報:', reconnectInfo);
                    console.log('ゲーム中フラグ:', window.pigGame?.socketClient?.isInGame);
                    console.log('最後の切断理由:', window.pigGame?.socketClient?.lastDisconnectReason);
                    console.log('========================');
                    
                    return {
                        socket: socketInfo,
                        room: roomInfo,
                        reconnectInfo: reconnectInfo
                    };
                } catch (error) {
                    console.error('再接続デバッグ情報取得エラー:', error);
                    return { error: error.message };
                }
            };
            
            // 🔧 【追加】手動再接続関数
            window.manualReconnect = function() {
                console.log('🔄 手動再接続実行');
                
                try {
                    if (!window.pigGame) {
                        console.error('❌ pigGame インスタンスが存在しません');
                        return;
                    }
                    
                    // 再接続情報確認
                    const reconnectInfo = window.pigGame.roomManager?.getReconnectInfo();
                    if (reconnectInfo) {
                        console.log('🔄 再接続情報発見:', reconnectInfo);
                        
                        const shouldReconnect = confirm(
                            `保存された接続情報があります。\n\n` +
                            `ルーム: ${reconnectInfo.roomId}\n` +
                            `プレイヤー名: ${reconnectInfo.playerName}\n\n` +
                            `自動再接続しますか？`
                        );
                        
                        if (shouldReconnect) {
                            window.pigGame.roomManager.executeAutoReconnect(reconnectInfo);
                        } else {
                            window.pigGame.roomManager.clearReconnectInfo();
                            console.log('✅ 再接続情報をクリアしました');
                        }
                    } else {
                        // 通常の強制再接続
                        window.pigGame.socketClient.forceReconnect();
                        console.log('✅ 強制再接続を実行しました');
                    }
                    
                } catch (error) {
                    console.error('❌ 手動再接続エラー:', error);
                }
            };
            
            // 🔧 【追加】再接続情報管理関数
            window.clearReconnectInfo = function() {
                try {
                    if (window.pigGame?.roomManager) {
                        window.pigGame.roomManager.clearReconnectInfo();
                        console.log('✅ 再接続情報をクリアしました');
                    }
                    
                    // LocalStorageからも直接削除
                    localStorage.removeItem('pigGame_reconnectInfo');
                    console.log('✅ LocalStorageからも削除しました');
                    
                } catch (error) {
                    console.error('❌ 再接続情報クリアエラー:', error);
                }
            };
            
            // 🔧 【追加】接続状態診断関数
            window.diagnoseConnection = function() {
                try {
                    const results = {
                        socketExists: !!window.pigGame?.socketClient,
                        socketConnected: window.pigGame?.socketClient?.isConnected() || false,
                        socketId: window.pigGame?.socketClient?.getSocketId() || null,
                        isConnecting: window.pigGame?.socketClient?.isConnecting || false,
                        reconnectAttempts: window.pigGame?.socketClient?.reconnectAttempts || 0,
                        maxReconnectAttempts: window.pigGame?.socketClient?.maxReconnectAttempts || 0,
                        lastDisconnectReason: window.pigGame?.socketClient?.lastDisconnectReason || null,
                        isInGame: window.pigGame?.socketClient?.isInGame || false,
                        roomId: window.pigGame?.roomId || null,
                        playerName: window.pigGame?.myName || null,
                        gameState: window.pigGame?.gameData?.gameState || null
                    };
                    
                    console.log('=== 接続状態診断 ===');
                    console.table(results);
                    console.log('==================');
                    
                    // 推奨アクション
                    if (!results.socketExists) {
                        console.log('❌ Socket未初期化 → emergencyFix() を実行');
                    } else if (!results.socketConnected && !results.isConnecting) {
                        console.log('🔄 Socket切断中 → manualReconnect() を実行');
                    } else if (results.isInGame && results.roomId) {
                        console.log('🎮 ゲーム中 → 接続問題があれば manualReconnect() を実行');
                    } else {
                        console.log('✅ 接続状態は正常です');
                    }
                    
                    return results;
                    
                } catch (error) {
                    console.error('❌ 接続状態診断エラー:', error);
                    return { error: error.message };
                }
            };
            
            // 既存のデバッグ関数も拡張
            window.debugGame = function() {
                try {
                    const basicInfo = {
                        pigGameExists: !!window.pigGame,
                        isInitialized: window.pigGame?.isInitialized,
                        roomId: window.pigGame?.roomId,
                        myName: window.pigGame?.myName,
                        isHost: window.pigGame?.isHost,
                        isSpectator: window.pigGame?.isSpectator,
                        gameState: window.pigGame?.gameData?.gameState || 'なし'
                    };
                    
                    const socketInfo = window.pigGame?.socketClient?.getDebugInfo() || {};
                    const roomInfo = window.pigGame?.roomManager?.getDebugInfo() || {};
                    
                    console.log('=========================');
                    console.log('🎮 ゲーム基本情報:');
                    console.table(basicInfo);
                    console.log('📡 Socket情報:');
                    console.table(socketInfo);
                    console.log('🏠 Room Manager情報:');
                    console.table(roomInfo);
                    console.log('=========================');
                    
                    return { basic: basicInfo, socket: socketInfo, room: roomInfo };
                } catch (error) {
                    console.error('❌ デバッグ情報取得エラー:', error);
                    return { error: error.message };
                }
            };
            
            // 🔧 【追加】勝利画面デバッグ
            window.debugVictory = function() {
                try {
                    const victoryElement = document.getElementById('victory-screen');
                    const victoryVisible = victoryElement ? (victoryElement.style.display !== 'none') : false;
                    
                    console.log('=== 勝利画面デバッグ ===');
                    console.log('勝利画面要素存在:', !!victoryElement);
                    console.log('勝利画面表示中:', victoryVisible);
                    console.log('ゲーム状態:', window.pigGame?.gameData?.gameState);
                    console.log('勝者:', window.pigGame?.gameData?.winner);
                    console.log('勝利メッセージ:', window.pigGame?.gameData?.winMessage);
                    console.log('===================');
                    
                    return {
                        victoryElementExists: !!victoryElement,
                        victoryVisible: victoryVisible,
                        gameState: window.pigGame?.gameData?.gameState,
                        winner: window.pigGame?.gameData?.winner
                    };
                } catch (error) {
                    console.error('❌ 勝利画面デバッグエラー:', error);
                    return { error: error.message };
                }
            };
            
            // 🔧 【修正】チェック機能拡張
            window.checkDuplicates = function() {
                console.log('🔍 重複状態チェック（再接続対応版）');
                console.log('pigGameInitialized:', window.pigGameInitialized);
                console.log('pigGame:', !!window.pigGame);
                console.log('globalSocketInstance:', !!window.globalSocketInstance);
                console.log('Socket接続状態:', window.pigGame?.socketClient?.isConnected());
                console.log('Socket ID:', window.pigGame?.socketClient?.getSocketId());
                console.log('現在のルーム:', window.pigGame?.roomId);
                console.log('プレイヤー名:', window.pigGame?.myName);
                console.log('再接続情報あり:', !!window.pigGame?.roomManager?.getReconnectInfo());
                console.log('=========================');
            };
            
            // エラー情報確認
            window.debugError = function() {
                try {
                    const errorElement = document.getElementById('error-message');
                    const roomManagerError = window.pigGame?.roomManager?.debug?.lastError;
                    const socketClientError = window.pigGame?.socketClient?.lastError;
                    
                    console.log('=== エラーデバッグ ===');
                    console.log('エラー要素:', errorElement ? errorElement.textContent : 'なし');
                    console.log('RoomManager最新エラー:', roomManagerError);
                    console.log('SocketClient最新エラー:', socketClientError);
                    console.log('==================');
                    
                    return {
                        errorElement: errorElement ? errorElement.textContent : null,
                        roomManagerError: roomManagerError,
                        socketClientError: socketClientError
                    };
                } catch (error) {
                    console.error('❌ エラーデバッグ取得エラー:', error);
                    return { error: error.message };
                }
            };
            
            // ボタン状態チェック
            window.checkButtons = function() {
                try {
                    const buttons = ['create-room', 'join-room', 'rejoin-room', 'start-game', 'leave-room'];
                    const buttonStates = {};
                    
                    buttons.forEach(id => {
                        const btn = document.getElementById(id);
                        if (btn) {
                            buttonStates[id] = {
                                exists: true,
                                disabled: btn.disabled,
                                text: btn.textContent,
                                visible: btn.style.display !== 'none'
                            };
                        } else {
                            buttonStates[id] = { exists: false };
                        }
                    });
                    
                    console.log('=== ボタン状態チェック ===');
                    console.table(buttonStates);
                    console.log('========================');
                    
                    return buttonStates;
                } catch (error) {
                    console.error('❌ ボタン状態チェックエラー:', error);
                    return { error: error.message };
                }
            };
            
            // フルステータス関数も拡張
            window.fullStatus = function() {
                console.log('=== 🐷 豚小屋探検隊 完全ステータス（再接続対応版） ===');
                
                try {
                    // 基本情報
                    window.debugGame();
                    
                    // 再接続情報
                    console.log('\n🔄 再接続関連:');
                    window.debugReconnect();
                    
                    // 接続診断
                    console.log('\n📡 接続診断:');
                    window.diagnoseConnection();
                    
                    // 重複チェック
                    console.log('\n🔍 重複チェック:');
                    window.checkDuplicates();
                    
                    // エラー情報
                    console.log('\n❌ エラー情報:');
                    window.debugError();
                    
                    // ボタン状態
                    console.log('\n🔘 ボタン状態:');
                    window.checkButtons();
                    
                    console.log('============================================');
                    
                } catch (error) {
                    console.error('❌ フルステータス取得エラー:', error);
                }
            };
            
            // 強制リセット機能
            window.forceReset = function() {
                console.log('🔧 強制リセット実行');
                
                try {
                    if (window.pigGame && window.pigGame.roomManager) {
                        window.pigGame.roomManager.forceResetAllStates();
                        console.log('✅ Room Manager状態リセット完了');
                    }
                    
                    if (window.pigGame && window.pigGame.socketClient) {
                        window.pigGame.socketClient.isConnecting = false;
                        console.log('✅ Socket Client状態リセット完了');
                    }
                    
                    console.log('✅ 強制リセット完了');
                    
                } catch (error) {
                    console.error('❌ 強制リセットエラー:', error);
                }
            };
            
            // 緊急修復機能
            window.emergencyFix = function() {
                console.log('🚨 緊急修復実行');
                
                const confirmed = confirm('緊急修復を実行しますか？\n（全ての状態がリセットされます）');
                if (!confirmed) return;
                
                try {
                    // フラグリセット
                    window.pigGameInitialized = false;
                    
                    // Socket切断
                    if (window.globalSocketInstance) {
                        window.globalSocketInstance.disconnect();
                        window.globalSocketInstance = null;
                    }
                    
                    if (window.pigGame?.socketClient?.socket) {
                        window.pigGame.socketClient.socket.disconnect();
                    }
                    
                    // データクリア
                    window.clearReconnectInfo();
                    
                    // インスタンス削除
                    window.pigGame = null;
                    
                    console.log('✅ 緊急修復完了 - ページリロードを推奨');
                    
                    // 自動リロード確認
                    const shouldReload = confirm('緊急修復が完了しました。\nページをリロードしますか？');
                    if (shouldReload) {
                        window.location.reload();
                    }
                    
                } catch (error) {
                    console.error('❌ 緊急修復エラー:', error);
                }
            };
            
            // 🔧 【追加】初期化状態リセット関数（開発用）
            window.resetInitialization = function() {
                console.log('🔧 初期化状態リセット（開発用）');
                
                const confirmed = confirm('初期化状態をリセットしますか？\n（ページリロードが推奨されます）');
                if (!confirmed) return;
                
                try {
                    // グローバルフラグリセット
                    window.pigGameInitialized = false;
                    
                    // Socket切断
                    if (window.globalSocketInstance) {
                        window.globalSocketInstance.disconnect();
                        window.globalSocketInstance = null;
                    }
                    
                    if (window.pigGame?.socketClient?.socket) {
                        window.pigGame.socketClient.socket.disconnect();
                    }
                    
                    // インスタンス削除
                    window.pigGame = null;
                    
                    console.log('✅ 初期化状態リセット完了 - ページリロードを推奨');
                    
                } catch (error) {
                    console.error('❌ リセットエラー:', error);
                }
            };
            
            // 🔧 【拡張】ヘルプ関数
            window.gameHelp = function() {
                console.log(`
=== 豚小屋探検隊 デバッグコマンド（再接続対応版） ===
【基本デバッグ】
debugGame()          - ゲーム状態を表示
debugReconnect()     - 再接続関連情報を表示
debugVictory()       - 勝利画面の状態を表示
debugError()         - エラー状態を表示
checkButtons()       - ボタンの状態を確認
checkDuplicates()    - 重複状態を確認
fullStatus()         - 全ての状態を表示

【修復・操作】
forceReset()         - 強制リセット実行
manualReconnect()    - 手動再接続（🆕改良版）
emergencyFix()       - 緊急修復（全リセット）
clearReconnectInfo() - 再接続情報をクリア（🆕）

【再接続関連】🆕
manualReconnect()    - 保存情報を使った自動再接続
clearReconnectInfo() - 再接続情報の完全削除
diagnoseConnection() - 接続問題の診断

【開発者用】
resetInitialization() - 初期化状態リセット（開発用）
emergencyReload()     - 緊急リロード

【使用例】
1. ゲームが動かない時: emergencyFix()
2. 参加できない時: forceReset()
3. 接続が切れた時: manualReconnect()
4. 再接続がうまくいかない時: clearReconnectInfo() → manualReconnect()
5. 状態確認: fullStatus()
6. 重複問題確認: checkDuplicates()
================================================
                `);
            };
            
            // 🔧 【追加】動的ボタンクリックハンドリング（フォールバック）
            document.addEventListener('click', function(e) {
                const target = e.target;
                const isButton = target.tagName === 'BUTTON' || target.type === 'button';
                
                if (!isButton) return;
                
                const buttonText = target.textContent?.trim();
                
                // 重複クリック防止
                const lastClickTime = window.lastButtonClickTime || 0;
                const now = Date.now();
                if (now - lastClickTime < 1000) {
                    console.log('⚠️ 重複クリック防止');
                    return;
                }
