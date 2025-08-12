// server/handlers/game-handlers.js - 鍵渡しロジック修正版（該当部分のみ）

function setupGameHandlers(io, socket, socketRequestHistory) {
    // activeRoomsは room-handlers.js から取得
    const { getActiveRooms } = require('./room-handlers');
    
    // カード選択処理（鍵渡しロジック修正版）
socket.on('selectCard', (data) => {
        console.log('🃏 カード選択:', data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }

        const activeRooms = getActiveRooms();
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            console.error('ルームが見つかりません:', socket.roomId);
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        if (room.gameData.gameState !== 'playing') {
            console.error('ゲーム状態が異常:', room.gameData.gameState);
            socket.emit('error', { message: 'ゲームが進行していません' });
            return;
        }
        
        // 観戦者チェック
        if (socket.isSpectator) {
            socket.emit('error', { message: '観戦者はカードを選択できません' });
            return;
        }
        
        // ターンチェック
        if (room.gameData.keyHolderId !== socket.id) {
            socket.emit('error', { message: 'あなたのターンではありません' });
            return;
        }

        // プレイヤー切断チェック
        const disconnectedPlayers = room.gameData.players.filter(p => !p.connected);
        if (disconnectedPlayers.length > 0) {
            const disconnectedNames = disconnectedPlayers.map(p => p.name);
            socket.emit('error', { 
                message: `${disconnectedNames.join(', ')} が切断されています。復帰をお待ちください。` 
            });
            
            // 切断プレイヤー情報を送信
            io.to(socket.roomId).emit('waitingForReconnect', {
                disconnectedPlayers: disconnectedNames
            });
            return;
        }
        
        try {
            // カード選択処理
            const targetPlayer = room.gameData.players.find(p => p.id === data.targetPlayerId);
            if (!targetPlayer || !targetPlayer.hand[data.cardIndex]) {
                socket.emit('error', { message: '無効なカード選択です' });
                return;
            }
            
            const selectedCard = targetPlayer.hand[data.cardIndex];
            if (selectedCard.revealed) {
                socket.emit('error', { message: 'そのカードは既に公開されています' });
                return;
            }
            
            // カードを公開
            selectedCard.revealed = true;
            room.gameData.cardsFlippedThisRound++;
            
            // 🔧 【重要】最後にカードをめくられたプレイヤーを記録
            room.gameData.lastTargetedPlayerId = data.targetPlayerId;
            
            // ゲームログを直接チャットに追加
            const selectorName = room.gameData.players.find(p => p.id === socket.id)?.name || '不明';
            const targetName = targetPlayer.name;
            let logMessage = '';
            
            if (selectedCard.type === 'treasure') {
                room.gameData.treasureFound++;
                logMessage = `🐷 ${selectorName} が ${targetName} のカードを選択 → 子豚発見！ (${room.gameData.treasureFound}/${room.gameData.treasureGoal})`;
            } else if (selectedCard.type === 'trap') {
                room.gameData.trapTriggered++;
                logMessage = `💀 ${selectorName} が ${targetName} のカードを選択 → 罠発動！ (${room.gameData.trapTriggered}/${room.gameData.trapGoal})`;
            } else {
                logMessage = `🏠 ${selectorName} が ${targetName} のカードを選択 → 空き部屋でした`;
            }
            
            // ゲームログをメッセージ配列に直接追加
            if (!room.gameData.messages) {
                room.gameData.messages = [];
            }
            
            const gameLogMessage = {
                type: 'game-log',
                text: logMessage,
                timestamp: Date.now()
            };
            
            room.gameData.messages.push(gameLogMessage);
            
            // 最新100件のみ保持
            if (room.gameData.messages.length > 100) {
                room.gameData.messages = room.gameData.messages.slice(-100);
            }
            
            // メッセージ更新を送信
            io.to(socket.roomId).emit('newMessage', room.gameData.messages);
            console.log(`🎮 ゲームログ: [${socket.roomId}] ${logMessage}`);
            
            // 勝利条件チェック
            const winResult = checkWinConditions(room.gameData);
            if (winResult.ended) {
                room.gameData.gameState = 'finished';
                room.gameData.winningTeam = winResult.winner;
                room.gameData.victoryMessage = winResult.message;
                
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                console.log(`🏆 ゲーム終了: ${winResult.message}`);
                return;
            }
            
            // ラウンド終了チェックと進行処理
            const connectedPlayerCount = room.gameData.players.filter(p => p.connected).length;
            
            if (room.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                console.log('📋 ラウンド終了条件達成');
                
                // ラウンド終了告知を送信
                const currentRoundEndMessage = {
                    type: 'game-log',
                    text: `🎯 ラウンド${room.gameData.currentRound}終了！3秒後に次のラウンドが開始されます...`,
                    timestamp: Date.now()
                };
                
                room.gameData.messages.push(currentRoundEndMessage);
                if (room.gameData.messages.length > 100) {
                    room.gameData.messages = room.gameData.messages.slice(-100);
                }
                
                // ラウンド終了をクライアントに送信
                io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
                
                // 3秒の遅延後にラウンド進行処理
                setTimeout(() => {
                    console.log('⏰ 3秒経過 - ラウンド進行処理開始');
                    
                    try {
                        // ラウンド進行処理
                        const { advanceToNextRound, correctCardRecycleSystem } = require('../game/game-Logic');
                        const roundResult = advanceToNextRound(room.gameData, connectedPlayerCount);
                        
                        if (roundResult.gameEnded) {
                            // 最大ラウンド達成による豚男チーム勝利
                            room.gameData.gameState = 'finished';
                            room.gameData.winningTeam = 'guardian';
                            room.gameData.victoryMessage = roundResult.reason === 'max_rounds_reached' ? 
                                `${room.gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！` : 
                                '豚男チームの勝利です！';
                            
                            io.to(socket.roomId).emit('gameUpdate', room.gameData);
                            return;
                        }
                        
                        // 正しいカードリサイクルシステム実行
                        if (roundResult.needsCardRecycle) {
                            const connectedPlayers = room.gameData.players.filter(p => p.connected);
                            const recycleResult = correctCardRecycleSystem(room.gameData, connectedPlayers);
                            
                            if (recycleResult.success) {
                                console.log('♻️ カードリサイクル成功');
                                
                                // リサイクル完了のゲームログ
                                const recycleLogMessage = {
                                    type: 'game-log',
                                    text: `♻️ ラウンド${roundResult.newRound}開始！全カード回収→残存カード保証→再配布完了（手札${recycleResult.newCardsPerPlayer}枚）`,
                                    timestamp: Date.now()
                                };
                                
                                room.gameData.messages.push(recycleLogMessage);
                                if (room.gameData.messages.length > 100) {
                                    room.gameData.messages = room.gameData.messages.slice(-100);
                                }
                                
                                io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                            } else {
                                console.error('❌ カードリサイクル失敗:', recycleResult.error);
                            }
                        }
                        
                        // ラウンド開始イベントを送信（3秒遅延後）
                        io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                        
                        // 🔧 【修正】新ラウンドの鍵保持者を正しく設定
                        // 最後にカードをめくられたプレイヤーに鍵を渡す
                        if (room.gameData.lastTargetedPlayerId) {
                            const lastTargetedPlayer = room.gameData.players.find(p => p.id === room.gameData.lastTargetedPlayerId);
                            if (lastTargetedPlayer && lastTargetedPlayer.connected) {
                                room.gameData.keyHolderId = room.gameData.lastTargetedPlayerId;
                                console.log(`🗝️ 新ラウンドの鍵保持者: ${lastTargetedPlayer.name} (最後にめくられたプレイヤー)`);
                            } else {
                                // フォールバック：最後にめくられたプレイヤーが切断している場合
                                const firstConnectedPlayer = room.gameData.players.find(p => p.connected);
                                if (firstConnectedPlayer) {
                                    room.gameData.keyHolderId = firstConnectedPlayer.id;
                                    console.log(`🗝️ フォールバック鍵保持者: ${firstConnectedPlayer.name} (最初の接続プレイヤー)`);
                                }
                            }
                        } else {
                            // フォールバック：lastTargetedPlayerIdが記録されていない場合
                            const firstConnectedPlayer = room.gameData.players.find(p => p.connected);
                            if (firstConnectedPlayer) {
                                room.gameData.keyHolderId = firstConnectedPlayer.id;
                                console.log(`🗝️ フォールバック鍵保持者: ${firstConnectedPlayer.name} (記録なしのため最初の接続プレイヤー)`);
                            }
                        }
                        
                        // 🔧 【重要】lastTargetedPlayerIdをクリア（次ラウンド用）
                        room.gameData.lastTargetedPlayerId = null;
                        
                        // 全員に更新を送信
                        io.to(socket.roomId).emit('gameUpdate', room.gameData);
                        
                        console.log(`🆕 ラウンド ${roundResult.newRound} 開始完了（正しい鍵渡し）`);
                        
                    } catch (error) {
                        console.error('❌ 遅延ラウンド進行エラー:', error);
                        // エラー時も続行
                        io.to(socket.roomId).emit('gameUpdate', room.gameData);
                    }
                    
                }, 3000); // 3秒（3000ミリ秒）の遅延
                
                // ここでreturnして、通常のターン進行をスキップ
                return;
                
            } else {
                // 通常のターン進行：次のプレイヤーに鍵を渡す
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
                
                // 全員に更新を送信
                io.to(socket.roomId).emit('gameUpdate', room.gameData);
            }
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました: ' + error.message });
        }
    });
}

// 🔧 【修正】鍵を次のプレイヤーに渡す関数（通常ターン時）
function passKeyToNextPlayer(gameData, currentTargetId) {
    // 通常のターン進行時は、カードをめくられたプレイヤーに鍵を渡す
    gameData.keyHolderId = currentTargetId;
    
    const targetPlayer = gameData.players.find(p => p.id === currentTargetId);
    console.log(`🗝️ 鍵を次のプレイヤーに渡しました: ${targetPlayer?.name || '不明'}`);
}

// その他の関数は既存のものを継続使用
// checkWinConditions, advanceToNextRound, correctCardRecycleSystem など

module.exports = {
    setupGameHandlers
};
