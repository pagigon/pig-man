// メインゲームクラス

console.log('🎮 Game-Main.js 読み込み開始');

class TreasureTempleGame {
    constructor() {
        // ゲーム状態
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.mySocketId = null;
        this.myName = null;
        this.isSpectator = false;
        
        // Socket通信クライアント
        this.socketClient = new SocketClient(this);
        
        // 初期化
        this.initializeEventListeners();
        this.initializeEnhancedFeatures();
        this.attemptReconnection();
        
        console.log('✅ TreasureTempleGame初期化完了');
    }

    // ======================
    // 初期化関連
    // ======================
    
    initializeEventListeners() {
        console.log('🎛️ イベントリスナー初期化開始');

        // パスワード表示切り替え
        Utils.safeAddEventListener('use-password', 'change', (e) => {
            const passwordGroup = Utils.safeGetElement('password-group');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // ルーム操作
        Utils.safeAddEventListener('create-room', 'click', () => this.createRoom());
        Utils.safeAddEventListener('join-room', 'click', () => this.joinRoom());
        Utils.safeAddEventListener('rejoin-room', 'click', () => this.rejoinRoom());
        Utils.safeAddEventListener('spectate-room', 'click', () => this.spectateRoom());
        Utils.safeAddEventListener('leave-room', 'click', () => this.leaveRoom());
        Utils.safeAddEventListener('temp-leave-room', 'click', () => this.tempLeaveRoom());
        Utils.safeAddEventListener('cancel-temp-leave', 'click', () => this.cancelTempLeave());
        Utils.safeAddEventListener('game-leave-room', 'click', () => this.showTempLeaveDialog());
        Utils.safeAddEventListener('start-game', 'click', () => this.startGame());
        Utils.safeAddEventListener('return-to-lobby-victory', 'click', () => this.returnToLobby());

        // Enterキーでの操作
        this.setupEnterKeyHandlers();

        console.log('✅ イベントリスナー初期化完了');
    }

    setupEnterKeyHandlers() {
        // ルーム作成
        const createNameInput = Utils.safeGetElement('player-name-create');
        const roomPasswordInput = Utils.safeGetElement('room-password');
        
        [createNameInput, roomPasswordInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.createRoom();
                });
            }
        });

        // ルーム参加
        const joinNameInput = Utils.safeGetElement('player-name-join');
        const roomIdInput = Utils.safeGetElement('room-id-input');
        const joinPasswordInput = Utils.safeGetElement('join-password');
        
        [joinNameInput, roomIdInput, joinPasswordInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.joinRoom();
                });
            }
        });

        // 再入場
        const rejoinNameInput = Utils.safeGetElement('rejoin-player-name');
        const rejoinRoomInput = Utils.safeGetElement('rejoin-room-id');
        
        [rejoinNameInput, rejoinRoomInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.rejoinRoom();
                });
            }
        });

        // 観戦
        const spectatorNameInput = Utils.safeGetElement('spectator-name');
        const spectateRoomInput = Utils.safeGetElement('spectate-room-id');
        
        [spectatorNameInput, spectateRoomInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.spectateRoom();
                });
            }
        });
    }

    initializeEnhancedFeatures() {
        console.log('⚡ 拡張機能初期化開始');

        // クイック参加機能
        Utils.safeAddEventListener('quick-join', 'click', () => this.quickJoinRoom());
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // オンライン状態の監視
        window.addEventListener('online', () => {
            UIManager.showToast('インターネット接続が復旧しました', 'success');
            if (this.socketClient && !this.socketClient.isConnected()) {
                setTimeout(() => {
                    this.socketClient.manualReconnect();
                }, 1000);
            }
        });
        
        window.addEventListener('offline', () => {
            UIManager.showToast('インターネット接続が切断されました', 'warning');
        });

        // ページの可視性変更監視
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.socketClient && !this.socketClient.isConnected()) {
                UIManager.showToast('接続を確認中...', 'info');
                setTimeout(() => {
                    if (!this.socketClient.isConnected()) {
                        this.socketClient.manualReconnect();
                    }
                }, 2000);
            }
        });

        console.log('✅ 拡張機能初期化完了');
    }

    attemptReconnection() {
        try {
            // 再入場情報をチェック
            const rejoinInfo = Utils.storage.get('pigGameRejoinInfo');
            if (rejoinInfo) {
                console.log('💾 保存された再入場情報:', rejoinInfo);
                
                // 24時間以内の情報のみ有効
                if (Date.now() - rejoinInfo.timestamp < 24 * 60 * 60 * 1000) {
                    this.populateRejoinInfo(rejoinInfo);
                    UIManager.showToast('前回のゲームへの再入場情報が見つかりました', 'warning');
                } else {
                    Utils.storage.remove('pigGameRejoinInfo');
                }
                return;
            }

            // 通常の再接続情報をチェック
            const savedPlayerInfo = Utils.storage.get('pigGamePlayerInfo');
            if (savedPlayerInfo) {
                console.log('💾 保存された情報で再接続を試行:', savedPlayerInfo);
                
                this.myName = savedPlayerInfo.playerName;
                this.isHost = savedPlayerInfo.isHost;
                UIManager.showPlayerName(this.myName);
                
                // Socket接続完了を待ってから再接続
                setTimeout(() => {
                    if (this.socketClient && this.socketClient.isConnected()) {
                        this.socketClient.reconnectToRoom(savedPlayerInfo.roomId, savedPlayerInfo.playerName);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('再接続情報の読み込みエラー:', error);
            Utils.storage.remove('pigGamePlayerInfo');
            Utils.storage.remove('pigGameRejoinInfo');
        }
    }

    // ======================
    // キーボードショートカット
    // ======================
    
    handleKeyboardShortcuts(e) {
        // モーダルが開いている場合はショートカットを無効化
        const modal = Utils.safeGetElement('confirm-modal');
        if (modal && modal.style.display === 'flex') {
            return;
        }

        // Ctrl/Cmd + Enter でルーム作成
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const currentScreen = this.getCurrentScreen();
            if (currentScreen === 'lobby') {
                this.createRoom();
            }
        }
        
        // F5でページリロード確認
        if (e.key === 'F5') {
            if (this.roomId && this.gameData?.gameState === 'playing') {
                e.preventDefault();
                UIManager.showToast('ゲーム中のリロードは推奨されません', 'warning');
            }
        }

        // Escapeキーでモーダルを閉じる
        if (e.key === 'Escape') {
            if (modal && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        }
    }

    getCurrentScreen() {
        const screens = ['lobby', 'room-info', 'game-board', 'victory-screen'];
        for (const screenName of screens) {
            const screen = Utils.safeGetElement(screenName);
            if (screen && screen.style.display !== 'none') {
                return screenName;
            }
        }
        return 'lobby';
    }

    // ======================
    // ルーム操作
    // ======================

    async createRoom() {
        console.log('🏠 ルーム作成開始');

        // 入力値取得と検証
        const nameInput = Utils.safeGetElement('player-name-create');
        const playerName = nameInput ? nameInput.value.trim() : '';
        
        // プレイヤー名検証
        const nameValidation = Utils.validators.playerName(playerName);
        if (!nameValidation.isValid && playerName) {
            UIManager.showToast(nameValidation.message, 'error');
            return;
        }

        const hasPassword = Utils.safeGetElement('use-password')?.checked || false;
        const password = hasPassword ? (Utils.safeGetElement('room-password')?.value || '') : '';

        // パスワード検証
        if (hasPassword) {
            const passwordValidation = Utils.validators.password(password, true);
            if (!passwordValidation.isValid) {
                UIManager.showToast(passwordValidation.message, 'error');
                return;
            }
        }

        // 確認ダイアログ
        const finalPlayerName = playerName || Utils.generateRandomPlayerName();
        const confirmed = await UIManager.showConfirm(
            'ルーム作成',
            `プレイヤー名: ${finalPlayerName}\n${hasPassword ? 'パスワード付き' : 'パスワードなし'}\n\nルームを作成しますか？`
        );
        
        if (!confirmed) return;
        
        // UI更新
        UIManager.showLoading(true);
        UIManager.showProgress(0);
        
        try {
            this.myName = finalPlayerName;
            UIManager.showPlayerName(this.myName);
            
            // プログレス更新
            UIManager.showProgress(30);
            
            // ルーム作成実行
            const success = this.socketClient.createRoom(finalPlayerName, hasPassword, password);
            
            if (success) {
                UIManager.showToast('ルームを作成中...', 'info');
                UIManager.showProgress(60);
            } else {
                throw new Error('ルーム作成に失敗しました');
            }
            
        } catch (error) {
            console.error('ルーム作成エラー:', error);
            UIManager.showToast('ルーム作成に失敗しました', 'error');
            UIManager.showLoading(false);
            UIManager.showProgress(0);
        }
    }

    async joinRoom() {
        console.log('🚪 ルーム参加開始');
        
        // 入力値取得
        const nameInput = Utils.safeGetElement('player-name-join');
        const roomInput = Utils.safeGetElement('room-id-input');
        const passwordInput = Utils.safeGetElement('join-password');
        
        const playerName = nameInput ? nameInput.value.trim() : '';
        const roomId = roomInput ? roomInput.value.trim().toUpperCase() : '';
        const password = passwordInput ? passwordInput.value : '';

        // 入力値検証
        const roomIdValidation = Utils.validators.roomId(roomId);
        if (!roomIdValidation.isValid) {
            UIManager.showToast(roomIdValidation.message, 'error');
            return;
        }

        const nameValidation = Utils.validators.playerName(playerName);
        if (!nameValidation.isValid && playerName) {
            UIManager.showToast(nameValidation.message, 'error');
            return;
        }

        // 確認ダイアログ
        const finalPlayerName = playerName || Utils.generateRandomPlayerName();
        const confirmed = await UIManager.showConfirm(
            'ルーム参加',
            `ルーム ${roomId} に参加しますか？\nプレイヤー名: ${finalPlayerName}`
        );

        if (!confirmed) return;

        // UI更新
        UIManager.showLoading(true);
        UIManager.showProgress(0);
        
        try {
            this.myName = finalPlayerName;
            UIManager.showPlayerName(this.myName);
            this.roomId = roomId;
            
            UIManager.showProgress(50);
            
            // ルーム参加実行
            const success = this.socketClient.joinRoom(roomId, finalPlayerName, password);
            
            if (success) {
                UIManager.showToast('ルームに参加中...', 'info');
            } else {
                throw new Error('ルーム参加に失敗しました');
            }
            
        } catch (error) {
            console.error('ルーム参加エラー:', error);
            UIManager.showToast('ルーム参加に失敗しました', 'error');
            UIManager.showLoading(false);
            UIManager.showProgress(0);
        }
    }

    rejoinRoom() {
        console.log('🔄 再入場開始');
        
        const nameInput = Utils.safeGetElement('rejoin-player-name');
        const roomInput = Utils.safeGetElement('rejoin-room-id');
        
        const playerName = nameInput ? nameInput.value.trim() : '';
        const roomId = roomInput ? roomInput.value.trim().toUpperCase() : '';

        // 入力値検証
        const nameValidation = Utils.validators.playerName(playerName);
        if (!nameValidation.isValid) {
            UIManager.showToast(nameValidation.message, 'error');
            return;
        }

        const roomIdValidation = Utils.validators.roomId(roomId);
        if (!roomIdValidation.isValid) {
            UIManager.showToast(roomIdValidation.message, 'error');
            return;
        }

        this.myName = playerName;
        UIManager.showPlayerName(this.myName);
        this.roomId = roomId;
        
        UIManager.showLoading(true);
        
        const success = this.socketClient.rejoinRoom(roomId, playerName);
        if (success) {
            UIManager.showToast('再入場を試行中...', 'info');
        } else {
            UIManager.showLoading(false);
        }
    }

    spectateRoom() {
        console.log('👁️ 観戦開始');
        
        const nameInput = Utils.safeGetElement('spectator-name');
        const roomInput = Utils.safeGetElement('spectate-room-id');
        
        const spectatorName = nameInput ? nameInput.value.trim() : '';
        const roomId = roomInput ? roomInput.value.trim().toUpperCase() : '';

        // ルームID検証
        const roomIdValidation = Utils.validators.roomId(roomId);
        if (!roomIdValidation.isValid) {
            UIManager.showToast(roomIdValidation.message, 'error');
            return;
        }

        const finalSpectatorName = spectatorName || `観戦者${Math.floor(Math.random() * 1000)}`;

        this.myName = finalSpectatorName;
        this.isSpectator = true;
        UIManager.showPlayerName(this.myName + ' (観戦)');
        this.roomId = roomId;
        
        UIManager.showLoading(true);
        
        const success = this.socketClient.spectateRoom(roomId, finalSpectatorName);
        if (success) {
            UIManager.showToast('観戦を開始中...', 'info');
        } else {
            UIManager.showLoading(false);
        }
    }

    quickJoinRoom() {
        console.log('🎲 クイック参加');
        
        const playerName = Utils.generateRandomPlayerName();
        UIManager.showToast(`${playerName} として参加を試行中...`, 'info');
        
        // TODO: 利用可能なルーム一覧を取得してランダム参加
        // 現在は開発中メッセージを表示
        setTimeout(() => {
            UIManager.showToast('現在参加可能なルームがありません', 'warning');
        }, 2000);
    }

    // ======================
    // ゲーム操作
    // ======================

    async startGame() {
        console.log('🚀 ゲーム開始');
        
        if (this.isSpectator) {
            UIManager.showToast('観戦者はゲームを開始できません', 'error');
            return;
        }

        if (!this.gameData || !this.gameData.players) {
            UIManager.showToast('ゲームデータが不正です', 'error');
            return;
        }

        const playerCount = this.gameData.players.filter(p => p.connected).length;
        if (playerCount < 3) {
            UIManager.showToast('ゲーム開始には3人以上必要です', 'error');
            return;
        }

        const confirmed = await UIManager.showConfirm(
            'ゲーム開始',
            `${playerCount}人でゲームを開始しますか？\n開始後はプレイヤーの参加ができなくなります。`
        );
        
        if (!confirmed) return;
        
        UIManager.showProgress(0);
        UIManager.showLoading(true);
        
        // プログレスバーアニメーション
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            UIManager.showProgress(progress);
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                UIManager.showLoading(false);
            }
        }, 100);
        
        // ゲーム開始実行
        const success = this.socketClient.startGame();
        if (!success) {
            clearInterval(progressInterval);
            UIManager.showLoading(false);
            UIManager.showProgress(0);
            UIManager.showToast('ゲーム開始に失敗しました', 'error');
        }
    }

    selectCard(targetPlayerId, cardIndex) {
        console.log('🃏 カード選択:', { targetPlayerId, cardIndex });
        
        if (this.isSpectator) {
            UIManager.showToast('観戦者はカードを選択できません', 'error');
            return;
        }
        
        const success = this.socketClient.selectCard(targetPlayerId, cardIndex);
        if (success) {
            UIManager.showToast('カードを選択しました', 'info', 1000);
        }
    }

    sendChat() {
        const input = Utils.safeGetElement('chat-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        if (!message || !this.roomId) return;
        
        const success = this.socketClient.sendChat(message);
        if (success) {
            input.value = '';
        }
    }

    // ======================
    // ルーム退出・一時退出
    // ======================

    showTempLeaveDialog() {
        if (this.gameData && this.gameData.gameState === 'playing') {
            const tempLeaveSection = Utils.safeGetElement('temp-leave-section');
            if (tempLeaveSection) {
                tempLeaveSection.style.display = 'block';
            }
            UIManager.showScreen('room-info');
            const roomIdDisplay = Utils.safeGetElement('room-id-display');
            if (roomIdDisplay && this.roomId) {
                roomIdDisplay.textContent = this.roomId;
            }
        } else {
            this.leaveRoom();
        }
    }

    cancelTempLeave() {
        const tempLeaveSection = Utils.safeGetElement('temp-leave-section');
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
        if (this.gameData && this.gameData.gameState === 'playing') {
            UIManager.showScreen('game-board');
        }
    }

    tempLeaveRoom() {
        console.log('⏸️ 一時退出');
        
        // 退出前に再入場用の情報を保存
        const rejoinInfo = {
            roomId: this.roomId,
            playerName: this.myName,
            tempLeft: true,
            timestamp: Date.now()
        };
        
        Utils.storage.set('pigGameRejoinInfo', rejoinInfo);

        // 一時退出をサーバーに通知
        this.socketClient.tempLeaveRoom();
        
        // UI状態をリセット
        this.resetGameState();
        
        // 再入場情報をUIに反映
        this.populateRejoinInfo(rejoinInfo);
        
        UIManager.showToast('一時退出しました。同じプレイヤー名とルームIDで再入場できます。', 'warning');
    }

    async leaveRoom() {
        console.log('🚪 ルーム退出');
        
        let message = 'ルームから退出しますか？';
        
        if (this.gameData && this.gameData.gameState === 'playing') {
            message = 'ゲーム中です。本当に退出しますか？\n（再入場は可能です）';
        }

        const confirmed = await UIManager.showConfirm('ルーム退出', message);
        
        if (!confirmed) return;

        this.socketClient.leaveRoom();
        this.resetGameState();
        
        UIManager.showScreen('lobby');
        UIManager.showGameRoomId(null);
        UIManager.showToast('ルームから退出しました', 'info');
        UIManager.showQuickJoinButton(false);
    }

    returnToLobby() {
        this.leaveRoom();
    }

    resetGameState() {
        this.roomId = null;
        this.gameData = null;
        this.isHost = false;
        this.isSpectator = false;
        
        // プレイヤー情報を削除
        Utils.storage.remove('pigGamePlayerInfo');
        
        // 観戦モードを無効化
        UIManager.showSpectatorMode(false);
    }

    // ======================
    // サーバーからのイベント処理
    // ======================

    onRoomCreated(data) {
        console.log('🏠 ルーム作成成功:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = true;
        
        // プレイヤー情報を保存
        this.savePlayerInfo(data.playerInfo);
        
        UIManager.showLoading(false);
        UIManager.showProgress(100);
        this.showRoomInfo();
        UIManager.showToast(`ルーム ${data.roomId} が作成されました！`, 'success');
        UIManager.showQuickJoinButton(true);
    }

    onJoinSuccess(data) {
        console.log('🚪 ルーム参加成功:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.playerInfo ? data.playerInfo.isHost : false;
        
        // プレイヤー情報を保存
        this.savePlayerInfo(data.playerInfo);
        
        UIManager.showLoading(false);
        UIManager.showProgress(100);
        this.updateUI();
        UIManager.showToast(`ルーム ${data.roomId} に参加しました！`, 'success');
        UIManager.showQuickJoinButton(true);
    }

    onRejoinSuccess(data) {
        console.log('🔄 再入場成功:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        // 再入場情報を削除
        Utils.storage.remove('pigGameRejoinInfo');
        
        UIManager.showLoading(false);
        UIManager.showToast('ゲームに再入場しました！', 'success');
        this.updateUI();
    }

    onSpectateSuccess(data) {
        console.log('👁️ 観戦開始成功:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isSpectator = true;
        
        UIManager.showLoading(false);
        UIManager.showSpectatorMode(true);
        this.updateUI();
        UIManager.showToast('観戦を開始しました', 'success');
    }

    onReconnectSuccess(data) {
        console.log('🔌 再接続成功:', data);
        
        this.roomId = data.roomId;
        this.gameData = data.gameData;
        this.isHost = data.isHost;
        
        UIManager.showToast('ゲームに再接続しました！', 'success');
        this.updateUI();
    }

    // ======================
    // UI更新
    // ======================

    showRoomInfo() {
        UIManager.showScreen('room-info');
        const roomIdDisplay = Utils.safeGetElement('room-id-display');
        if (roomIdDisplay && this.roomId) {
            roomIdDisplay.textContent = this.roomId;
        }
    }

    updateUI() {
        if (!this.gameData) return;

        console.log('🖼️ UI更新:', this.gameData.gameState);

        // 財宝目標をUIに反映
        Utils.safeSetText('treasure-goal', this.gameData.treasureGoal || 7);

        // プレイヤーリスト更新
        if (this.gameData.players) {
            UIManager.updatePlayersList(this.gameData.players, this.gameData.host);
        }

        // ゲーム状態に応じて画面切り替え
        switch (this.gameData.gameState) {
            case 'waiting':
                this.updateLobbyUI();
                break;
            case 'playing':
                this.updateGameUI();
                break;
            case 'finished':
                this.showVictoryScreen();
                break;
        }
    }

    updateLobbyUI() {
        UIManager.showScreen('room-info');
        
        const startButton = Utils.safeGetElement('start-game');
        const tempLeaveSection = Utils.safeGetElement('temp-leave-section');
        
        if (this.gameData && this.gameData.players) {
            const count = this.gameData.players.filter(p => p.connected).length;
            if (this.isHost && count >= 3 && startButton) {
                startButton.style.display = 'block';
                startButton.textContent = `ゲーム開始 (${count}人)`;
            } else if (startButton) {
                startButton.style.display = 'none';
            }
        }
        
        if (tempLeaveSection) {
            tempLeaveSection.style.display = 'none';
        }
    }

    updateGameUI() {
        UIManager.showScreen('game-board');
        
        // ゲーム概要更新
        UIManager.updateGameOverview(this.gameData.players.length);
        
        // 進捗バー更新
        UIManager.updateProgressBars(this.gameData);
        
        // ゲーム情報更新
        UIManager.updateGameInfo(this.gameData);

        // 鍵保持者情報
        const keyHolder = this.gameData.players ? this.gameData.players.find(p => p.id === this.gameData.keyHolderId) : null;
        Utils.safeSetText('key-holder-name', keyHolder ? keyHolder.name : '不明');
        
        const isMyTurn = this.gameData.keyHolderId === this.mySocketId;
        Utils.safeSetText('turn-message', isMyTurn ? 'あなたのターンです！他のプレイヤーのカードを選んでください' : '待機中...');

        // 役職・カード表示
        this.showPlayerRole();
        this.renderMyCards();
        this.renderOtherPlayers(isMyTurn);
    }

    showPlayerRole() {
        // TODO: 役職表示の実装
        console.log('👤 役職表示（実装予定）');
    }

    renderMyCards() {
        // TODO: 自分のカード表示の実装
        console.log('🃏 自分のカード表示（実装予定）');
    }

    renderOtherPlayers(isMyTurn) {
        // TODO: 他プレイヤーのカード表示の実装
        console.log('👥 他プレイヤー表示（実装予定）', { isMyTurn });
    }

    showVictoryScreen() {
        UIManager.showVictoryScreen
