// ゲーム関連のSocket.ioイベントハンドラー
const { getActiveRooms, updateRoomList } = require('./room-handlers');

function setupGameHandlers(io, socket) {
    const activeRooms = getActiveRooms();
    
    // ゲーム開始
    socket.on('startGame', () => {
        console.log('🎮 ゲーム開始要求:', socket.id);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const room = activeRooms.get(socket.roomId);
        if (!room) {
            socket.emit('error', { message: 'ルームが見つかりません' });
            return;
        }
        
        // ホスト権限チェック
        if (room.gameData.host !== socket.id) {
            socket.emit('error', { message: 'ゲーム開始権限がありません' });
            return;
        }
        
        // プレイヤー数チェック
        const connectedPlayers = room.players.filter(p => p.connected);
        if (connectedPlayers.length < 3) {
            socket.emit('error', { message: 'ゲーム開始には最低3人必要です' });
            return;
        }
        
        if (connectedPlayers.length > 10) {
            socket.emit('error', { message: 'プレイヤー数が多すぎます（最大10人）' });
            return;
        }
        
        try {
            // ゲーム開始処理
            startGameLogic(room.gameData, connectedPlayers.length);
            
            // ゲーム状態更新
            room.gameData.gameState = 'playing';
            
            // 全プレイヤーにゲーム開始を通知
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            io.to(socket.roomId).emit('roundStart', 1);
            
            // ルーム一覧から削除（進行中ゲームは非表示）
            updateRoomList(io);
            
            console.log(`ルーム ${socket.roomId} でゲーム開始`);
            
        } catch (error) {
            console.error('ゲーム開始エラー:', error);
            socket.emit('error', { message: 'ゲーム開始に失敗しました' });
        }
    });
    
    // カード選択
    socket.on('selectCard', (data) => {
        console.log('🃏 カード選択:', data);
        
        if (!socket.roomId) {
            socket.emit('error', { message: 'ルームに参加していません' });
            return;
        }
        
        const room = activeRooms.get(socket.roomId);
        if (!room || room.gameData.gameState !== 'playing') {
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
            
            // 進捗更新
            if (selectedCard.type === 'treasure') {
                room.gameData.treasureFound++;
            } else if (selectedCard.type === 'trap') {
                room.gameData.trapTriggered++;
            }
            
            room.gameData.cardsFlippedThisRound++;
            
            // 勝利条件チェック
            checkWinConditions(room.gameData);
            
            // 次のプレイヤーに鍵を渡す
            if (room.gameData.gameState === 'playing') {
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
                
// server/handlers/game-handlers.js の selectCard 処理内で
// ラウンド終了チェック部分を以下のように修正してください

// 既存のコードの「ラウンド終了チェック」部分を探して、以下に置き換え：

        // 🔧 ラウンド終了チェック（正しいカードリサイクル対応）
// server/handlers/game-handlers.js の selectCard 処理内で
// ラウンド終了チェック部分を以下のように修正してください

// 既存のコードの「ラウンド終了チェック」部分を探して、以下に置き換え：

        // 🔧 ラウンド終了チェック（正しいカードリサイクル対応）
        const connectedPlayerCount = gameData.players.filter(p => p.connected).length;
        console.log(`ラウンド終了チェック: ${gameData.cardsFlippedThisRound} >= ${connectedPlayerCount} ?`);
        
        if (gameData.cardsFlippedThisRound >= connectedPlayerCount) {
            console.log('📋 ラウンド終了！正しいカードリサイクル開始');
            
            // 次のラウンドへ進行
            gameData.currentRound++;
            console.log(`ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
            
            // 4ラウンド終了チェック
            if (gameData.currentRound > gameData.maxRounds) {
                console.log('4ラウンド終了！豚男チームの勝利');
                gameData.gameState = 'finished';
                gameData.winningTeam = 'guardian';
                gameData.victoryMessage = `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`;
                
                io.to(socket.roomId).emit('gameUpdate', gameData);
                return;
            }
            
            // 🔧 正しいカードリサイクルシステムを実行
            const { correctCardRecycleSystem } = require('../game/game-Logic');
            const connectedPlayers = gameData.players.filter(p => p.connected);
            const recycleResult = correctCardRecycleSystem(gameData, connectedPlayers);
            
            if (recycleResult.success) {
                console.log(`✅ ラウンド ${gameData.currentRound} の正しいカードリサイクル完了`);
                gameData.cardsFlippedThisRound = 0; // リセット
                
                // 🗝️ 最後にカードを捲られた人（現在の鍵保持者）が次ラウンドも鍵を持つ
                // data.targetPlayerId が最後にカードを捲られた人
                gameData.keyHolderId = data.targetPlayerId;
                const newKeyHolder = gameData.players.find(p => p.id === data.targetPlayerId);
                console.log(`🗝️ ラウンド ${gameData.currentRound} の鍵保持者: ${newKeyHolder?.name} (最後にカードを捲られた人)`);
                
                // フォールバック：該当プレイヤーが見つからない場合は最初のプレイヤーに
                if (!newKeyHolder && connectedPlayers.length > 0) {
                    gameData.keyHolderId = connectedPlayers[0].id;
                    console.log(`🗝️ フォールバック: ${connectedPlayers[0].name} に鍵を渡します`);
                }
                
                // 新しいラウンド開始の通知
                io.to(socket.roomId).emit('roundStart', gameData.currentRound);
            } else {
                console.error('❌ 正しいカードリサイクルに失敗:', recycleResult.error);
            }
        }
            }
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました' });
        }
    });
}

// ゲーム開始ロジック
function startGameLogic(gameData, playerCount) {
    console.log('🎮 ゲーム開始ロジック実行:', { playerCount });
    
    try {
        const { assignRoles, generateAllCards, distributeCards, calculateVictoryGoal } = require('../game/game-Logic');
        
        // 役職割り当て
        const roles = assignRoles(playerCount);
        gameData.players.forEach((player, index) => {
            if (player.connected) {
                player.role = roles[index];
            }
        });
        
        // カード生成と配布
        const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
        const { playerHands } = distributeCards(cards, playerCount, 5);
        
        // 各プレイヤーにカードを配布
        const connectedPlayers = gameData.players.filter(p => p.connected);
        connectedPlayers.forEach((player, index) => {
            player.hand = playerHands[index] || [];
        });
        
        // 勝利条件設定
        const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
        gameData.treasureGoal = treasureGoal;
        gameData.trapGoal = trapGoal;
        gameData.totalTreasures = treasureCount;
        gameData.totalTraps = trapCount;
        
        // 最初のプレイヤーに鍵を渡す
        gameData.keyHolderId = connectedPlayers[0].id;
        
        console.log('ゲーム開始処理完了:', {
            playerCount,
            treasureGoal,
            trapGoal,
            keyHolder: connectedPlayers[0].name
        });
        
    } catch (error) {
        console.error('ゲーム開始ロジックエラー:', error);
        // フォールバック処理
        gameData.players.forEach((player, index) => {
            player.role = index % 2 === 0 ? 'adventurer' : 'guardian';
            player.hand = [];
        });
        gameData.treasureGoal = 7;
        gameData.trapGoal = 2;
        gameData.keyHolderId = gameData.players.find(p => p.connected)?.id;
    }
}

// 勝利条件チェック
function checkWinConditions(gameData) {
    // 探検家チームの勝利：すべての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'adventurer';
        gameData.victoryMessage = `全ての子豚を救出しました！探検家チームの勝利です！`;
        return;
    }
    
    // 豚男チームの勝利：すべての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `すべての罠が発動しました！豚男チームの勝利です！`;
        return;
    }
}

// 鍵を次のプレイヤーに渡す
function passKeyToNextPlayer(gameData, currentTargetId) {
    gameData.keyHolderId = currentTargetId;
}

// 次のラウンド処理
function nextRound(gameData) {
    gameData.currentRound++;
    gameData.cardsFlippedThisRound = 0;
    
    // 最大ラウンド到達で豚男チームの勝利
    if (gameData.currentRound > gameData.maxRounds) {
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `4ラウンドが終了しました！豚男チームの勝利です！`;
        return;
    }
    
    // カード再配布処理（実装省略 - 必要に応じて追加）
    console.log(`ラウンド ${gameData.currentRound} 開始`);
}

module.exports = {
    setupGameHandlers,
    startGameLogic,
    checkWinConditions,
    passKeyToNextPlayer,
    nextRound
};
