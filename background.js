// Service Worker用の設定
chrome.runtime.onInstalled.addListener(() => {
    console.log('Smart Form Autofill installed');
    
    // 初期設定
    chrome.storage.local.set({
      enabled: true,
      securityLevel: 'high',
      lastCleanup: Date.now()
    });
    
    // アラームの設定（1日に1回クリーンアップ）
    chrome.alarms.create('cleanup', { 
      delayInMinutes: 1,
      periodInMinutes: 1440 
    });
  });
  
  // アラームリスナー
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
      try {
        const data = await chrome.storage.local.get('lastCleanup');
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (!data.lastCleanup || now - data.lastCleanup > thirtyDays) {
          console.log('データクリーンアップ実行');
          await chrome.storage.local.set({ lastCleanup: now });
        }
      } catch (error) {
        console.error('クリーンアップエラー:', error);
      }
    }
  });
  
  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
      chrome.storage.local.get(['enabled', 'securityLevel'], (data) => {
        sendResponse(data);
      });
      return true; // 非同期レスポンスを示す
    }
  });