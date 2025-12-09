// 統計情報の取得
async function loadStats() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
      if (response?.patterns) {
        const fieldCount = Object.keys(response.patterns).length;
        const sites = new Set();
        
        Object.values(response.patterns).forEach(typeData => {
          Object.keys(typeData).forEach(domain => sites.add(domain));
        });
        
        document.getElementById('fieldCount').textContent = fieldCount;
        document.getElementById('siteCount').textContent = sites.size;
      }
    });
  }
  
  // データ表示
  document.getElementById('viewData').addEventListener('click', async () => {
    const data = await chrome.storage.local.get('learnedPatterns');
    console.log('保存されたデータ:', data);
    alert('データはコンソールに出力されました（F12で確認）');
  });
  
  // データ削除
  document.getElementById('clearData').addEventListener('click', async () => {
    if (confirm('本当に全てのデータを削除しますか？\nこの操作は取り消せません。')) {
      await chrome.storage.local.clear();
      alert('全データを削除しました');
      loadStats();
    }
  });
  
  // 初期化
  loadStats();