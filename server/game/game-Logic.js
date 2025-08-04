// 恐怖の古代寺院ルール完全対応版 game-Logic.js - 正しいカードリサイクルシステム完全実装

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PIG';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// プレイヤー数に応じた役職割り当て（恐怖の古代寺院ルール準拠）
function assignRoles(playerCount) {
    console.log('🎭 役職割り当て開始:', playerCount, '人');
    
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let adventurerCount, guardianCount;
    
    switch(playerCount) {
        case 3:
            if (Math.random() < 0.5) {
                adventurerCount = 1;
                guardianCount = 2;
            } else {
                adventurerCount = 2;
                guardianCount = 1;
            }
            break;
        case 4:
            if (Math.random() < 0.5) {
                adventurerCount = 3;
                guardianCount = 1;
            } else {
                adventurerCount = 2;
                guardianCount = 2;
            }
            break;
        case 5:
            adventurerCount = 3;
            guardianCount = 2;
            break;
        case 6:
            adventurerCount = 4;
            guardianCount = 2;
            break;
        case 7:
            if (Math.random() < 0.5) {
                adventurerCount = 5;
                guardianCount = 2;
            } else {
                adventurerCount = 4;
                guardianCount = 3;
            }
            break;
        case 8:
            if (Math.random() < 0.5) {
                adventurerCount = 6;
                guardianCount = 2;
            } else {
                adventurerCount = 5;
                guardianCount = 3;
            }
            break;
        case 9:
            adventurerCount = 6;
            guardianCount = 3;
            break;
        case 10:
            if (Math.random() < 0.5) {
                adventurerCount = 7;
                guardianCount = 3;
            } else {
                adventurerCount = 6;
                guardianCount = 4;
            }
            break;
        default:
            adventurerCount = Math.ceil(playerCount * 0.6);
            guardianCount = Math.floor(playerCount * 0.4);
    }

    const roles = [];
    
    for (let i = 0; i < adventurerCount; i++) {
        roles.push('adventurer');
    }
    for (let i = 0; i < guardianCount; i++) {
        roles.push('guardian');
    }
    
    // シャッフル
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    console.log(`役職割り当て完了: 探検家${adventurerCount}人、豚男${guardianCount}人`);
    return roles.slice(0, playerCount);
}

// プレイヤー数に応じたカード生成（恐怖の古代寺院ルール準拠）
function generateAllCards(playerCount) {
    console.log('🃏 カード生成開始:', playerCount, '人用');
    
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let treasureCount, trapCount, emptyCount;

    switch(playerCount) {
        case 3:
            treasureCount = 5;
            trapCount = 2;
            emptyCount = 8;
            break;
        case 4:
            treasureCount = 6;
            trapCount = 2;
            emptyCount = 12;
            break;
        case 5:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
            break;
        case 6:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 20;
            break;
        case 7:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 26;
            break;
        case 8:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 30;
            break;
        case 9:
            treasureCount = 9;
            trapCount = 2;
            emptyCount = 34;
            break;
        case 10:
            treasureCount = 10;
            trapCount = 3;
            emptyCount = 37;
            break;
        default:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
    }

    const cards = [];
    
    // 財宝カード（子豚）
    for (let i = 0; i < treasureCount; i++) {
        cards.push({ 
            type: 'treasure', 
            id: `treasure-${i}`, 
            revealed: false 
        });
    }
    
    // 罠カード
    for (let i = 0; i < trapCount; i++) {
        cards.push({ 
            type: 'trap', 
            id: `trap-${i}`, 
            revealed: false 
        });
    }
    
    // 空きカード（空き部屋）
    for (let i = 0; i < emptyCount; i++) {
        cards.push({ 
            type: 'empty', 
            id: `empty-${i}`, 
            revealed: false 
        });
    }
    
    console.log(`カード生成完了: 子豚${treasureCount}枚、罠${trapCount}枚、空き部屋${emptyCount}枚`);
    return { cards, treasureCount, trapCount };
}

// 配列シャッフル
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

// ラウンドに応じた手札枚数を計算
function getCardsPerPlayerForRound(round) {
    const cardsPerRound = { 1: 5, 2: 4, 3: 3, 4: 2 };
    return cardsPerRound[round] || 5;
}

// カード配布（ラウンド対応版）
function distributeCards(allCards, playerCount, cardsPerPlayer) {
    console.log('🎴 カード配布開始:', `${playerCount}人に${cardsPerPlayer}枚ずつ`);
    
    if (!Array.isArray(allCards) || allCards.length === 0) {
        console.warn('無効なカード配列:', allCards);
        return { playerHands: {}, remainingCards: [] };
    }

    if (!playerCount || playerCount < 1) {
        console.warn('無効なプレイヤー数:', playerCount);
        return { playerHands: {}, remainingCards: allCards };
    }

    if (!cardsPerPlayer || cardsPerPlayer < 1) {
        console.warn('無効な配布カード数:', cardsPerPlayer);
        cardsPerPlayer = 5;
    }

    const totalNeededCards = playerCount * cardsPerPlayer;
    if (allCards.length < totalNeededCards) {
        console.warn(`カード不足: 必要${totalNeededCards}枚、利用可能${allCards.length}枚`);
    }

    const shuffledCards = shuffleArray([...allCards]);
    const playerHands = {};
    
    for (let i = 0; i < playerCount; i++) {
        const hand = shuffledCards.splice(0, cardsPerPlayer);
        playerHands[i] = shuffleArray(hand);
        console.log(`プレイヤー${i}: ${hand.length}枚配布`);
        
        const cardTypes = hand.reduce((acc, card) => {
            acc[card.type] = (acc[card.type] || 0) + 1;
            return acc;
        }, {});
        console.log(`  - 内訳: 子豚${cardTypes.treasure || 0}, 罠${cardTypes.trap || 0}, 空き${cardTypes.empty || 0}`);
    }
    
    console.log(`配布完了: 残りカード${shuffledCards.length}枚`);
    return { playerHands, remainingCards: shuffledCards };
}

// 🔧 正しいカードリサイクルシステム - 完全版実装
function correctCardRecycleSystem(gameData, connectedPlayers) {
    console.log('♻️ ===== 正しいカードリサイクルシステム開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 終了後の処理`);
    
    try {
        // 1. 現在のゲーム状況を確認
        const remainingTreasures = gameData.totalTreasures - gameData.treasureFound;
        const remainingTraps = gameData.totalTraps - gameData.trapTriggered;
        
        console.log('=== 現在のゲーム状況 ===');
        console.log(`総子豚数: ${gameData.totalTreasures}, 発見済み: ${gameData.treasureFound}, 残り: ${remainingTreasures}`);
        console.log(`総罠数: ${gameData.totalTraps}, 発動済み: ${gameData.trapTriggered}, 残り: ${remainingTraps}`);
        
        // 2. 全プレイヤーの手札を回収（公開・未公開問わず）
// server/game/game-Logic.js の correctCardRecycleSystem 関数内
// 既存の「2. 全プレイヤーの手札を回収」部分を以下に置き換え：

        // 2. 接続中プレイヤーの手札のみ回収（🔧 修正）
        console.log('=== 手札回収（接続プレイヤーのみ） ===');
        let totalRecoveredCards = 0;
        
        connectedPlayers.forEach((player, index) => {
            if (player.connected) {  // 🔧 接続中プレイヤーのみ
                const handSize = player.hand ? player.hand.length : 0;
                totalRecoveredCards += handSize;
                console.log(`${player.name}: ${handSize}枚回収`);
                
                // 手札を空にする
                player.hand = [];
            } else {
                // 🔧 切断プレイヤーの手札は保持
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

// 勝利条件計算
function calculateVictoryGoal(playerCount) {
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 5));
    }

    let treasureGoal, trapGoal;
    
    switch(playerCount) {
        case 3: treasureGoal = 5; break;
        case 4: treasureGoal = 6; break;
        case 5: treasureGoal = 7; break;
        case 6: treasureGoal = 8; break;
        case 7: treasureGoal = 7; break;
        case 8: treasureGoal = 8; break;
        case 9: treasureGoal = 9; break;
        case 10: treasureGoal = 10; break;
        default: treasureGoal = 7; break;
    }
    
    trapGoal = playerCount === 10 ? 3 : 2;
    
    console.log(`勝利条件設定: 財宝${treasureGoal}個、罠${trapGoal}個`);
    return { treasureGoal, trapGoal };
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

// ゲーム終了条件チェック
function checkGameEndConditions(gameData) {
    console.log('🏁 ゲーム終了条件チェック:', {
        treasureFound: gameData.treasureFound,
        treasureGoal: gameData.treasureGoal,
        trapTriggered: gameData.trapTriggered,
        trapGoal: gameData.trapGoal,
        currentRound: gameData.currentRound,
        maxRounds: gameData.maxRounds
    });
    
    // 探検家チーム勝利：全ての財宝を発見
    if (gameData.treasureFound >= gameData.treasureGoal) {
        console.log('🏆 探検家チーム勝利（全財宝発見）');
        return {
            ended: true,
            winner: 'adventurer',
            reason: 'all_treasures_found',
            message: `全ての子豚（${gameData.treasureGoal}匹）を救出しました！探検家チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：全ての罠を発動
    if (gameData.trapTriggered >= gameData.trapGoal) {
        console.log('🏆 豚男チーム勝利（全罠発動）');
        return {
            ended: true,
            winner: 'guardian',
            reason: 'all_traps_triggered',
            message: `全ての罠（${gameData.trapGoal}個）が発動しました！豚男チームの勝利です！`
        };
    }
    
    // 豚男チーム勝利：4ラウンド終了
    if (gameData.currentRound > gameData.maxRounds) {
        console.log('🏆 豚男チーム勝利（4ラウンド終了）');
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

// ゲームデータ初期化
function initializeGameData(playerCount) {
    console.log('🎮 ゲームデータ初期化:', playerCount, '人（恐怖の古代寺院ルール）');
    
    const { cards, treasureCount, trapCount } = generateAllCards(playerCount);
    const { treasureGoal, trapGoal } = calculateVictoryGoal(playerCount);
    const roles = assignRoles(playerCount);
    
    return {
        allCards: cards,
        treasureCount: treasureCount,
        trapCount: trapCount,
        totalTreasures: treasureCount,
        totalTraps: trapCount,
        treasureGoal: treasureGoal,
        trapGoal: trapGoal,
        assignedRoles: roles,
        currentRound: 1,
        maxRounds: 4,
        cardsPerPlayer: getCardsPerPlayerForRound(1),
        cardsFlippedThisRound: 0,
        treasureFound: 0,
        trapTriggered: 0,
        keyHolderId: null,
        turnInRound: 0
    };
}

module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal,
    initializeGameData,
    checkGameEndConditions,
    getCardsPerPlayerForRound,
    advanceToNextRound,
    // 🔧 正しいカードリサイクルシステム
    correctCardRecycleSystem
};

// 既存の server/game/game-Logic.js の末尾に以下を追加してください
// （既存のコードはそのまま残して、この部分だけ追加）

// 🔧 正しいカードリサイクルシステム - 既存コードに追加
function correctCardRecycleSystem(gameData, connectedPlayers) {
    console.log('♻️ ===== 正しいカードリサイクルシステム開始 =====');
    console.log(`ラウンド ${gameData.currentRound} 終了後の処理`);
    
    try {
        // 1. 現在のゲーム状況を確認
        const remainingTreasures = gameData.totalTreasures - gameData.treasureFound;
        const remainingTraps = gameData.totalTraps - gameData.trapTriggered;
        
        console.log(`残り子豚: ${remainingTreasures}, 残り罠: ${remainingTraps}`);
        
        // 2. 全プレイヤーの手札を回収
        connectedPlayers.forEach((player) => {
            player.hand = []; // 手札を空にする
        });
        
        // 3. 次ラウンドの必要カード数を計算
        const nextRoundCardsPerPlayer = getCardsPerPlayerForRound(gameData.currentRound);
        const totalNeededCards = connectedPlayers.length * nextRoundCardsPerPlayer;
        
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

// module.exports に追加（既存のexportsの中に以下を追加）
// 既存の module.exports = { ... }; の中に以下を追加してください
//     correctCardRecycleSystem
