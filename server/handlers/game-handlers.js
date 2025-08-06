// server/handlers/game-handlers.js - ラウンド進行とリサイクル機能追加版

function setupGameHandlers(io, socket, activeRooms) {
    
    // カード選択
    socket.on('selectCard', (data) => {
        console.log('🃏 カード選択:', data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
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
            
            // 🔧 【修正】ゲームログを直接チャットに追加（循環参照回避）
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
            
            // 最新20件のみ保持
            if (room.gameData.messages.length > 20) {
                room.gameData.messages = room.gameData.messages.slice(-20);
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
            
            // 🔧 【追加】ラウンド終了チェックと進行処理
            const connectedPlayerCount = room.gameData.players.filter(p => p.connected).length;
            
            if (room.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                console.log('📋 ラウンド終了条件達成');
                
                // ラウンド進行処理
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
                
                // 🔧 正しいカードリサイクルシステム実行
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
                        if (room.gameData.messages.length > 20) {
                            room.gameData.messages = room.gameData.messages.slice(-20);
                        }
                        
                        io.to(socket.roomId).emit('newMessage', room.gameData.messages);
                    } else {
                        console.error('❌ カードリサイクル失敗:', recycleResult.error);
                    }
                }
                
                // ラウンド開始イベントを送信
                io.to(socket.roomId).emit('roundStart', roundResult.newRound);
                
                // 新ラウンドの最初のプレイヤーに鍵を渡す
                const firstPlayer = room.gameData.players.find(p => p.connected);
                if (firstPlayer) {
                    room.gameData.keyHolderId = firstPlayer.id;
                }
                
                console.log(`🆕 ラウンド ${roundResult.newRound} 開始`);
            } else {
                // 通常のターン進行：次のプレイヤーに鍵を渡す
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
            }
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました: ' + error.message });
        }
    });
}

// 勝利条件チェック関数
function checkWinConditions(gameData) {
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        return {
            ended: true,
            winner: 'adventurer',
            reason: 'all_treasures_found',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        return {
            ended: true,
            winner: 'guardian',
            reason: 'all_traps_triggered',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：4ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        return {
            ended: true,
            winner: 'guardian',
            reason: 'max_rounds_reached',
            message: `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`
        };
    }
    
    return {
        ended: false,
        winner: null,
        reason: null,
        message: null
    };
}

// ラウンド進行処理（game-Logic.jsから取得）
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理 =====');
    console.log('現在のラウンド:', gameData.currentRound);
    
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 4ラウンド終了！豚男チームの勝利');
        return { gameEnded: true, reason: 'max_rounds_reached' };
    }
    
    const newCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
    gameData.cardsPerPlayer = newCardsPerPlayer;
    gameData.cardsFlippedThisRound = 0;
    
    console.log(`🆕 ラウンド ${gameData.currentRound} 開始準備完了（手札${newCardsPerPlayer}枚）`);
    return { 
        newRound: gameData.currentRound, 
        gameEnded: false, 
        cardsPerPlayer: newCardsPerPlayer,
        needsCardRecycle: true 
    };
}

// ラウンド別手札枚数
function getCardsPerPlayerForRound(round) {
    const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
    return cardsPerRound[round] || 5;
}

// 正しいカードリサイクルシステム（game-Logic.jsから取得）
function correctCardRecycleSystem(gameData, connectedPlayers) {
    console.log('♻️ ===== 正しいカードリサイクルシステム開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 開始前の処理`);
    
    try {
        // 1. 現在のゲーム状況を確認
        const remainingTreasures = gameData.totalTreasures - gameData.treasureFound;
        const remainingTraps = gameData.totalTraps - gameData.trapTriggered;
        
        console.log(`残り子豚: ${remainingTreasures}, 残り罠: ${remainingTraps}`);
        
        // 2. 接続中プレイヤーの手札を回収
        connectedPlayers.forEach((player) => {
            const handSize = player.hand ? player.hand.length : 0;
            console.log(`${player.name}: ${handSize}枚回収`);
            player.hand = []; // 手札を空にする
        });
        
        // 3. 次ラウンドの必要カード数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        const totalNeededCards = connectedPlayers.length * nextRoundCardsPerPlayer;
        
        console.log(`次ラウンド手札: ${nextRoundCardsPerPlayer}枚/人, 総必要数: ${totalNeededCards}枚`);
        
        // 4. 新しいカードプールを作成（残存カード保証付き）
        const newCardPool = [];
        
        // 4-1. 残りの子豚カードを必ず含める
        for (let i = 0; i < remainingTreasures; i++) {
            newCardPool.push({
                type: 'treasure',
                id: `treasure-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        // 4-2. 残りの罠カードを必ず含める
        for (let i = 0; i < remainingTraps; i++) {
            newCardPool.push({
                type: 'trap',
                id: `trap-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        // 4-3. 残りを空き部屋カードで埋める
        const remainingSlots = totalNeededCards - remainingTreasures - remainingTraps;
        for (let i = 0; i < remainingSlots; i++) {
            newCardPool.push({
                type: 'empty',
                id: `empty-${i}-${Date.now()}`,
                revealed: false
            });
        }
        
        console.log(`新カードプール: 子豚${remainingTreasures}, 罠${remainingTraps}, 空き${remainingSlots}`);
        
        // 5. カードプールをシャッフル
        const shuffledPool = shuffleArray(newCardPool);
        
        // 6. 各プレイヤーにランダム配布
        connectedPlayers.forEach((player) => {
            const newHand = [];
            for (let i = 0; i < nextRoundCardsPerPlayer; i++) {
                if (shuffledPool.length > 0) {
                    newHand.push(shuffledPool.pop());
                }
            }
            player.hand = shuffleArray(newHand);
            
            const cardTypes = player.hand.reduce((acc, card) => {
                acc[card.type] = (acc[card.type] || 0) + 1;
                return acc;
            }, {});
            
            console.log(`${player.name}: ${player.hand.length}枚配布 (子豚${cardTypes.treasure || 0}, 罠${cardTypes.trap || 0}, 空き${cardTypes.empty || 0})`);
        });
        
        // 7. ゲームデータの更新
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        console.log('✅ 正しいカードリサイクル処理完了');
        return {
            success: true,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
        
    } catch (error) {
        console.error('❌ カードリサイクル処理エラー:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 配列シャッフル関数
function shuffleArray(array) {
    if (!Array.isArray(array)) {
        console.warn('シャッフル対象が配列ではありません:', array);
        return [];
    }

    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 鍵を次のプレイヤーに渡す
function passKeyToNextPlayer(gameData, currentTargetId) {
    gameData.keyHolderId = currentTargetId;
    console.log(`🗝️ 鍵を次のプレイヤーに渡しました: ${gameData.players.find(p => p.id === currentTargetId)?.name}`);
}

module.exports = {
    setupGameHandlers
};
