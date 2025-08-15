// public/js/components/chat.js - 修正版（sendChatMessage対応）

import { safeGetElement } from '../utils/helpers.js';

export class Chat {
    constructor(game) {
        this.game = game;
        this.setupChatEvents();
    }

    setupChatEvents() {
        const sendButton = safeGetElement('send-chat');
        const chatInput = safeGetElement('chat-input');

        if (sendButton) {
            sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendChat();
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChat();
                }
            });
        }
    }

    sendChat() {
        try {
            const input = safeGetElement('chat-input');
            if (!input) {
                console.warn('⚠️ チャット入力欄が見つかりません');
                return;
            }
            
            const message = input.value.trim();
            
            if (!message) {
                console.log('📝 空のメッセージは送信しません');
                return;
            }
            
            if (!this.game.roomId) {
                console.warn('⚠️ ルームに参加していません');
                return;
            }
            
            // 🔧 【修正】正しいメソッド名を使用
            if (this.game.socketClient && typeof this.game.socketClient.sendChatMessage === 'function') {
                const success = this.game.socketClient.sendChatMessage(message);
                if (success) {
                    input.value = '';
                    console.log('✅ チャットメッセージ送信:', message);
                } else {
                    console.warn('⚠️ チャットメッセージ送信失敗');
                }
            } else {
                console.error('❌ sendChatMessage メソッドが存在しません');
                console.log('利用可能なメソッド:', Object.getOwnPropertyNames(this.game.socketClient));
            }
            
        } catch (error) {
            console.error('❌ チャット送信エラー:', error);
        }
    }
}
