// public/js/stateManager.js
class StateManager {
    constructor() {
        this.state = {
            connectionStatus: 'disconnected',
            currentScreen: 'lobby',
            player: null,
            room: null,
            game: null,
            ui: {
                isLoading: false,
                error: null,
                notifications: []
            }
        };
        this.listeners = new Map();
        this.middleware = [];
    }

    // 状態更新
    setState(updates, source = 'unknown') {
        const prevState = { ...this.state };
        
        // ミドルウェア適用
        let processedUpdates = updates;
        for (const middleware of this.middleware) {
            processedUpdates = middleware(prevState, processedUpdates, source);
        }
        
        // 状態更新
        this.state = this.deepMerge(this.state, processedUpdates);
        
        // リスナー通知
        this.notifyListeners(prevState, this.state, source);
        
        // デバッグログ
        console.log(`State updated from ${source}:`, { 
            prev: prevState, 
            current: this.state, 
            updates: processedUpdates 
        });
    }

    // 状態取得
    getState() {
        return { ...this.state };
    }

    // リスナー登録
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        
        // 初回実行
        callback(this.getStateByPath(path), null);
        
        return () => {
            this.listeners.get(path)?.delete(callback);
        };
    }

    // ミドルウェア追加
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }

    // プライベートメソッド
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    getStateByPath(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    notifyListeners(prevState, currentState, source) {
        for (const [path, callbacks] of this.listeners.entries()) {
            const prevValue = this.getStateByPath(path);
            const currentValue = path.split('.').reduce((obj, key) => obj?.[key], currentState);
            
            if (JSON.stringify(prevValue) !== JSON.stringify(currentValue)) {
                callbacks.forEach(callback => {
                    try {
                        callback(currentValue, prevValue, source);
                    } catch (error) {
                        console.error('Listener error:', error);
                    }
                });
            }
        }
    }
}

// ゲーム固有の状態管理
class GameStateManager extends StateManager {
    constructor() {
        super();
        this.initializeMiddleware();
        this.initializeSubscriptions();
    }

    initializeMiddleware() {
        // エラー処理ミドルウェア
        this.addMiddleware((prev, updates, source) => {
            if (updates.ui?.error) {
                // 一定時間後にエラーをクリア
                setTimeout(() => {
                    this.setState({ ui: { error: null } }, 'error-timeout');
                }, 5000);
            }
            return updates;
        });

        // 通知管理ミドルウェア
        this.addMiddleware((prev, updates, source) => {
            if (updates.ui?.notifications) {
                // 最大10個の通知まで保持
                const notifications = [...(prev.ui?.notifications || []), ...updates.ui.notifications];
                updates.ui.notifications = notifications.slice(-10);
            }
            return updates;
        });

        // 自動保存ミドルウェア
        this.addMiddleware((prev, updates, source) => {
            if (updates.player || updates.room) {
                this.saveToLocalStorage();
            }
            return updates;
        });
    }

    initializeSubscriptions() {
        // 接続状態変更の監視
        this.subscribe('connectionStatus', (status) => {
            document.body.className = `connection-${status}`;
        });

        // 画面遷移の監視
        this.subscribe('currentScreen', (screen) => {
            UIManager.showScreen(screen);
        });

        // エラー表示の監視
        this.subscribe('ui.error', (error) => {
            if (error) {
                UIManager.showError(error.message, error.type);
            }
        });
    }

    // ゲーム固有のアクション
    updateGameState(gameData, source = 'server') {
        this.setState({
            game: gameData,
            currentScreen: this.determineScreen(gameData)
        }, source);
    }

    updateConnectionStatus(status) {
        this.setState({ connectionStatus: status }, 'socket');
    }

    setPlayer(playerData) {
        this.setState({ player: playerData }, 'player-action');
    }

    setRoom(roomData) {
        this.setState({ room: roomData }, 'room-action');
    }

    addNotification(message, type = 'info') {
        this.setState({
            ui: {
                notifications: [{
                    id: Date.now(),
                    message,
                    type,
                    timestamp: Date.now()
                }]
            }
        }, 'notification');
    }

    setError(message, type = 'error') {
        this.setState({
            ui: { error: { message, type } }
        }, 'error');
    }

    clearError() {
        this.setState({
            ui: { error: null }
        }, 'error-clear');
    }

    // プライベートメソッド
    determineScreen(gameData) {
        if (!gameData) return 'lobby';
        
        switch (gameData.gameState) {
            case 'waiting': return 'room-info';
            case 'playing': return 'game-board';
            case 'finished': return 'victory-screen';
            default: return 'lobby';
        }
    }

    saveToLocalStorage() {
        try {
            const saveData = {
                player: this.state.player,
                room: this.state.room ? { id: this.state.room.id } : null,
                timestamp: Date.now()
            };
            localStorage.setItem('pig-game-state', JSON.stringify(saveData));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('pig-game-state');
            if (saved) {
                const data = JSON.parse(saved);
                // 24時間以内のデータのみ復元
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    this.setState({
                        player: data.player,
                        room: data.room
                    }, 'localStorage');
                }
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }
}

// グローバルステート管理インスタンス
window.gameStateManager = new GameStateManager();
