/**
 * NETWORK MANAGER - Handle network errors gracefully
 * Fixes:
 * - Clear error messages untuk network issues
 * - Offline/Online state management
 * - Automatic retry logic
 * - Connection status indicator
 */

class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.retryQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.isOnline = true;
    console.log('🌐 Online - Attempting to sync pending data');
    this.notifyListeners('online');
    this.processPendingQueue();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('📵 Offline - Data akan disimpan lokal');
    this.notifyListeners('offline');
  }

  /**
   * SUBSCRIBE TO CONNECTION CHANGES
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * GET CONNECTION STATUS
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isOffline: !this.isOnline,
      message: this.isOnline ? '🟢 Online' : '🔴 Offline',
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * FETCH WITH AUTO-RETRY
   */
  async fetchWithRetry(url, options = {}, retryCount = 0) {
    try {
      if (!this.isOnline) {
        throw new Error('Device offline - data akan disimpan lokal');
      }

      const response = await fetch(url, {
        ...options,
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      if (retryCount < this.maxRetries && this.isOnline) {
        console.warn(`⚠️ Retry ${retryCount + 1}/${this.maxRetries}:`, error.message);
        await this.sleep(this.retryDelay);
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      return {
        success: false,
        error: this.getHumanReadableError(error),
        originalError: error.message,
      };
    }
  }

  /**
   * ADD TO RETRY QUEUE
   */
  queueForRetry(request) {
    this.retryQueue.push({
      ...request,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
    console.log('📋 Request ditambah ke queue. Total pending:', this.retryQueue.length);
  }

  /**
   * PROCESS PENDING QUEUE
   */
  async processPendingQueue() {
    if (this.retryQueue.length === 0) return;

    console.log('🔄 Processing', this.retryQueue.length, 'pending requests');
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const request of queue) {
      const result = await this.fetchWithRetry(request.url, request.options);
      if (!result.success) {
        if (request.attempts < this.maxRetries) {
          request.attempts++;
          this.retryQueue.push(request);
        }
      } else if (request.callback) {
        request.callback(result.data);
      }
    }
  }

  /**
   * HUMAN READABLE ERROR MESSAGES
   */
  getHumanReadableError(error) {
    const message = error.message || '';

    if (message.includes('offline') || message.includes('Offline')) {
      return '📵 Device offline - Data disimpan lokal, akan sync otomatis saat online';
    }
    if (message.includes('timeout') || message.includes('Timeout')) {
      return '⏱️ Permintaan timeout - Jaringan lambat, coba lagi nanti';
    }
    if (message.includes('ERR_CONNECTION_REFUSED')) {
      return '🚫 Server tidak merespons - Periksa cloud URL di Settings';
    }
    if (message.includes('ERR_NAME_NOT_RESOLVED')) {
      return '❌ DNS error - Periksa koneksi internet Anda';
    }
    if (message.includes('HTTP 404')) {
      return '🔍 Cloud URL tidak ditemukan - Periksa URL di Settings';
    }
    if (message.includes('HTTP 500')) {
      return '⚠️ Server error - Tim teknis sedang memperbaiki';
    }
    if (message.includes('HTTP 403')) {
      return '🔒 Akses ditolak - Periksa permissions cloud';
    }
    return '❌ Gagal: ' + message;
  }

  /**
   * CHECK SPECIFIC URL
   */
  async checkConnection(url) {
    try {
      const start = Date.now();
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      const latency = Date.now() - start;
      
      return {
        success: true,
        latency: latency + 'ms',
        status: response.status,
        message: `✅ Terhubung (latency: ${latency}ms)`,
      };
    } catch (error) {
      return {
        success: false,
        message: this.getHumanReadableError(error),
        error: error.message,
      };
    }
  }

  /**
   * UTILITY: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET PENDING QUEUE COUNT
   */
  getPendingCount() {
    return this.retryQueue.length;
  }
}

window.networkManager = new NetworkManager();