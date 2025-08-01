function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（最小限テスト版）');
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        console.log('接続時刻:', new Date().toISOString());
        console.log('接続元IP:', socket.handshake.address);
        console.log('User-Agent:', socket.handshake.headers['user-agent']);
        
        // 接続直後にテストメッセージを送信
        socket.emit('connectionTest', { message: 'サーバー接続成功！', socketId: socket.id });
        
        // テストイベント
        socket.on('test', (data) => {
            console.log('📨 テストイベント受信:', data);
            socket.emit('testResponse', 'サーバーからの応答: ' + data);
        });
        
        // ルーム一覧要求
        socket.on('getRoomList', () => {
            console.log('📋 ルーム一覧要求受信:', socket.id);
            socket.emit('roomList', []); // 空の配列を返す
        });
        
        // ルーム作成（超シンプル版）
        socket.on('createRoom', (data) => {
            console.log('🏠 ===== ルーム作成要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', JSON.stringify(data, null, 2));
            console.log('現在時刻:', new Date().toISOString());
            
            try {
                // 最小限のルーム作成
                const roomId = 'TEST' + Date.now().toString().slice(-4);
                console.log('生成ルームID:', roomId);
                
                const simpleGameData = {
                    id: roomId,
                    players: [{
                        id: socket.id,
                        name: data.playerName || 'テストプレイヤー',
                        connected: true
                    }],
                    gameState: 'waiting',
                    host: socket.id,
                    messages: []
                };
                
                console.log('ゲームデータ作成完了:', JSON.stringify(simpleGameData, null, 2));
                
                // ソケットルーム参加
                socket.join(roomId);
                socket.roomId = roomId;
                console.log('ソケットルーム参加完了:', roomId);
                
                // 応答データ作成
                const responseData = {
                    roomId: roomId,
                    gameData: simpleGameData,
                    playerInfo: {
                        roomId: roomId,
                        playerName: data.playerName || 'テストプレイヤー',
                        isHost: true
                    }
                };
                
                console.log('応答データ:', JSON.stringify(responseData, null, 2));
                
                // クライアントに応答送信
                socket.emit('roomCreated', responseData);
                console.log('✅ roomCreated イベント送信完了');
                
                // 全クライアントにルーム一覧更新を送信
                io.emit('roomList', []);
                console.log('📋 ルーム一覧更新送信完了');
                
                console.log('🎉 ===== ルーム作成処理完了 =====');
                
            } catch (error) {
                console.error('❌ ===== ルーム作成エラー =====');
                console.error('エラー詳細:', error);
                console.error('スタックトレース:', error.stack);
                
                socket.emit('error', { 
                    message: 'ルーム作成に失敗しました: ' + error.message 
                });
                console.log('❌ エラー応答送信完了');
            }
        });
        
        // 切断イベント
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了');
}

module.exports = { setupSocketHandlers };
