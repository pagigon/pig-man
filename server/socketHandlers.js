// ラウンド制修正版 - カード選択処理
function setupOtherHandlers(socket, io) {
    // カード選択 - ラウンド制修正版
    socket.on('selectCard', (data) => {
        console.log('🃏 ===== カード選択要求受信 =====');
        console.log('選択者:', socket.playerName, '(', socket.id, ')');
        console.log('データ:', data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const roomData = activeRooms.get(socket.roomId);
        if (!roomData || roomData.gameData.gameState !== 'playing') {
            socket.emit('error', { message: 'ゲームが進行していません' });
            return;
        }
        
        // 観戦者チェック
        if (socket.isSpectator) {
            socket.emit('error', { message: '観戦者はカードを選択できません' });
            return;
        }
        
        // ターンチェック
        if (roomData.gameData.keyHolderId !== socket.id) {
            socket.emit('error', { message: 'あなたのターンではありません' });
            return;
        }
        
        try {
            // 対象プレイヤーを検索
            const targetPlayer = roomData.gameData.players.find(p => p.id === data.targetPlayerId);
            if (!targetPlayer) {
                console.error('対象プレイヤーが見つかりません:', data.targetPlayerId);
                socket.emit('error', { message: '対象プレイヤーが見つかりません' });
                return;
            }
            
            console.log('対象プレイヤー:', targetPlayer.name);
            console.log('カードインデックス:', data.cardIndex);
            
            // カードの存在チェック
            if (!targetPlayer.hand || !targetPlayer.hand[data.cardIndex]) {
                console.error('カードが存在しません');
                socket.emit('error', { message: '無効なカード選択です' });
                return;
            }
            
            const selectedCard = targetPlayer.hand[data.cardIndex];
            console.log('選択されたカード:', selectedCard);
            
            // 既に公開済みかチェック
            if (selectedCard.revealed) {
                console.warn('既に公開済みのカード');
                socket.emit('error', { message: 'そのカードは既に公開されています' });
                return;
            }
            
            // 🔧 ラウンド開始前の状態をログ出力
            console.log('=== カード公開前の状態 ===');
            console.log('現在のラウンド:', roomData.gameData.currentRound);
            console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
            console.log('接続中プレイヤー数:', getConnectedPlayerCount(roomData));
            console.log('財宝発見数:', roomData.gameData.treasureFound, '/', roomData.gameData.treasureGoal);
            console.log('罠発動数:', roomData.gameData.trapTriggered, '/', roomData.gameData.trapGoal);
            
            // カードを公開
            selectedCard.revealed = true;
            console.log('カードを公開しました:', selectedCard.type);
            
            // 進捗更新
            if (selectedCard.type === 'treasure') {
                roomData.gameData.treasureFound++;
                console.log(`💎 財宝発見！ 合計: ${roomData.gameData.treasureFound}/${roomData.gameData.treasureGoal}`);
            } else if (selectedCard.type === 'trap') {
                roomData.gameData.trapTriggered++;
                console.log(`💀 罠発動！ 合計: ${roomData.gameData.trapTriggered}/${roomData.gameData.trapGoal}`);
            } else {
                console.log('🏠 空き部屋でした');
            }
            
            // 🔧 このラウンドで公開されたカード数を増加
            roomData.gameData.cardsFlippedThisRound++;
            console.log(`📊 このラウンドでのカード公開数: ${roomData.gameData.cardsFlippedThisRound}`);
            
            // 🔧 勝利条件チェック（ラウンド処理の前に）
            const victoryResult = checkWinConditions(roomData.gameData);
            if (victoryResult) {
                console.log('🏆 勝利条件達成:', victoryResult);
                // 勝利した場合は鍵の移動やラウンド処理をしない
                io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                return;
            }
            
            // 🔧 ラウンド終了チェック（接続中プレイヤー数と比較）
            const connectedPlayerCount = getConnectedPlayerCount(roomData);
            console.log(`🔄 ラウンド終了チェック: ${roomData.gameData.cardsFlippedThisRound} >= ${connectedPlayerCount} ?`);
            
            if (roomData.gameData.cardsFlippedThisRound >= connectedPlayerCount) {
                console.log('📋 ラウンド終了条件達成！');
                
                // ラウンド終了処理
                const nextRoundResult = advanceToNextRound(roomData.gameData, connectedPlayerCount);
                if (nextRoundResult.gameEnded) {
                    console.log('🎮 ゲーム終了:', nextRoundResult.reason);
                    io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
                    return;
                }
                
                if (nextRoundResult.newRound) {
                    console.log(`🆕 ラウンド ${nextRoundResult.newRound} 開始！`);
                    // 新しいラウンド開始の通知
                    io.to(socket.roomId).emit('roundStart', nextRoundResult.newRound);
                    
                    // カードを再配布
                    redistributeCards(roomData.gameData);
                }
            } else {
                // 通常のターン移行
                console.log('🔄 次のプレイヤーにターン移行');
            }
            
            // 鍵を次のプレイヤーに渡す（対象プレイヤーに）
            roomData.gameData.keyHolderId = data.targetPlayerId;
            const newKeyHolder = roomData.gameData.players.find(p => p.id === data.targetPlayerId);
            console.log('🗝️ 鍵の移動:', socket.playerName, '→', newKeyHolder?.name);
            
            // 🔧 ラウンド後の状態をログ出力
            console.log('=== カード公開後の状態 ===');
            console.log('現在のラウンド:', roomData.gameData.currentRound);
            console.log('このラウンドで公開されたカード数:', roomData.gameData.cardsFlippedThisRound);
            console.log('現在の鍵保持者:', newKeyHolder?.name);
            console.log('ゲーム状態:', roomData.gameData.gameState);
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', roomData.gameData);
            
            console.log('✅ カード選択処理完了');
            
        } catch (error) {
            console.error('❌ カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました' });
        }
    });
    
    // 他のハンドラー（チャット、退出等）は省略...
}

// 🔧 勝利条件チェック関数（修正版）
function checkWinConditions(gameData) {
    console.log('🏆 勝利条件チェック開始');
    
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'adventurer';
        gameData.victoryMessage = `全ての子豚を救出しました！探検家チームの勝利です！`;
        console.log('🎉 探検家チーム勝利！');
        return { team: 'adventurer', reason: 'all_treasures_found' };
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `すべての罠が発動しました！豚男チームの勝利です！`;
        console.log('🎉 豚男チーム勝利！');
        return { team: 'guardian', reason: 'all_traps_triggered' };
    }
    
    console.log('🔄 勝利条件未達成、ゲーム継続');
    return null;
}

// 🔧 ラウンド進行処理（新規作成）
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理開始 =====');
    
    // カード公開数をリセット
    gameData.cardsFlippedThisRound = 0;
    
    // ラウンドを進める
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    // 最大ラウンド到達チェック
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 最大ラウンド到達！豚男チームの勝利');
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`;
        return { gameEnded: true, reason: 'max_rounds_reached' };
    }
    
    console.log(`🆕 ラウンド ${gameData.currentRound} 開始準備完了`);
    return { newRound: gameData.currentRound, gameEnded: false };
}

// 🔧 カード再配布処理（簡易版）
function redistributeCards(gameData) {
    console.log('🃏 ===== カード再配布処理開始 =====');
    
    try {
        // 全プレイヤーのカードをリセット
        gameData.players.forEach((player) => {
            if (player.connected) {
                console.log(`${player.name} のカードをリセット`);
                player.hand = [];
                
                // 新しいカードを配布（簡易版）
                for (let i = 0; i < gameData.cardsPerPlayer; i++) {
                    const cardType = Math.random() < 0.3 ? 'treasure' : 
                                   Math.random() < 0.1 ? 'trap' : 'empty';
                    player.hand.push({
                        type: cardType,
                        id: `${cardType}-${player.id}-R${gameData.currentRound}-${i}`,
                        revealed: false
                    });
                }
                
                console.log(`${player.name} に ${player.hand.length} 枚のカードを配布`);
            }
        });
        
        // 最初のプレイヤーに鍵を渡す（ラウンド開始時）
        const connectedPlayers = gameData.players.filter(p => p.connected);
        if (connectedPlayers.length > 0) {
            const firstPlayer = connectedPlayers[0];
            gameData.keyHolderId = firstPlayer.id;
            console.log(`🗝️ ラウンド ${gameData.currentRound} の最初の鍵保持者: ${firstPlayer.name}`);
        }
        
        console.log('✅ カード再配布完了');
        
    } catch (error) {
        console.error('❌ カード再配布エラー:', error);
        
        // エラー時のフォールバック処理
        gameData.players.forEach((player) => {
            if (player.connected) {
                player.hand = [];
                for (let i = 0; i < 5; i++) {
                    player.hand.push({
                        type: 'empty',
                        id: `empty-${player.id}-fallback-${i}`,
                        revealed: false
                    });
                }
            }
        });
    }
}

// 接続中プレイヤー数取得（重複定義防止）
function getConnectedPlayerCount(roomData) {
    return roomData.gameData.players.filter(p => p.connected).length;
}
