// server/game/game-Logic.js - correctCardRecycleSystem修正版（既存コードに追加）

// 🔧 【修正】正しいカードリサイクルシステム - 完全版実装
function correctCardRecycleSystem(gameData, connectedPlayers) {
    console.log('♻️ ===== 正しいカードリサイクルシステム開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 開始前の処理`);
    
    try {
        // 1. 現在のゲーム状況を確認
        const remainingTreasures = gameData.totalTreasures - gameData.treasureFound;
        const remainingTraps = gameData.totalTraps - gameData.trapTriggered;
        
        console.log('=== 現在のゲーム状況 ===');
        console.log(`総子豚数: ${gameData.totalTreasures}, 発見済み: ${gameData.treasureFound}, 残り: ${remainingTreasures}`);
        console.log(`総罠数: ${gameData.totalTraps}, 発動済み: ${gameData.trapTriggered}, 残り: ${remainingTraps}`);
        
        // 2. 接続中プレイヤーの手札を回収
        console.log('=== 手札回収（接続プレイヤーのみ） ===');
        let totalRecoveredCards = 0;
        
        connectedPlayers.forEach((player, index) => {
            if (player.connected) {
                const handSize = player.hand ? player.hand.length : 0;
                totalRecoveredCards += handSize;
                console.log(`${player.name}: ${handSize}枚回収`);
                
                // 手札を空にする
                player.hand = [];
            } else {
                // 切断プレイヤーの手札は保持
                console.log(`${player.name} (切断中): 手札保持`);
            }
        });
        
        console.log(`合計回収カード数: ${totalRecoveredCards}枚（接続プレイヤーのみ）`);
        
        // 3. 次ラウンドの必要カード数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        const totalNeededCards = connectedPlayers.length * nextRoundCardsPerPlayer;
        
        console.log('=== 次ラウンドの配布計画 ===');
        console.log(`次ラウンド手札枚数: ${nextRoundCardsPerPlayer}枚/人`);
        console.log(`総必要カード数: ${totalNeededCards}枚`);
        
        // 4. 新しいカードプールを作成（残存カード保証付き）
        const newCardPool = [];
        
        // 4-1. 残りの子豚カードを必ず含める
        for (let i = 0; i < remainingTreasures; i++) {
            newCardPool.push({
                type: 'treasure',
                id: `treasure-remaining-${i}-${Date.now()}`,
                revealed: false
            });
        }
        console.log(`✅ 残り子豚カード ${remainingTreasures}枚をプールに追加`);
        
        // 4-2. 残りの罠カードを必ず含める
        for (let i = 0; i < remainingTraps; i++) {
            newCardPool.push({
                type: 'trap',
                id: `trap-remaining-${i}-${Date.now()}`,
                revealed: false
            });
        }
        console.log(`✅ 残り罠カード ${remainingTraps}枚をプールに追加`);
        
        // 4-3. 残りを空き部屋カードで埋める
        const remainingSlots = totalNeededCards - remainingTreasures - remainingTraps;
        for (let i = 0; i < remainingSlots; i++) {
            newCardPool.push({
                type: 'empty',
                id: `empty-refill-${i}-${Date.now()}`,
                revealed: false
            });
        }
        console.log(`✅ 空き部屋カード ${remainingSlots}枚をプールに追加`);
        
        console.log(`=== 新カードプール完成 ===`);
        console.log(`総カード数: ${newCardPool.length}枚`);
        console.log(`内訳: 子豚${remainingTreasures}枚, 罠${remainingTraps}枚, 空き部屋${remainingSlots}枚`);
        
        // 5. カードプールをシャッフル
        const shuffledPool = shuffleArray(newCardPool);
        
        // 6. 各プレイヤーにランダム配布
        console.log('=== ランダム配布開始 ===');
        connectedPlayers.forEach((player, index) => {
            const newHand = [];
            
            for (let i = 0; i < nextRoundCardsPerPlayer; i++) {
                if (shuffledPool.length > 0) {
                    newHand.push(shuffledPool.pop());
                }
            }
            
            // 手札をさらにシャッフル
            player.hand = shuffleArray(newHand);
            
            // 配布結果をログ出力
            const cardTypes = player.hand.reduce((acc, card) => {
                acc[card.type] = (acc[card.type] || 0) + 1;
                return acc;
            }, {});
            
            console.log(`${player.name}: ${player.hand.length}枚配布 (子豚${cardTypes.treasure || 0}, 罠${cardTypes.trap || 0}, 空き${cardTypes.empty || 0})`);
        });
        
        // 7. ゲームデータの更新
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        // 8. 検証：カード保証の確認
        let totalTreasuresInHands = 0;
        let totalTrapsInHands = 0;
        let totalEmptyInHands = 0;
        
        connectedPlayers.forEach(player => {
            player.hand.forEach(card => {
                switch (card.type) {
                    case 'treasure':
                        totalTreasuresInHands++;
                        break;
                    case 'trap':
                        totalTrapsInHands++;
                        break;
                    case 'empty':
                        totalEmptyInHands++;
                        break;
                }
            });
        });
        
        console.log('=== カード保証検証 ===');
        console.log(`手札内子豚数: ${totalTreasuresInHands} (期待値: ${remainingTreasures})`);
        console.log(`手札内罠数: ${totalTrapsInHands} (期待値: ${remainingTraps})`);
        console.log(`手札内空き部屋数: ${totalEmptyInHands} (期待値: ${remainingSlots})`);
        
        const verification = {
            treasuresCorrect: totalTreasuresInHands === remainingTreasures,
            trapsCorrect: totalTrapsInHands === remainingTraps,
            emptyCorrect: totalEmptyInHands === remainingSlots
        };
        
        if (verification.treasuresCorrect && verification.trapsCorrect && verification.emptyCorrect) {
            console.log('✅ カード保証検証: 成功');
        } else {
            console.error('❌ カード保証検証: 失敗', verification);
        }
        
        console.log('✅ 正しいカードリサイクル処理完了');
        return {
            success: true,
            newCardsPerPlayer: nextRoundCardsPerPlayer,
            redistributedCards: {
                treasures: totalTreasuresInHands,
                traps: totalTrapsInHands,
                empty: totalEmptyInHands
            },
            verification: verification
        };
        
    } catch (error) {
        console.error('❌ カードリサイクル処理エラー:', error);
        
        // エラー時のフォールバック処理
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        connectedPlayers.forEach((player) => {
            // 緊急時は空き部屋カードで埋める
            player.hand = [];
            for (let i = 0; i < nextRoundCardsPerPlayer; i++) {
                player.hand.push({
                    type: 'empty',
                    id: `fallback-empty-${i}-${Date.now()}`,
                    revealed: false
                });
            }
        });
        
        gameData.cardsPerPlayer = nextRoundCardsPerPlayer;
        
        return {
            success: false,
            error: error.message,
            newCardsPerPlayer: nextRoundCardsPerPlayer
        };
    }
}

// ラウンド別手札枚数を計算
function getCardsPerPlayerForRound(round) {
    const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
    return cardsPerRound[round] || 5;
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

// ラウンド進行処理
function advanceToNextRound(gameData, connectedPlayerCount) {
    console.log('📋 ===== ラウンド進行処理 =====');
    console.log('現在のラウンド:', gameData.currentRound);
    
    gameData.currentRound++;
    console.log(`📈 ラウンド進行: ${gameData.currentRound - 1} → ${gameData.currentRound}`);
    
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('⏰ 4ラウンド終了！豚男チームの勝利');
        gameData.gameState = 'finished';
        gameData.winningTeam = 'guardian';
        gameData.victoryMessage = `${gameData.maxRounds}ラウンドが終了しました！豚男チームの勝利です！`;
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

// 🔧 【注意】以下は既存のgame-Logic.jsファイルの末尾に追加するか、
// 既存のmodule.exportsに以下の関数を追加してください：

module.exports = {
    // ... 既存のエクスポート ...
    correctCardRecycleSystem,
    advanceToNextRound,
    getCardsPerPlayerForRound
};
