// server/handlers/game-handlers.js - 修正版（共有activeRooms）

function setupGameHandlers(io, socket, activeRooms) {  // activeRoomsを引数で受け取る
    
    // 🔧 【追加】チャットハンドラーからゲームログ機能を取得
    const { sendGameLog } = require('./chat-handlers');

    // カード選択
    socket.on('selectCard', (data) => {
        console.log('🃏 カード選択:', data);
        console.log('🔧 sendGameLog存在チェック:', typeof sendGameLog);

        // 🔧 【テスト追加】ゲームログテスト
        if (typeof sendGameLog === 'function') {
            console.log('🔧 sendGameLog関数テスト実行');
            sendGameLog(io, socket.roomId || 'TEST', 'テストメッセージ');
        } else {
            console.log('🔧 sendGameLog関数が見つかりません');
        }
        
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
        
        console.log('ルーム状態:', room.gameData.gameState);
        console.log('プレイヤー数:', room.gameData.players.length);
        
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

        // 🔧 【追加】全プレイヤーの接続状態チェック
        const disconnectedPlayers = room.gameData.players.filter(p => !p.connected);
        if (disconnectedPlayers.length > 0) {
            const disconnectedNames = disconnectedPlayers.map(p => p.name);
            socket.emit('error', { 
                message: `${disconnectedNames.join(', ')} が切断されています。復帰をお待ちください。` 
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
            
            // 🔧 【追加】ゲームログをチャットに送信
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
            
            // ゲームログをチャットに送信
            sendGameLog(io, socket.roomId, logMessage);
            
            room.gameData.cardsFlippedThisRound++;
            
            // 勝利条件チェック
            checkWinConditions(room.gameData);
            
            // 次のプレイヤーに鍵を渡す
            if (room.gameData.gameState === 'playing') {
                passKeyToNextPlayer(room.gameData, data.targetPlayerId);
            }
            
            // 全員に更新を送信
            io.to(socket.roomId).emit('gameUpdate', room.gameData);
            
        } catch (error) {
            console.error('カード選択エラー:', error);
            socket.emit('error', { message: 'カード選択に失敗しました' });
        }
    });
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

module.exports = {
    setupGameHandlers
};
