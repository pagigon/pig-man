// メインアプリケーション初期化

console.log('🚀 App.js 読み込み開始');

// アプリケーション設定
const APP_CONFIG = {
    version: '1.0.0',
    debug: window.location.search.includes('debug=1'),
    requiredElements: ['lobby', 'room-info', 'game-board', 'error-message', 'connection-status'],
    storageKeys: {
        playerInfo: 'pigGamePlayerInfo',
        rejoinInfo: 'pigGameRejoinInfo',
        settings: 'pigGameSettings'
    }
};

// アプリケーション初期化クラス
class App {
    constructor() {
        this.game = null;
        this.initialized = false;
        this.startTime = performance.now();
        
        console.log(`🐷 豚小屋探検隊 v${APP_CONFIG.version} 初期化開始`);
        
        if (APP_CONFIG.debug) {
            console.log('🐛 デバッグモード有効');
            this.enableDebugMode();
        }
    }

    async initialize() {
        try {
            // パフォーマンス測定開始
            Utils.performance.mark('app-init-start');
            
            // 1. 環境チェック
            await this.checkEnvironment();
            
            // 2. DOM要素チェック
            this.checkRequiredElements();
            
            // 3. 依存関係チェック
            this.checkDependencies();
            
            // 4. 設定読み込み
            this.loadSettings();
            
            // 5. ゲームインスタンス作成
            this.createGameInstance();
            
            // 6. グローバルイベント設定
            this.setupGlobalEvents();
            
            // 7. 初期化完了
            this.onInitializationComplete();
            
            // パフォーマンス測定終了
            Utils.performance.mark('app-init-end');
            const initTime = Utils.performance.measure('app-init', 'app-init-start', 'app-init-end');
            
            console.log(`✅ アプリケーション初期化完了 (${Math.round(initTime || 0)}ms)`);
            
        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }

    async checkEnvironment() {
        console.log('🔍 環境チェック中...');
        
        // ブラウザサポートチェック
        const requiredFeatures = {
            'Promise': typeof Promise !== 'undefined',
            'localStorage': typeof Storage !== 'undefined',
            'WebSocket': typeof WebSocket !== 'undefined',
            'JSON': typeof JSON !== 'undefined',
            'addEventListener': typeof EventTarget !== 'undefined'
        };

        const unsupportedFeatures = Object.entries(requiredFeatures)
            .filter(([name, supported]) => !supported)
            .map(([name]) => name);

        if (unsupportedFeatures.length > 0) {
            throw new Error(`ブラウザが必要な機能をサポートしていません: ${unsupportedFeatures.join(', ')}`);
        }

        // デバイス情報取得
        const deviceInfo = Utils.getDeviceInfo();
        console.log('📱 デバイス情報:', deviceInfo);
        
        // モバイル対応の調整
        if (deviceInfo.isMobile) {
            document.body.classList.add('mobile-device');
            console.log('📱 モバイルデバイス用の調整を適用');
        }

        console.log('✅ 環境チェック完了');
    }

    checkRequiredElements() {
        console.log('🔍 DOM要素チェック中...');
        
        const result = Utils.checkRequiredElements(APP_CONFIG.requiredElements);
        
        if (!result.allFound) {
            const error = new Error(`必須要素が不足しています: ${result.missing.join(', ')}`);
            error.missingElements = result.missing;
            throw error;
        }
        
        console.log(`✅ DOM要素チェック完了 (${result.found.length}/${APP_CONFIG.requiredElements.length})`);
    }

    checkDependencies() {
        console.log('🔍 依存関係チェック中...');
        
        const requiredGlobals = {
            'Socket.io': typeof io !== 'undefined',
            'Utils': typeof Utils !== 'undefined',
            'UIManager': typeof UIManager !== 'undefined',
            'SocketClient': typeof SocketClient !== 'undefined'
        };

        const missingDependencies = Object.entries(requiredGlobals)
            .filter(([name, available]) => !available)
            .map(([name]) => name);

        if (missingDependencies.length > 0) {
            throw new Error(`必要な依存関係が不足しています: ${missingDependencies.join(', ')}`);
        }

        console.log('✅ 依存関係チェック完了');
    }

    loadSettings() {
        console.log('⚙️ 設定読み込み中...');
        
        const defaultSettings = {
            notifications: true,
            sounds: true,
            animations: true,
            theme: 'default',
            language: 'ja'
        };

        const savedSettings = Utils.storage.get(APP_CONFIG.storageKeys.settings, defaultSettings);
        this.settings = { ...defaultSettings, ...savedSettings };
        
        // 設定を適用
        this.applySettings();
        
        console.log('✅ 設定読み込み完了:', this.settings);
    }

    applySettings() {
        // アニメーション設定
        if (!this.settings.animations) {
            document.body.classList.add('no-animations');
        }
        
        // テーマ設定
        if (this.settings.theme !== 'default') {
            document.body.classList.add(`theme-${this.settings.theme}`);
        }
    }

    createGameInstance() {
        console.log('🎮 ゲームインスタンス作成中...');
        
        // TreasureTempleGameクラスが利用可能になったら作成
        if (typeof TreasureTempleGame !== 'undefined') {
            this.game = new TreasureTempleGame();
            window.game = this.game; // グローバルアクセス用
            console.log('✅ ゲームインスタンス作成完了');
        } else {
            console.warn('⚠️ TreasureTempleGameクラスが見つかりません');
            
            // 少し待ってから再試行
            setTimeout(() => {
                if (typeof TreasureTempleGame !== 'undefined') {
                    this.game = new TreasureTempleGame();
                    window.game = this.game;
                    console.log('✅ ゲームインスタンス作成完了（遅延）');
                }
            }, 1000);
        }
    }

    setupGlobalEvents() {
        console.log('🌐 グローバルイベント設定中...');
        
        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.game && this.game.roomId && this.game.gameData?.gameState === 'playing') {
                e.preventDefault();
                e.returnValue = 'ゲーム中です。本当にページを離れますか？';
                return e.returnValue;
            }
        });

        // オンライン/オフライン状態の監視
        window.addEventListener('online', () => {
            console.log('🌐 オンラインに復帰');
            UIManager.showToast('インターネット接続が復旧しました', 'success');
            
            // 自動再接続を試行
            if (this.game?.socketClient && !this.game.socketClient.isConnected()) {
                setTimeout(() => {
                    this.game.socketClient.manualReconnect();
                }, 1000);
            }
        });

        window.addEventListener('offline', () => {
            console.log('📵 オフラインになりました');
            UIManager.showToast('インターネット接続が切断されました', 'warning');
        });

        // ページの可視性変更監視
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ ページが表示されました');
                
                // 接続状態をチェック
                if (this.game?.socketClient && !this.game.socketClient.isConnected()) {
                    UIManager.showToast('接続を確認中...', 'info');
                    setTimeout(() => {
                        if (!this.game.socketClient.isConnected()) {
                            this.game.socketClient.manualReconnect();
                        }
                    }, 2000);
                }
            } else {
                console.log('👁️ ページが非表示になりました');
            }
        });

        // エラーハンドリング
        window.addEventListener('error', (event) => {
            console.error('🚨 JavaScript エラー:', Utils.collectErrorInfo(event.error, {
                type: 'javascript',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }));
            
            UIManager.showToast('予期しないエラーが発生しました', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Promise エラー:', Utils.collectErrorInfo(event.reason, {
                type: 'promise'
            }));
            
            UIManager.showToast('通信エラーが発生しました', 'warning');
            event.preventDefault(); // デフォルトの処理を防ぐ
        });

        // キーボードショートカット（グローバル）
        document.addEventListener('keydown', (e) => {
            // Ctrl+R または F5 でのリロード確認
            if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
                if (this.game?.roomId && this.game?.gameData?.gameState === 'playing') {
                    e.preventDefault();
                    UIManager.showToast('ゲーム中のリロードは推奨されません', 'warning');
                }
            }
            
            // デバッグモード切り替え (Ctrl+Shift+D)
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.toggleDebugMode();
            }
        });

        console.log('✅ グローバルイベント設定完了');
    }

    onInitializationComplete() {
        this.initialized = true;
        
        // ウェルカムメッセージ
        setTimeout(() => {
            UIManager.showToast('🐷 豚小屋探検隊へようこそ！', 'info', 4000);
        }, 1000);

        // 初期化完了イベントを発火
        window.dispatchEvent(new CustomEvent('appInitialized', {
            detail: {
                version: APP_CONFIG.version,
                initTime: performance.now() - this.startTime,
                game: this.game
            }
        }));

        console.log(`🎉 アプリケーション準備完了！ (総時間: ${Math.round(performance.now() - this.startTime)}ms)`);
    }

    handleInitializationError(error) {
        console.error('💥 初期化エラー:', error);
        
        // ユーザーに分かりやすいエラーメッセージを表示
        let userMessage = '初期化に失敗しました。';
        
        if (error.missingElements) {
            userMessage = 'ページの読み込みに問題があります。ページをリロードしてください。';
        } else if (error.message.includes('Socket.io')) {
            userMessage = '通信ライブラリの読み込みに失敗しました。ページをリロードしてください。';
        } else if (error.message.includes('ブラウザ')) {
            userMessage = 'お使いのブラウザはサポートされていません。最新版にアップデートしてください。';
        }
        
        UIManager.showError(userMessage);
        
        // 詳細なエラー情報をコンソールに出力
        console.group('🔍 エラー詳細');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('User Agent:', navigator.userAgent);
        console.error('URL:', window.location.href);
        console.groupEnd();

        // 重要なエラーの場合はアラートも表示
        if (error.missingElements || error.message.includes('依存関係')) {
            setTimeout(() => {
                alert(`${userMessage}\n\n技術的な詳細: ${error.message}`);
            }, 1000);
        }
    }

    enableDebugMode() {
        console.log('🐛 デバッグモード有効化');
        
        window.APP_DEBUG = {
            app: this,
            utils: Utils,
            ui: UIManager,
            config: APP_CONFIG,
            performance: performance,
            
            // デバッグヘルパー
            showToast: (msg, type) => UIManager.showToast(msg, type),
            getGameState: () => this.game?.gameData,
            getConnectionInfo: () => this.game?.socketClient?.getDebugInfo(),
            clearStorage: () => {
                Object.values(APP_CONFIG.storageKeys).forEach(key => {
                    Utils.storage.remove(key);
                });
                console.log('ストレージをクリアしました');
            }
        };
        
        console.log('🛠️ デバッグオブジェクトが window.APP_DEBUG に利用可能です');
        
        // デバッグ用のスタイルを適用
        document.body.classList.add('debug-mode');
        
        // デバッグ情報表示
        setTimeout(() => {
            UIManager.showToast('デバッグモードが有効です', 'warning');
        }, 2000);
    }

    toggleDebugMode() {
        if (document.body.classList.contains('debug-mode')) {
            document.body.classList.remove('debug-mode');
            delete window.APP_DEBUG;
            UIManager.showToast('デバッグモード無効', 'info');
        } else {
            this.enableDebugMode();
        }
    }

    // 設定保存
    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        Utils.storage.set(APP_CONFIG.storageKeys.settings, this.settings);
        this.applySettings();
        console.log('⚙️ 設定を保存しました:', newSettings);
    }

    // 統計情報取得
    getStats() {
        return {
            version: APP_CONFIG.version,
            initialized: this.initialized,
            uptime: performance.now() - this.startTime,
            game: this.game ? {
                roomId: this.game.roomId,
                playerName: this.game.myName,
                gameState: this.game.gameData?.gameState
            } : null,
            connection: this.game?.socketClient?.getStats(),
            settings: this.settings
        };
    }
}

// DOM読み込み完了後の初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM読み込み完了');
    
    // パフォーマンス測定
    const domLoadTime = performance.now();
    console.log(`DOM読み込み時間: ${Math.round(domLoadTime)}ms`);
    
    try {
        // アプリケーション初期化
        const app = new App();
        window.app = app; // グローバルアクセス用
        
        await app.initialize();
        
    } catch (error) {
        console.error('❌ DOM初期化エラー:', error);
        
        // 緊急時のフォールバック
        alert('アプリケーションの初期化に失敗しました。ページをリロードしてください。\n\nエラー: ' + error.message);
    }
});

// ページ読み込み完了時の処理
window.addEventListener('load', function() {
    const loadTime = performance.now();
    console.log(`📊 ページ読み込み完了: ${Math.round(loadTime)}ms`);
    
    // 読み込み時間が長い場合の警告
    if (loadTime > 5000) {
        console.warn('⚠️ ページの読み込みが遅いです');
        setTimeout(() => {
            UIManager.showToast('読み込みが完了しました', 'info');
        }, 1000);
    }
    
    // パフォーマンス情報をコンソールに出力
    if (APP_CONFIG.debug) {
        console.group('📊 パフォーマンス情報');
        console.log('Load Time:', Math.round(loadTime), 'ms');
        console.log('Memory Usage:', performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB'
        } : 'N/A');
        console.groupEnd();
    }
});

console.log('✅ App.js 読み込み完了');
