function generateRoomId() {
    // より確実なランダム文字列生成
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PIG';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function assignRoles(playerCount) {
    // バリデーション
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let adventurerCount, guardianCount, extraCard;
    
    try {
        switch(playerCount) {
            case 3:
                if (Math.random() < 0.5) {
                    adventurerCount = 1;
                    guardianCount = 2;
                } else {
                    adventurerCount = 2;
                    guardianCount = 1;
                }
                extraCard = true;
                break;
            case 4:
                if (Math.random() < 0.5) {
                    adventurerCount = 2;
                    guardianCount = 2;
                } else {
                    adventurerCount = 3;
                    guardianCount = 1;
                }
                extraCard = true;
                break;
            case 5:
                adventurerCount = 3;
                guardianCount = 2;
                extraCard = false;
                break;
            case 6:
                adventurerCount = 4;
                guardianCount = 2;
                extraCard = false;
                break;
            case 7:
                if (Math.random() < 0.5) {
                    adventurerCount = 4;
                    guardianCount = 3;
                } else {
                    adventurerCount = 5;
                    guardianCount = 2;
                }
                extraCard = true;
                break;
            case 8:
                if (Math.random() < 0.5) {
                    adventurerCount = 5;
                    guardianCount = 3;
                } else {
                    adventurerCount = 6;
                    guardianCount = 2;
                }
                extraCard = true;
                break;
            case 9:
                adventurerCount = 6;
                guardianCount = 3;
                extraCard = false;
                break;
            case 10:
                if (Math.random() < 0.5) {
                    adventurerCount = 6;
                    guardianCount = 4;
                } else {
                    adventurerCount = 7;
                    guardianCount = 3;
                }
                extraCard = true;
                break;
            default:
                // フォールバック
                adventurerCount = Math.ceil(playerCount * 0.6);
                guardianCount = Math.floor(playerCount * 0.4);
                extraCard = false;
        }

        const totalCards = extraCard ? playerCount + 1 : playerCount;
        const roles = [];
        
        // 役職を配列に追加
        for (let i = 0; i < adventurerCount; i++) {
            roles.push('adventurer');
        }
        for (let i = 0; i < guardianCount; i++) {
            roles.push('guardian');
        }
        
        // 不足分を補完
        if (!extraCard && roles.length < totalCards) {
            roles.push(Math.random() < 0.6 ? 'adventurer' : 'guardian');
        }
        
        // シャッフル
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }
        
        return roles.slice(0, playerCount);
    } catch (error) {
        console.error('役職割り当てエラー:', error);
        // フォールバック - 交互に役職を割り当て
        const fallbackRoles = [];
        for (let i = 0; i < playerCount; i++) {
            fallbackRoles.push(i % 2 === 0 ? 'adventurer' : 'guardian');
        }
        return fallbackRoles;
    }
}

function generateAllCards(playerCount) {
    // バリデーション
    if (!playerCount || playerCount < 3 || playerCount > 10) {
        console.warn('無効なプレイヤー数:', playerCount);
        playerCount = Math.max(3, Math.min(10, playerCount || 3));
    }

    let treasureCount, trapCount, emptyCount;

    try {
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
                // フォールバック
                treasureCount = 7;
                trapCount = 2;
                emptyCount = 16;
        }

        const cards = [];
        
        // 財宝カード
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
        
        // 空きカード
        for (let i = 0; i < emptyCount; i++) {
            cards.push({ 
                type: 'empty', 
                id: `empty-${i}`, 
                revealed: false 
            });
        }
        
        return { cards, treasureCount, trapCount };
    } catch (error) {
        console.error('カード生成エラー:', error);
        // フォールバック
        return {
            cards: [
                { type: 'treasure', id: 'treasure-0', revealed: false },
                { type: 'trap', id: 'trap-0', revealed: false },
                { type: 'empty', id: 'empty-0', revealed: false }
            ],
            treasureCount: 1,
            trapCount: 1
        };
    }
}

function shuffleArray(array) {
    try {
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
    } catch (error) {
        console.error('配列シャッフルエラー:', error);
        return array || [];
    }
}

function distributeCards(allCards, playerCount, cardsPerPlayer) {
    try {
        // バリデーション
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
            cardsPerPlayer = 5; // デフォルト値
        }

        const shuffledCards = shuffleArray([...allCards]);
        const playerHands = {};
        
        for (let i = 0; i < playerCount; i++) {
            const hand = shuffledCards.splice(0, cardsPerPlayer);
            playerHands[i] = shuffleArray(hand);
        }
        
        return { playerHands, remainingCards: shuffledCards };
    } catch (error) {
        console.error('カード配布エラー:', error);
        return { playerHands: {}, remainingCards: allCards || [] };
    }
}

function calculateVictoryGoal(playerCount) {
    try {
        // バリデーション
        if (!playerCount || playerCount < 3 || playerCount > 10) {
            console.warn('無効なプレイヤー数:', playerCount);
            playerCount = Math.max(3, Math.min(10, playerCount || 5));
        }

        // 財宝の勝利条件：全ての財宝を発見する
        let treasureGoal;
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
        
        // 罠の勝利条件：全ての罠を発動させる
        const trapGoal = playerCount === 10 ? 3 : 2;
        
        return { treasureGoal, trapGoal };
    } catch (error) {
        console.error('勝利条件計算エラー:', error);
        // フォールバック
        return { treasureGoal: 7, trapGoal: 2 };
    }
}

// ゲームデータの検証関数
function validateGameData(gameData) {
    if (!gameData || typeof gameData !== 'object') {
        console.error('無効なゲームデータ:', gameData);
        return false;
    }

    const requiredFields = ['id', 'players', 'gameState', 'host'];
    for (const field of requiredFields) {
        if (!gameData.hasOwnProperty(field)) {
            console.error(`必須フィールドが不足: ${field}`);
            return false;
        }
    }

    if (!Array.isArray(gameData.players)) {
        console.error('プレイヤーデータが配列ではありません:', gameData.players);
        return false;
    }

    return true;
}

// プレイヤーデータの検証関数
function validatePlayer(player) {
    if (!player || typeof player !== 'object') {
        return false;
    }

    const requiredFields = ['id', 'name', 'connected'];
    for (const field of requiredFields) {
        if (!player.hasOwnProperty(field)) {
            return false;
        }
    }

    return true;
}

// カードデータの検証関数
function validateCard(card) {
    if (!card || typeof card !== 'object') {
        return false;
    }

    const requiredFields = ['type', 'id', 'revealed'];
    for (const field of requiredFields) {
        if (!card.hasOwnProperty(field)) {
            return false;
        }
    }

    const validTypes = ['treasure', 'trap', 'empty'];
    if (!validTypes.includes(card.type)) {
        return false;
    }

    return true;
}

// ゲーム状態のサニタイズ関数
function sanitizeGameData(gameData) {
    try {
        if (!gameData) return null;

        // 安全なコピーを作成
        const sanitized = {
            id: String(gameData.id || ''),
            players: [],
            gameState: String(gameData.gameState || 'waiting'),
            host: String(gameData.host || ''),
            password: gameData.password || null,
            messages: Array.isArray(gameData.messages) ? gameData.messages.slice(-20) : [],
            currentRound: Math.max(1, parseInt(gameData.currentRound) || 1),
            treasureFound: Math.max(0, parseInt(gameData.treasureFound) || 0),
            trapTriggered: Math.max(0, parseInt(gameData.trapTriggered) || 0),
            treasureGoal: Math.max(1, parseInt(gameData.treasureGoal) || 7),
            trapGoal: Math.max(1, parseInt(gameData.trapGoal) || 2),
            totalTreasures: Math.max(1, parseInt(gameData.totalTreasures) || 7),
            totalTraps: Math.max(1, parseInt(gameData.totalTraps) || 2),
            keyHolderId: gameData.keyHolderId || null,
            cardsPerPlayer: Math.max(1, parseInt(gameData.cardsPerPlayer) || 5),
            cardsFlippedThisRound: Math.max(0, parseInt(gameData.cardsFlippedThisRound) || 0),
            maxRounds: Math.max(1, parseInt(gameData.maxRounds) || 4),
            turnInRound: Math.max(0, parseInt(gameData.turnInRound) || 0),
            allCards: Array.isArray(gameData.allCards) ? gameData.allCards : [],
            playerHands: gameData.playerHands || {},
            remainingCards: Array.isArray(gameData.remainingCards) ? gameData.remainingCards : []
        };

        // プレイヤーデータのサニタイズ
        if (Array.isArray(gameData.players)) {
            sanitized.players = gameData.players.map(player => {
                if (!validatePlayer(player)) {
                    console.warn('無効なプレイヤーデータ:', player);
                    return null;
                }
                
                return {
                    id: String(player.id || ''),
                    name: String(player.name || '').trim(),
                    connected: Boolean(player.connected),
                    role: player.role || null,
                    hand: Array.isArray(player.hand) ? player.hand.filter(validateCard) : []
                };
            }).filter(Boolean); // null要素を除去
        }

        return sanitized;
    } catch (error) {
        console.error('ゲームデータサニタイズエラー:', error);
        return null;
    }
}

// デバッグ用の統計情報取得
function getGameStats(gameData) {
    try {
        if (!gameData) return null;

        const connectedPlayers = gameData.players ? gameData.players.filter(p => p.connected) : [];
        const adventurers = gameData.players ? gameData.players.filter(p => p.role === 'adventurer') : [];
        const guardians = gameData.players ? gameData.players.filter(p => p.role === 'guardian') : [];

        return {
            totalPlayers: gameData.players ? gameData.players.length : 0,
            connectedPlayers: connectedPlayers.length,
            adventurers: adventurers.length,
            guardians: guardians.length,
            gameState: gameData.gameState,
            currentRound: gameData.currentRound,
            treasureProgress: `${gameData.treasureFound || 0}/${gameData.treasureGoal || 7}`,
            trapProgress: `${gameData.trapTriggered || 0}/${gameData.trapGoal || 2}`,
            cardsFlipped: gameData.cardsFlippedThisRound || 0,
            keyHolder: gameData.players ? 
                gameData.players.find(p => p.id === gameData.keyHolderId)?.name || '不明' : '不明'
        };
    } catch (error) {
        console.error('ゲーム統計取得エラー:', error);
        return null;
    }
}

module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal,
    validateGameData,
    validatePlayer,
    validateCard,
    sanitizeGameData,
    getGameStats
};
