// server/handlers/game-handlers.js - 完全修正版

function setupGameHandlers(io, socket, socketRequestHistory) {
    // activeRoomsは room-handlers.js から取得
    const { getActiveRooms } = require('./room-handlers');
    const { sendGameLog } = require('./chat-handlers');
    
    // ゲーム開始
    socket.on('startGame', () => {
        console.log('🎮 ゲーム開始要求:', socket.id);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }

        const activeRooms = getActiveRooms();
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }

        if (room.gameData.host !== socket.id) {
            socket.emit('error', { message: 'ゲーム開始権限がありません' });
            return;
        }

        const connectedPlayers = room.gameData.players.filter(p => p.connected);
        if (connectedPlayers.length < 3) {
            socket.emit('error', { message: 'ゲーム開始には最低3人必要です' });
            return;
        }

        try {
            // ゲーム初期化
            const { initializeGameData, distributeCards } = require('../game/game-Logic');
            const gameInitData = initializeGameData(connectedPlayers.length);
            
            // ゲームデータに初期化データを統合
            Object.assign(room.gameData, gameInitData);
            room.gameData.gameState = 'playing';
            
            // 役職をプレイヤーに割り当て
            connectedPlayers.forEach((player, index) => {
                if (gameInitData.assignedRoles && gameInitData.assignedRoles[index]) {
                    player.role = gameInitData.assignedRoles[index];
                }
            });
            
            // カード配布
            const { playerHands } = distributeCards(
                gameInitData.allCards, 
                connectedPlayers.length, 
                gameInitData.cardsPerPlayer || 5
            );
            
            // 各プレイヤーに手札を配布
            connectedPlayers.forEach((player, index) => {
                if (playerHands[index]) {
                    player.hand = playerHands[index];
                }
            });
            
            // 最初の鍵保持者を設定（ホスト）
            room.gameData.keyHolderId = socket.id;
            
            // ゲーム開始ログ
            sendGameLog(io, socket.roomId, 
                `🎮 豚小屋探検開始！${connectedPlayers.length}人の探検隊が集結しました`, 
                activeRooms
            );
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            io.to(socket.roomId).emit('roundStart', 1);
            
            console.log(`✅ ルーム ${socket.roomId} でゲーム開始（${connectedPlayers.length}人）`);
            
        } catch (error) {
            console.error('❌ ゲーム開始エラー:', error);
            socket.emit('error', { message: 'ゲーム開始に失敗しました: ' + error.message });
        }
    });

    // カード選択処理
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

        // 🔧 【追加】連打防止チェック
        const now = Date.now();
        const cardSelectionKey = `${socket.id}_${data.targetPlayerId}_${data.cardIndex}`;
        
        // 最後のカード選択時間を記録
        if (!room.gameData.lastCardSelections) {
            room.gameData.lastCardSelections = new Map();
        }
        
        const lastSelectionTime = room.gameData.lastCardSelections.get(cardSelectionKey);
        if (lastSelectionTime && (now - lastSelectionTime) < 1000) { // 1秒以内の連打を防止
            console.warn(`⚠️ カード連打検出: ${socket.id} - ${cardSelectionKey}`);
            socket.emit('error', { message: 'カード選択が早すぎます。少し待ってから再試行してください。' });
            return;
        }
        
        // 🔧 【追加】同一プレイヤーのカード選択間隔チェック
        const playerSelectionKey = `${socket.id}_any`;
        const lastPlayerSelectionTime = room.gameData.lastCardSelections.get(playerSelectionKey);
        if (lastPlayerSelectionTime && (now - lastPlayerSelectionTime) < 500) { // 0.5秒以内の連続選択を防止
            console.warn(`⚠️ プレイヤー連続選択検出: ${socket.id}`);
            socket.emit('error', { message: 'カード選択間隔が短すぎます。' });
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
            
            // 🔧 【重要】カード選択時間を記録（処理開始時点で記録）
            room.gameData.lastCardSelections.set(cardSelectionKey, now);
            room.gameData.lastCardSelections.set(playerSelectionKey, now);
            
            // 🔧 【追加】古い記録をクリーンアップ（メモリリーク防止）
            for (const [key, time] of room.gameData.lastCardSelections) {
                if (now - time > 10000) { // 10秒以上古い記録を削除
                    room.gameData.lastCardSelections.delete(key);
                }
            }
            
            // カードを公開
            selectedCard.revealed = true;
            room.gameData.cardsFlippedThisRound++;
            
            // 最後にカードをめくられたプレイヤーを記録
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
            sendGameLog(io, socket.roomId, logMessage, activeRooms);
            
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
                sendGameLog(io, socket.roomId, 
                    `🎯 ラウンド${room.gameData.currentRound}終了！3秒後に次のラウンドが開始されます...`, 
                    activeRooms
                );
                
                // ラウンド終了をクライアントに送信
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
                                sendGameLog(io, socket.roomId, 
                                    `♻️ ラウンド${roundResult.newRound}開始！全カード回収→残存カード保証→再配布完了（手札${recycleResult.newCardsPerPlayer}枚）`, 
                                    activeRooms
                                );
                            } else {
                                console.error('❌ カードリサイクル失敗:', recycleResult.error);
                            }
                        }
                        
                        // 🔧 【追加】新ラウンド開始時にカード選択履歴をクリア
                        room.gameData.lastCardSelections = new Map();
                        
                        // ラウンド開始イベントを送信（3秒遅延後）
                        io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                        
                        // 新ラウンドの鍵保持者を正しく設定
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
                        
                        // lastTargetedPlayerIdをクリア（次ラウンド用）
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

// 🔧 【追加】勝利条件チェック関数
function checkWinConditions(gameData) {
    // 探検家チームの勝利：すべての子豚を救出
    if (gameData.treasureFound >= gameData.treasureGoal) {
        return {
            ended: true,
            winner: 'adventurer',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        return {
            ended: true,
            winner: 'guardian',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：最大ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        return {
            ended: true,
            winner: 'guardian',
            message: `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`
        };
    }
    
    return { ended: false };
}

// 🔧 【追加】鍵を次のプレイヤーに渡す関数（通常ターン時）
function passKeyToNextPlayer(gameData, currentTargetId) {
    // 通常のターン進行時は、カードをめくられたプレイヤーに鍵を渡す
    gameData.keyHolderId = currentTargetId;
    
    const targetPlayer = gameData.players.find(p => p.id === currentTargetId);
    console.log(`🗝️ 鍵を次のプレイヤーに渡しました: ${targetPlayer?.name || '不明'}`);
}

module.exports = {
    setupGameHandlers
};
