// 暗号化
class SecureStorage {
    constructor() {
      this.encryptionKey = null;
      this.initKey();
    }
  
    async initKey() {
      const stored = await chrome.storage.local.get('encKey');
      if (!stored.encKey) {
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const exported = await crypto.subtle.exportKey('jwk', key);
        await chrome.storage.local.set({ encKey: exported });
        this.encryptionKey = key;
      } else {
        this.encryptionKey = await crypto.subtle.importKey(
          'jwk',
          stored.encKey,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
      }
    }
  
    async encrypt(data) {
      if (!this.encryptionKey) await this.initKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(data));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encoded
      );
      return {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
      };
    }
  
    async decrypt(encrypted) {
      if (!this.encryptionKey) await this.initKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
        this.encryptionKey,
        new Uint8Array(encrypted.data)
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    }
  }
  
  const storage = new SecureStorage();
  
  // フィールド検出とタイプ分類
  class FieldDetector {
    static detectType(input) {
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const type = input.type.toLowerCase();
      const label = this.getLabel(input);
      const combined = `${name} ${id} ${placeholder} ${label}`;
  
      // パターンマッチング
      if (type === 'email' || /email|メール/.test(combined)) return 'email';
      if (/phone|tel|電話/.test(combined)) return 'phone';
      if (/zip|postal|郵便/.test(combined)) return 'zipcode';
      if (/address|住所/.test(combined)) return 'address';
      if (/city|市区町村/.test(combined)) return 'city';
      if (/state|prefecture|都道府県/.test(combined)) return 'state';
      if (/(first.*name|名|firstname)/.test(combined)) return 'firstName';
      if (/(last.*name|姓|lastname)/.test(combined)) return 'lastName';
      if (/company|会社/.test(combined)) return 'company';
      
      return 'text';
    }
  
    static getLabel(input) {
      const label = input.labels?.[0];
      if (label) return label.textContent.toLowerCase();
      
      const parent = input.closest('label');
      if (parent) return parent.textContent.toLowerCase();
      
      const prev = input.previousElementSibling;
      if (prev?.tagName === 'LABEL') return prev.textContent.toLowerCase();
      
      return '';
    }
  }
  
  // 学習システム
  class LearningSystem {
    constructor() {
      this.patterns = {};
      this.loadPatterns();
    }
  
    async loadPatterns() {
      const data = await chrome.storage.local.get('learnedPatterns');
      if (data.learnedPatterns) {
        try {
          this.patterns = await storage.decrypt(data.learnedPatterns);
        } catch (e) {
          console.error('パターン読み込みエラー:', e);
          this.patterns = {};
        }
      }
    }
  
    async learn(fieldType, value, domain) {
      if (!value || value.length < 2) return;
  
      if (!this.patterns[fieldType]) {
        this.patterns[fieldType] = {};
      }
  
      if (!this.patterns[fieldType][domain]) {
        this.patterns[fieldType][domain] = { values: [], count: {} };
      }
  
      const pattern = this.patterns[fieldType][domain];
      
      if (!pattern.count[value]) {
        pattern.count[value] = 0;
        pattern.values.push(value);
      }
      pattern.count[value]++;
  
      // 頻度順にソート
      pattern.values.sort((a, b) => 
        pattern.count[b] - pattern.count[a]
      );
  
      // 最大10件まで保存
      if (pattern.values.length > 10) {
        const removed = pattern.values.pop();
        delete pattern.count[removed];
      }
  
      await this.savePatterns();
    }
  
    async savePatterns() {
      const encrypted = await storage.encrypt(this.patterns);
      await chrome.storage.local.set({ learnedPatterns: encrypted });
    }
  
    getSuggestion(fieldType, domain) {
      const domainPattern = this.patterns[fieldType]?.[domain];
      const globalPattern = this.patterns[fieldType]?.['*'];
      
      if (domainPattern?.values.length > 0) {
        return domainPattern.values[0];
      }
      if (globalPattern?.values.length > 0) {
        return globalPattern.values[0];
      }
      return null;
    }
  }
  
  const learningSystem = new LearningSystem();
  
  // オートフィル機能
  class AutoFiller {
    constructor() {
      this.fields = new Map();
      this.setupListeners();
      this.scanFields();
    }
  
    scanFields() {
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
      
      inputs.forEach(input => {
        if (input.offsetParent === null) return; // 非表示要素は除外
        
        const fieldType = FieldDetector.detectType(input);
        this.fields.set(input, fieldType);
        
        // サジェスト表示
        this.addSuggestion(input, fieldType);
      });
    }
  
    async addSuggestion(input, fieldType) {
      const domain = window.location.hostname;
      const suggestion = learningSystem.getSuggestion(fieldType, domain);
      
      if (suggestion && !input.value) {
        input.setAttribute('data-suggestion', suggestion);
        input.style.backgroundColor = '#f0f8ff';
        
        input.addEventListener('focus', async (e) => {
          if (!e.target.value && suggestion) {
            e.target.value = suggestion;
            e.target.style.backgroundColor = '#ffffff';
          }
        }, { once: true });
      }
    }
  
    setupListeners() {
      // フォーム送信時に学習
      document.addEventListener('submit', async (e) => {
        const form = e.target;
        const domain = window.location.hostname;
        
        this.fields.forEach((fieldType, input) => {
          if (input.value && input.value.length > 0) {
            learningSystem.learn(fieldType, input.value, domain);
            learningSystem.learn(fieldType, input.value, '*'); // グローバルにも保存
          }
        });
      });
  
      // 動的に追加されるフィールドを監視
      const observer = new MutationObserver(() => {
        this.scanFields();
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  // 初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new AutoFiller();
    });
  } else {
    new AutoFiller();
  }
  
  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStats') {
      chrome.storage.local.get('learnedPatterns', async (data) => {
        if (data.learnedPatterns) {
          const patterns = await storage.decrypt(data.learnedPatterns);
          sendResponse({ patterns });
        } else {
          sendResponse({ patterns: {} });
        }
      });
      return true;
    }
  });