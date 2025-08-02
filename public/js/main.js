// メインエントリーポイント
import { PigManGame } from './core/game.js';

console.log('🐷 豚小屋探検隊 JavaScript 開始');

// 折りたたみ機能
window.toggleSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    const button = section.previousElementSibling;
    const icon = button.querySelector('.toggle-icon');
    
    section.classList.toggle('collapsed');
    icon.textContent = section.classList.contains('collapsed') ? '▼' : '▲';
};

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM読み込み完了 - ゲーム初期化開始');
    
    try {
        const game = new PigManGame();
        window.pigGame = game;
        console.log('✅ PigManGame インスタンス作成完了');
        
        // ルール表示切り替え
        const toggleRulesBtn = document.getElementById('toggle-rules');
        if (toggleRulesBtn) {
            toggleRulesBtn.addEventListener('click', function() {
                const rules = document.getElementById('game-rules');
                const isHidden = rules.style.display === 'none';
                rules.style.display = isHidden ? 'block' : 'none';
                this.textContent = isHidden ? 'ルールを隠す' : 'ルールを表示';
            });
        }
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        // UIManagerが使えない場合のフォールバック
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = 'ゲームの初期化に失敗しました。ページをリロードしてください。';
            errorEl.style.display = 'block';
        }
    }
});
