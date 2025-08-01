// 豚小屋探検隊 - Render環境最適化版
console.log('🐷 豚小屋探検隊 JavaScript 開始 (Render版)');

// Render環境の検出
const isRenderEnvironment = window.location.hostname.includes('render') || 
                           window.location.hostname.includes('onrender');
console.log('Render環境:', isRenderEnvironment);

// デバッグ用のグローバル関数
window.debugInfo = () => {
    console.log('=== デバッグ情報 (Render版) ===');
    console.log('URL:', window.location.href);
    console.log('Render環境:', isRenderEnvironment);
    console.log('Socket.io 存在:', typeof io !== 'undefined');
    console.log('PigManGame インスタンス:', window.pigGame ? '存在' : '未作成');
    if (window.pigGame?.socketClient?.socket) {
        console.log('Socket ID:', window.pigGame.socketClient.socket.id);
        console.log('Socket 接続状態:', window.pigGame.socketClient.socket.connected);
        console.log('Socket Transport:', window.pigGame.socketClient.socket.io.engine.transport.name);
    }
    console.log('現在のルームID:', window.pigGame?.roomId || 'なし');
    console.log('プレイヤー名:', window.pigGame?.myName || 'なし');
    console.log('==============================');
};

// ユーティリティ関数
const safeGetElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ 要素が見つかりません: #${id}`);
    }
    return element;
};

const safeSetText = (id, text) => {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
        return true;
    }
    return false;
};

const safeAddEventListener = (id, event, handler) => {
    const element = safeGetElement(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ ${id} に${event}イベント追加成功`);
        return true;
    } else {
        console.warn(`⚠️ イベント追加失敗: #${id}`);
        return false;
    }
};

// UIManager クラス
class UIManager {
    static showConnectionStatus(status) {
        console.log(`接続状態変更: ${status}`);
        const statusEl = safeGetElement('connection-status');
        if (!statusEl) return;
        
        if (status === 'connected') {
            statusEl.textContent = '🟢 接続済み';
            statusEl.className = 'connection-status connected';
        } else {
            statusEl.textContent = '🔴 切断';
            statusEl.className = 'connection-status disconnected';
        }
    }

    static showError(message, type = 'error') {
        console.log(`UI エラー表示: ${message} (タイプ: ${type})`);
        const errorEl = safeGetElement('error-message');
        if (!errorEl) return;
        
        errorEl.textContent = message;
        
        if (type === 'success') {
            errorEl.style.background = 'rgba(34, 139, 34, 0.9)';
            errorEl.style.borderColor = '#228B22';
        } else if (type === 'warning') {
            errorEl.style.background = 'rgba(255, 165, 0, 0.9)';
            errorEl.style.borderColor = '#FFA500';
        } else {
            errorEl.style.background = 'rgba(220, 20, 60, 0.9)';
            errorEl.style.borderColor = '#DC143C';
        }
        
        errorEl.style.display = 'block';
        
        const displayTime = type === 'success' ? 3000 : 8000;
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, displayTime);
    }

    static showPlayerName(name) {
        console.log(`プレイヤー名表示: ${name}`);
        const displayEl = safeGetElement('player-name-display');
        const nameEl = safeGetElement('my-name');
        
        if (displayEl && nameEl) {
            displayEl.style.display = 'block';
            nameEl.textContent = name;
        }
    }

    static updateRoomList(rooms) {
        console.log(`ルーム一覧更新: ${rooms.length}個のルーム`);
        const container = safeGetElement('room-list-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #87CEEB;">現在開設中のルームはありません</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'room-item-info';
            infoDiv.innerHTML = `
                <strong>ID: ${room.id}</strong>
                ${room.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
                <br>
                ホスト: ${room.hostName} | プレイヤー: ${room.playerCount}/10
            `;
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-small';
            joinBtn.textContent = '参加';
            joinBtn.onclick = () => {
                const roomIdInput = safeGetElement('room-id-input');
                if (roomIdInput) roomIdInput.value = room.id;
                if (room.hasPassword) {
                    const passwordGroup = safeGetElement('join-password-group');
                    if (passwordGroup) passwordGroup.style.display = 'block';
                }
            };
            
            roomDiv.appendChild(infoDiv);
            roomDiv.appendChild(joinBtn);
            container.appendChild(roomDiv);
        });
    }

    static showScreen(screenName) {
        console.log(`画面切り替え: ${screenName}`);
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        
        screens.forEach(screen => {
            const element = safeGetElement(screen);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        if (screenName) {
            const screen = safeGetElement(screenName);
            if (screen) {
                screen.style.display = 'block';
            }
        }
    }

    static updatePlayersList(players, hostId) {
        console.log(`プレイヤー一覧更新: ${players.length}人`);
        const container = safeGetElement('players-list');
        const countEl = safeGetElement('player-count');
        
        if (!container || !countEl) return;
        
        const count = players.filter(p => p.connected).length;
        countEl.textContent = count;
        
        container.innerHTML = '';
        players.forEach((player) => {
            const div = document.createElement('div');
            div.className = 'player-item';
            if (player.id === hostId) {
                div.classList.add('host');
            }
            
            const status = player.connected ? '🟢' : '🔴';
            const disconnectedText = player.connected ? '' : ' (切断中)';
            div.textContent = `${status} ${player.name}${disconnectedText}`;
            
            if (!player.connected) {
                div.style.opacity = '0.6';
                div.style.fontStyle = 'italic';
            }
            
            container.appendChild(div);
        });
    }
}

// SocketClient クラス (Render最適化)
class SocketClient {
    constructor(game) {
        console.log('SocketClient 初期化開始 (Render版)');
        this.game = game;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10; // Renderでは多めに設定
        this.connectionTimeout = null;
        this.initializeSocket();
    }

    initializeSocket() {
        console.log('Socket.io 初期化開始 (Render対応)');
        
        if (typeof io === 'undefined') {
            console.error('❌ Socket.io が読み込まれていません');
            UIManager.showError('Socket.io ライブラリが読み込まれていません');
            return;
        }

        try {
            // Render環境向けの設定
            const socketConfig = {
                // Renderではpollingを優先（WebSocketは不安定な場合がある）
                transports: ['polling', 'websocket'],
                // タイムアウトを調整
                timeout: 15000,
                // 再接続設定（Render向けに調整）
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 3000,
                reconnectionDelayMax: 15000,
                // フォースニューコネクション
                forceNew: false,
                // ピング設定を調整（Renderでは長めに）
                pingInterval: 25000,
                pingTimeout: 20000,
                // アップグレード設定
                upgrade: true,
                // 追加設定
                autoConnect: true
            };

            console.log('Socket.io 設定:', socketConfig);
            this.socket = io(socketConfig);

            console.log('Socket.io インスタンス作成成功 (Render設定)');
            this.setupEventListeners();
            this.setupConnectionMonitoring();
            
        } catch (error) {
            console.error('❌ Socket.io 初期化エラー:', error);
            UIManager.showError('サーバー接続の初期化に失敗しました');
        }
    }

    setupEventListeners() {
        console.log('Socket イベントリスナー設定開始 (Render版)');
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            return;
        }

        // 接続イベント
        this.socket.on('connect', () => {
            console.log('✅ Socket.io 接続成功:', this.socket.id);
            console.log('Transport:', this.socket.io.engine.transport.name);
            
            this.game.mySocketId = this.socket.id;
            UIManager.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
            
            // 接続成功時にルーム一覧を取得
            setTimeout(() => {
                this.getRoomList();
            }, 1000);
        });

        // Transport変更を監視
        this.socket.io.on('upgrade', (transport) => {
            console.log('🔄 Transport アップグレード:', transport.name);
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io 切断:', reason);
            UIManager.showConnectionStatus('disconnected');
            
            // 手動切断でない場合は再接続を試行
            if (reason !== 'io client disconnect') {
                UIManager.showError('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
            }
        });

        // エラーイベント
        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket.io 接続エラー:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UIManager.showError('サーバーに接続できません。ページをリロードしてください。');
            } else {
                UIManager.showError(`接続エラー (${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`, 'warning');
            }
        });

        // 再接続試行
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 再接続試行 ${attemptNumber}/${this.maxReconnectAttempts}`);
            UIManager.showError(`再接続中... (${attemptNumber}/${this.maxReconnectAttempts})`, 'warning');
        });

        // 再接続成功
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ 再接続成功 (試行回数: ${attemptNumber})`);
            UIManager.showError('サーバーに再接続しました！', 'success');
        });

        // ゲーム関連イベント
        this.socket.on('roomList', (rooms) => {
            console.log('📋 ルーム一覧受信:', rooms);
            UIManager.updateRoomList(rooms);
        });

        this.socket.on('roomCreated', (data) => {
            console.log('✅ ルーム作成成功:', data);
            this.game.onRoomCreated(data);
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('✅ ルーム参加成功:', data);
            this.game.onJoinSuccess(data);
        });

        this.socket.on('gameUpdate', (gameData) => {
            console.log('🎮 ゲーム状態更新');
            this.game.gameData = gameData;
            this.game.updateUI();
        });

        this.socket.on('error', (error) => {
            console.error('❌ サーバーエラー:', error);
            UIManager.showError(error.message || 'サーバーエラーが発生しました');
        });

        console.log('✅ Socket イベントリスナー設定完了 (Render版)');
    }

    // Render環境用の接続監視
    setupConnectionMonitoring() {
        // 初期接続のタイムアウト監視
        this.connectionTimeout = setTimeout(() => {
            if (!this.socket.connected) {
                console.warn('⚠️ 初期接続がタイムアウトしました');
                UIManager.showError('サーバー接続に時間がかかっています...', 'warning');
            }
        }, 10000);

        // 定期的な接続状態チェック
        setInterval(() => {
            if (this.socket && !this.socket.connected) {
                console.warn('⚠️ Socket接続が切れています');
            }
        }, 30000); // 30秒ごと
    }

    // Socket.io通信メソッド (Render最適化)
    emit(event, data) {
        console.log(`📤 Socket送信: ${event}`, data);
        
        if (!this.socket) {
            console.error('❌ Socket が存在しません');
            UIManager.showError('サーバー接続が初期化されていません');
            return false;
        }

        if (!this.socket.connected) {
            console.error('❌ Socket 未接続');
            UIManager.showError('サーバーに接続されていません。接続を確認中...');
            
            // 再接続を試行
            if (!this.socket.connecting) {
                this.socket.connect();
            }
            return false;
        }

        try {
            this.socket.emit(event, data);
            console.log(`✅ Socket送信成功: ${event}`);
            return true;
        } catch (error) {
            console.error(`❌ Socket送信エラー: ${event}`, error);
            UIManager.showError('通信エラーが発生しました');
            return false;
        }
    }

    getRoomList() {
        console.log('📋 ルーム一覧要求');
        return this.emit('getRoomList');
    }

    createRoom(playerName, hasPassword, password) {
        console.log('🏠 ルーム作成要求:', { playerName, hasPassword: !!hasPassword });
        return this.emit('createRoom', { playerName, hasPassword, password });
    }

    joinRoom(roomId, playerName, password) {
        console.log('👥 ルーム参加要求:', { roomId, playerName });
        return this.emit('joinRoom', { roomId, playerName, password });
    }

    isConnected() {
        const connected = this.socket && this.socket.connected;
        return connected;
    }

    // Render環境での手動再接続
    forceReconnect() {
        console.log('🔄 手動再接続開始');
        if (this.socket) {
            this.socket.disconnect();
            setTimeout(() => {
                this.socket.connect();
            }, 1000);
        }
    }
}

// メインゲームクラス (Render最適化)
class PigManGame {
    constructor() {
        console.log('🐷 PigManGame 初期化開始 (Render版)');
        
        this.socket = null;
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        this.socketClient = new SocketClient(this);
        this.initializeEventListeners();
        
        console.log('✅ PigManGame 初期化完了 (Render版)');
    }

    initializeEventListeners() {
        console.log('🎮 イベントリスナー設定開始 (Render版)');
        
        // パスワード表示切り替え
        const passwordToggleSuccess = safeAddEventListener('use-password', 'change', (e) => {
            console.log('パスワード設定切り替え:', e.target.checked);
            const passwordGroup = safeGetElement('password-group');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // ルーム作成ボタン
        const createRoomSuccess = safeAddEventListener('create-room', 'click', (e) => {
            console.log('🏠 ルーム作成ボタンクリック');
            e.preventDefault();
            this.createRoom();
        });

        // ルーム参加ボタン
        const joinRoomSuccess = safeAddEventListener('join-room', 'click', (e) => {
            console.log('👥 ルーム参加ボタンクリック');
            e.preventDefault();
            this.joinRoom();
        });

        // リフレッシュボタン
        const refreshSuccess = safeAddEventListener('refresh-rooms', 'click', (e) => {
            console.log('🔄 ルーム一覧更新ボタンクリック');
            e.preventDefault();
            this.socketClient.getRoomList();
        });

        // 手動再接続ボタンを追加
        this.addManualReconnectButton();

        // イベント設定結果の確認
        const results = {
            passwordToggle: passwordToggleSuccess,
            createRoom: createRoomSuccess,
            joinRoom: joinRoomSuccess,
            refresh: refreshSuccess
        };

        console.log('イベントリスナー設定結果:', results);
        
        const failedEvents = Object.entries(results)
            .filter(([key, success]) => !success)
            .map(([key]) => key);

        if (failedEvents.length > 0) {
            console.error('❌ 設定に失敗したイベント:', failedEvents);
            UIManager.showError(`一部のボタンが正常に動作しない可能性があります: ${failedEvents.join(', ')}`);
        } else {
            console.log('✅ すべてのイベントリスナー設定成功 (Render版)');
        }
    }

    // Render環境用の手動再接続ボタン
    addManualReconnectButton() {
        const reconnectBtn = document.createElement('button');
        reconnectBtn.id = 'manual-reconnect';
        reconnectBtn.className = 'btn btn-small';
        reconnectBtn.textContent = '🔄 再接続';
        reconnectBtn.style.position = 'fixed';
        reconnectBtn.style.top = '10px';
        reconnectBtn.style.left = '200px';
        reconnectBtn.style.zIndex = '1000';
        reconnectBtn.style.width = 'auto';
        
        reconnectBtn.onclick = () => {
            console.log('手動再接続ボタンクリック');
            this.socketClient.forceReconnect();
            UIManager.showError('再接続を試行中...', 'warning');
        };
        
        document.body.appendChild(reconnectBtn);
    }

    createRoom() {
        console.log('🏠 ルーム作成処理開始 (Render版)');
        
        // 接続状態確認
        if (!this.socketClient.isConnected()) {
            console.error('❌ ルーム作成失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません。再接続ボタンを押してください。');
            return;
        }

        // 入力値取得
        const nameInput = safeGetElement('player-name-create');
        const passwordCheck = safeGetElement('use-password');
        const passwordInput = safeGetElement('room-password');

        if (!nameInput) {
            console.error('❌ プレイヤー名入力欄が見つかりません');
            UIManager.showError('プレイヤー名入力欄が見つかりません');
            return;
        }

        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const hasPassword = passwordCheck ? passwordCheck.checked : false;
        const password = hasPassword && passwordInput ? passwordInput.value : '';

        console.log('ルーム作成パラメータ (Render版):', {
            playerName,
            hasPassword,
            passwordLength: password.length
        });

        // プレイヤー名設定
        this.myName = playerName;
        UIManager.showPlayerName(this.myName);

        // サーバーにルーム作成要求
        const success = this.socketClient.createRoom(playerName, hasPassword, password);
        
        if (success) {
            UIManager.showError('ルームを作成中... (Renderでは時間がかかる場合があります)', 'warning');
            
            // Render環境ではタイムアウトを設定
            setTimeout(() => {
                if (!this.roomId) {
                    console.warn('⚠️ ルーム作成がタイムアウトしました');
                    UIManager.showError('ルーム作成に時間がかかっています。もう一度お試しください。', 'warning');
                }
            }, 15000);
        }
    }

    joinRoom() {
        console.log('👥 ルーム参加処理開始 (Render版)');
        
        if (!this.socketClient.isConnected()) {
            console.error('❌ ルーム参加失敗: Socket未接続');
            UIManager.showError('サーバーに接続されていません');
            return;
        }

        const nameInput = safeGetElement('player-name-join');
        const roomInput = safeGetElement('room-id-input');
        const passwordInput = safeGetElement('join-password');

        if (!nameInput || !roomInput) {
            console.error('❌ 必要な入力欄が見つかりません');
            UIManager.showError('入力欄が見つかりません');
            return;
        }

        const playerName = nameInput.value.trim() || `プレイヤー${Math.floor(Math.random() * 1000)}`;
        const roomId = roomInput.value.trim().toUpperCase();
        const password = passwordInput ? passwordInput.value : '';

        if (!roomId) {
            UIManager.showError('ルームIDを入力してください');
            return;
        }

        console.log('ルーム参加パラメータ (Render版):', { playerName, roomId });

        this.myName = playerName;
        this.roomId = roomId;
        UIManager.showPlayerName(this.myName);

        const success = this.socketClient.joinRoom(roomId, playerName, password);
        
        if (success) {
            UIManager.showError('ルームに参加中...', 'warning');
        }
    }

    // サーバーからのイベント処理
    onRoomCreated(data) {
        console.log('✅ ルーム作成成功コールバック (Render版):', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;

        UIManager.showError(`ルーム ${data.roomId} を作成しました！`, 'success');
        this.showRoomInfo();
    }

    onJoinSuccess(data) {
        console.log('✅ ルーム参加成功コールバック (Render版):', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo?.isHost || false;

        UIManager.showError(`ルーム ${data.roomId} に参加しました！`, 'success');
        this.updateUI();
    }

    showRoomInfo() {
        console.log('🏠 ルーム情報画面表示 (Render版)');
        UIManager.showScreen('room-info');
        const roomIdDisplay = safeGetElement('room-id-display');
        if (roomIdDisplay && this.roomId) {
            roomIdDisplay.textContent = this.roomId;
        }
    }

    updateUI() {
        console.log('🎨 UI更新 (Render版)');
        if (!this.gameData) {
            console.warn('⚠️ ゲームデータが存在しません');
            return;
        }

        UIManager.updatePlayersList(this.gameData.players, this.gameData.host);

        if (this.gameData.gameState === 'waiting') {
            this.updateLobbyUI();
        }
        // 他の状態は後で実装
    }

    updateLobbyUI() {
        console.log('🏠 ロビーUI更新 (Render版)');
        UIManager.showScreen('room-info');
        
        const startButton = safeGetElement('start-game');
        const count = this.gameData.players.filter(p => p.connected).length;
        
        if (this.isHost && count >= 3 && startButton) {
            startButton.style.display = 'block';
        } else if (startButton) {
            startButton.style.display = 'none';
        }
    }
}

// グローバルに公開
window.UIManager = UIManager;
window.SocketClient = SocketClient;
window.PigManGame = PigManGame;

// Render環境用のグローバル関数
window.forceReconnect = () => {
    if (window.pigGame && window.pigGame.socketClient) {
        window.pigGame.socketClient.forceReconnect();
        UIManager.showError('手動再接続を実行中...', 'warning');
    }
};

window.testConnection = () => {
    console.log('=== 接続テスト ===');
    if (window.pigGame && window.pigGame.socketClient) {
        console.log('Socket状態:', window.pigGame.socketClient.socket.connected);
        console.log('Socket ID:', window.pigGame.socketClient.socket.id);
        window.pigGame.socketClient.getRoomList();
    }
};

// DOM読み込み完了後の初期化 (Render最適化)
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM読み込み完了 (Render版)');
    
    // Render環境の警告表示
    if (isRenderEnvironment) {
        console.log('⚠️ Render環境で動作中 - 接続に時間がかかる場合があります');
    }
    
    // 必須要素の存在確認
    const requiredElements = [
        'lobby', 'room-info', 'error-message', 
        'create-room', 'player-name-create', 'connection-status'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('❌ 必須要素が不足:', missingElements);
        alert('ページの読み込みに問題があります。\n不足要素: ' + missingElements.join(', '));
        return;
    }
    
    console.log('✅ 必須要素確認完了 (Render版)');
    
    // Socket.io の存在確認
    if (typeof io === 'undefined') {
        console.error('❌ Socket.io が読み込まれていません');
        alert('Socket.io ライブラリが読み込まれていません。インターネット接続を確認してください。');
        return;
    }
    
    console.log('✅ Socket.io ライブラリ確認完了 (Render版)');
    
    try {
        // ゲームインスタンス作成
        const pigGame = new PigManGame();
        window.pigGame = pigGame;
        
        console.log('✅ 豚小屋探検隊ゲーム初期化成功！ (Render版)');
        
        if (isRenderEnvironment) {
            UIManager.showError('🐷 Render環境で豚小屋探検隊が起動しました！接続に時間がかかる場合があります。', 'warning');
        } else {
            UIManager.showError('🐷 豚小屋探検隊へようこそ！', 'success');
        }
        
        // デバッグ情報をコンソールに出力 (Render環境では長めに待つ)
        setTimeout(() => {
            window.debugInfo();
            console.log('コンソールで使用可能なコマンド:');
            console.log('- debugInfo() : デバッグ情報表示');
            console.log('- forceReconnect() : 手動再接続');
            console.log('- testConnection() : 接続テスト');
        }, isRenderEnvironment ? 5000 : 2000);
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        UIManager.showError('ゲームの初期化に失敗しました: ' + error.message);
    }
});

// エラーハンドリング (Render強化版)
window.addEventListener('error', function(event) {
    console.error('JavaScript エラー:', event.error);
    UIManager.showError('予期しないエラーが発生しました');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promise エラー:', event.reason);
    UIManager.showError('通信エラーが発生しました');
});

// Render環境でのページ可視性変更の監視
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && window.pigGame) {
        console.log('ページが再表示されました - 接続状態確認');
        setTimeout(() => {
            if (window.pigGame.socketClient && !window.pigGame.socketClient.isConnected()) {
                console.log('再表示時に切断されていたため再接続を試行');
                window.pigGame.socketClient.forceReconnect();
            }
        }, 1000);
    }
});

console.log('🐷 豚小屋探検隊 JavaScript 読み込み完了 (Render最適化版)');
