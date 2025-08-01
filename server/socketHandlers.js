// 簡易ルーム管理
const activeRooms = new Map();

function setupSocketHandlers(io) {
    console.log('🚀 Socket.io ハンドラー設定開始（修正版）');
    
    io.on('connection', (socket) => {
        console.log('✅ 新しい接続確認:', socket.id);
        
        // 接続直後にルーム一覧を送信
        const roomList = Array.from(activeRooms.values()).map(room => ({
            id: room.id,
            hostName: room.hostName,
            playerCount: room.players.length,
            hasPassword: false
        }));
        socket.emit('roomList', roomList);
        
        // ルーム一覧要求
        socket.on('getRoomList', () => {
            console.log('📋 ルーム一覧要求受信:', socket.id);
            const roomList = Array.from(activeRooms.values()).map(room => ({
                id: room.id,
                hostName: room.hostName,
                playerCount: room.players.length,
                hasPassword: false
            }));
            socket.emit('roomList', roomList);
        });
        
        // ルーム作成
        socket.on('createRoom', (data) => {
            console.log('🏠 ===== ルーム作成要求受信 =====');
            console.log('Socket ID:', socket.id);
            console.log('データ:', JSON.stringify(data, null, 2));
            
            try {
                const roomId = 'TEST' + Date.now().toString().slice(-4);
                console.log('生成ルームID:', roomId);
                
                const gameData = {
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
                
                // ルームを保存
                activeRooms.set(roomId, {
                    id: roomId,
                    hostName: data.playerName || 'テストプレイヤー',
                    players: gameData.players,
                    gameData: gameData
                });
                
                // ソケットルーム参加
                socket.join(roomId);
                socket.roomId = roomId;
                console.log('ソケットルーム参加完了:', roomId);
                
                // 応答データ作成
                const responseData = {
                    roomId: roomId,
                    gameData: gameData,
                    playerInfo: {
                        roomId: roomId,
                        playerName: data.playerName || 'テストプレイヤー',
                        isHost: true
                    }
                };
                
                // クライアントに応答送信
                socket.emit('roomCreated', responseData);
                console.log('✅ roomCreated イベント送信完了');
                
                // 全クライアントにルーム一覧更新を送信
                const updatedRoomList = Array.from(activeRooms.values()).map(room => ({
                    id: room.id,
                    hostName: room.hostName,
                    playerCount: room.players.length,
                    hasPassword: false
                }));
                io.emit('roomList', updatedRoomList);
                console.log('📋 ルーム一覧更新送信完了, ルーム数:', updatedRoomList.length);
                
                console.log('🎉 ===== ルーム作成処理完了 =====');
                
            } catch (error) {
                console.error('❌ ===== ルーム作成エラー =====');
                console.error('エラー詳細:', error);
                socket.emit('error', { 
                    message: 'ルーム作成に失敗しました: ' + error.message 
                });
            }
        });
        
        // ルーム参加
        socket.on('joinRoom', (data) => {
            console.log('👥 ルーム参加要求:', data);
            const { roomId, playerName } = data;
            
            const room = activeRooms.get(roomId);
            if (!room) {
                socket.emit('error', { message: 'ルームが見つかりません' });
                return;
            }
            
            // プレイヤーを追加
            const newPlayer = {
                id: socket.id,
                name: playerName,
                connected: true
            };
            room.players.push(newPlayer);
            room.gameData.players.push(newPlayer);
            
            socket.join(roomId);
            socket.roomId = roomId;
            
            socket.emit('joinSuccess', {
                roomId: roomId,
                gameData: room.gameData,
                playerInfo: {
                    roomId: roomId,
                    playerName: playerName,
                    isHost: false
                }
            });
            
            // ルーム内の全員に更新を送信
            io.to(roomId).emit('gameUpdate', room.gameData);
            
            console.log(`${playerName} がルーム ${roomId} に参加`);
        });
        
        // 切断イベント
        socket.on('disconnect', (reason) => {
            console.log('🔌 切断:', socket.id, 'reason:', reason);
            
            // ルームからプレイヤーを削除
            if (socket.roomId) {
                const room = activeRooms.get(socket.roomId);
                if (room) {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    room.gameData.players = room.gameData.players.filter(p => p.id !== socket.id);
                    
                    if (room.players.length === 0) {
                        activeRooms.delete(socket.roomId);
                        console.log('空のルームを削除:', socket.roomId);
                    }
                    
                    // ルーム一覧更新
                    const updatedRoomList = Array.from(activeRooms.values()).map(room => ({
                        id: room.id,
                        hostName: room.hostName,
                        playerCount: room.players.length,
                        hasPassword: false
                    }));
                    io.emit('roomList', updatedRoomList);
                }
            }
        });
        
        console.log('🎯 イベントハンドラー登録完了:', socket.id);
    });
    
    console.log('🏁 Socket.io ハンドラー設定完了');
}

module.exports = { setupSocketHandlers };
