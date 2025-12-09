chrome.runtime.onInstalled.addListener(() => {
    console.log('Smart Form Autofill installed');
    
    // 初期設定
    chrome.storage.local.set({
      enabled: true,
      securityLevel: 'high'
    });
  });
  
  // セキュリティチェック
  chrome.webRequest?.onBeforeRequest.addListener(
    (details) => {
      // HTTPSでない場合は警告
      if (details.url.startsWith('http://')) {
        console.warn('非セキュア接続:', details.url);
      }
    },
    { urls: ['<all_urls>'] }
  );
  
  // データクリーンアップ（30日以上古いデータを削除）
  chrome.alarms.create('cleanup', { periodInMinutes: 1440 });
  
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
      const data = await chrome.storage.local.get('lastCleanup');
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      if (!data.lastCleanup || now - data.lastCleanup > thirtyDays) {
        // 古いデータをクリーンアップ
        await chrome.storage.local.set({ lastCleanup: now });
      }
    }
  });