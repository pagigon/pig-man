// server/database/gameStore.js
class GameStore {
    constructor() {
        this.games = new Map();
        this.playerSessions = new Map();
        this.gameHistory = new Map();
    }

    // ゲーム管理
    createGame(gameData) {
        this.games.set(gameData.id, {
            ...gameData,
            createdAt: Date.now(),
            lastActivity: Date.now()
        });
        return this.games.get(gameData.id);
    }

    getGame(gameId) {
        const game = this.games.get(gameId);
        if (game) {
            game.lastActivity = Date.now();
        }
        return game;
    }

    updateGame(gameId, updates) {
        const game = this.games.get(gameId);
        if (game) {
            Object.assign(game, updates, { lastActivity: Date.now() });
            return game;
        }
        return null;
    }

    deleteGame(gameId) {
        const game = this.games.get(gameId);
        if (game) {
            // ゲーム履歴に保存
            this.gameHistory.set(gameId, {
                ...game,
                endedAt: Date.now()
            });
            this.games.delete(gameId);
            return true;
        }
        return false;
    }

    // プレイヤーセッション管理
    createPlayerSession(socketId, playerData) {
        this.playerSessions.set(socketId, {
            ...playerData,
            createdAt: Date.now(),
            lastSeen: Date.now()
        });
    }

    getPlayerSession(socketId) {
        const session = this.playerSessions.get(socketId);
        if (session) {
            session.lastSeen = Date.now();
        }
        return session;
    }

    findPlayerByName(playerName) {
        for (const [socketId, session] of this.playerSessions.entries()) {
            if (session.name === playerName) {
                return { socketId, session };
            }
        }
        return null;
    }

    removePlayerSession(socketId) {
        return this.playerSessions.delete(socketId);
    }

    // ゲーム統計
    getGameStats() {
        const activeGames = this.games.size;
        const totalPlayers = this.playerSessions.size;
        const completedGames = this.gameHistory.size;
        
        return {
            activeGames,
            totalPlayers,
            completedGames,
            uptime: process.uptime()
        };
    }

    // クリーンアップ（非アクティブなゲームを削除）
    cleanup() {
        const now = Date.now();
        const maxInactiveTime = 30 * 60 * 1000; // 30分

        // 非アクティブなゲームの削除
        for (const [gameId, game] of this.games.entries()) {
            if (now - game.lastActivity > maxInactiveTime) {
                console.log(`Cleaning up inactive game: ${gameId}`);
                this.deleteGame(gameId);
            }
        }

        // 古いプレイヤーセッションの削除
        for (const [socketId, session] of this.playerSessions.entries()) {
            if (now - session.lastSeen > maxInactiveTime) {
                console.log(`Cleaning up inactive player session: ${socketId}`);
                this.removePlayerSession(socketId);
            }
        }

        // 古いゲーム履歴の削除（7日以上古い）
        const maxHistoryAge = 7 * 24 * 60 * 60 * 1000; // 7日
        for (const [gameId, game] of this.gameHistory.entries()) {
            if (now - game.endedAt > maxHistoryAge) {
                this.gameHistory.delete(gameId);
            }
        }
    }

    // 定期クリーンアップの開始
    startCleanupTask() {
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // 5分毎
    }
}

// Redis版（本格運用時）
class RedisGameStore extends GameStore {
    constructor(redisClient) {
        super();
        this.redis = redisClient;
    }

    async createGame(gameData) {
        await this.redis.hset('games', gameData.id, JSON.stringify({
            ...gameData,
            createdAt: Date.now(),
            lastActivity: Date.now()
        }));
        return gameData;
    }

    async getGame(gameId) {
        const gameStr = await this.redis.hget('games', gameId);
        if (gameStr) {
            const game = JSON.parse(gameStr);
            game.lastActivity = Date.now();
            await this.redis.hset('games', gameId, JSON.stringify(game));
            return game;
        }
        return null;
    }

    // 他のメソッドも同様にRedis対応...
}

module.exports = { GameStore, RedisGameStore };
