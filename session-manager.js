/**
 * SESSION MANAGER - Manage Sampling Session State
 * Handles auto-save, resume, and offline capability
 * 
 * Fixes:
 * - Session recovery jika device mati
 * - Track last saved item
 * - Offline progress saving
 * - Prevent data loss
 */

class SessionManager {
  constructor() {
    this.sessionKey = 'rdi_sto_session';
    this.progressKey = 'rdi_sto_progress';
    this.lastSyncKey = 'rdi_sto_last_sync';
  }

  /**
   * START NEW SESSION
   * Simpan info session baru
   */
  startSession(warehouserName, totalItems, operatorName) {
    const session = {
      id: 'session_' + Date.now(),
      warehouseName: warehouserName,
      operatorName: operatorName,
      totalItems: totalItems,
      startTime: new Date().toISOString(),
      lastActivityTime: new Date().toISOString(),
      status: 'ACTIVE', // ACTIVE, PAUSED, COMPLETED, INTERRUPTED
      itemsCompleted: 0,
      itemsRecount: 0,
      samplingData: [],
      offlineQueue: [], // Queue untuk sync ke cloud saat online
    };
    
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    this.saveLastSync(new Date());
    
    console.log('✅ Session dimulai:', session.id);
    return session;
  }

  /**
   * GET CURRENT SESSION
   * Ambil session yang sedang aktif
   */
  getCurrentSession() {
    const sessionJSON = localStorage.getItem(this.sessionKey);
    if (!sessionJSON) {
      console.warn('⚠️ Tidak ada session aktif');
      return null;
    }
    return JSON.parse(sessionJSON);
  }

  /**
   * ADD SAMPLED ITEM
   * Simpan data item yang sudah dihitung
   */
  addSampledItem(itemData) {
    const session = this.getCurrentSession();
    if (!session) {
      console.error('❌ Tidak ada session aktif!');
      return false;
    }

    // Struktur item data
    const sampledItem = {
      id: itemData.id || 'item_' + Date.now(),
      itemCode: itemData.itemCode,
      itemName: itemData.itemName,
      lokasi: itemData.lokasi,
      stokSystem: itemData.stokSystem,
      stokFisik: itemData.stokFisik,
      selisih: itemData.stokFisik - itemData.stokSystem,
      selisihPersen: ((itemData.stokFisik - itemData.stokSystem) / itemData.stokSystem * 100).toFixed(2),
      status: itemData.status, // OK, RECOUNT, SUSPICIOUS
      recountCount: itemData.recountCount || 0,
      recountHistory: itemData.recountHistory || [],
      notes: itemData.notes || '',
      timestamp: new Date().toISOString(),
      synced: false, // Flag untuk tracking sync ke cloud
    };

    session.samplingData.push(sampledItem);
    session.itemsCompleted = session.samplingData.length;
    session.lastActivityTime = new Date().toISOString();

    // Update recount count jika ada
    if (sampledItem.status === 'RECOUNT') {
      session.itemsRecount++;
    }

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    this.addToOfflineQueue(sampledItem); // Masukkan ke queue offline
    
    console.log('✅ Item #' + session.itemsCompleted + ' tersimpan:', itemData.itemCode);
    return true;
  }

  /**
   * UPDATE LAST ITEM (untuk recount/edit)
   * Perbarui data item terakhir
   */
  updateLastItem(itemData) {
    const session = this.getCurrentSession();
    if (!session || session.samplingData.length === 0) {
      return false;
    }

    const lastIndex = session.samplingData.length - 1;
    const lastItem = session.samplingData[lastIndex];

    // Update recount history
    lastItem.recountHistory.push({
      attemptNumber: lastItem.recountCount + 1,
      previousValue: lastItem.stokFisik,
      newValue: itemData.stokFisik,
      timestamp: new Date().toISOString(),
    });

    lastItem.stokFisik = itemData.stokFisik;
    lastItem.selisih = itemData.stokFisik - itemData.stokSystem;
    lastItem.selisihPersen = ((itemData.stokFisik - itemData.stokSystem) / itemData.stokSystem * 100).toFixed(2);
    lastItem.status = itemData.status;
    lastItem.recountCount++;
    lastItem.timestamp = new Date().toISOString();
    lastItem.synced = false;

    session.lastActivityTime = new Date().toISOString();
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    
    console.log('✅ Item diupdate dengan recount count:', lastItem.recountCount);
    return true;
  }

  /**
   * GET PROGRESS INFO
   * Info untuk UI progress bar dan resume
   */
  getProgress() {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      warehouseName: session.warehouseName,
      operatorName: session.operatorName,
      totalItems: session.totalItems,
      itemsCompleted: session.itemsCompleted,
      itemsRecount: session.itemsRecount,
      progressPercent: Math.round((session.itemsCompleted / session.totalItems) * 100),
      lastItemCode: session.samplingData.length > 0 ? session.samplingData[session.samplingData.length - 1].itemCode : null,
      nextItemNumber: session.itemsCompleted + 1,
      status: session.status,
      lastActivityTime: session.lastActivityTime,
      startTime: session.startTime,
      elapsedMinutes: this.getElapsedMinutes(session.startTime),
      isOnline: navigator.onLine,
      pendingSyncCount: this.getOfflineQueueCount(),
    };
  }

  /**
   * RESUME SESSION
   * Lanjut dari item terakhir
   */
  canResumeSession() {
    const session = this.getCurrentSession();
    if (!session) return false;
    if (session.status === 'COMPLETED') return false;
    if (session.itemsCompleted >= session.totalItems) return false;
    return true;
  }

  getResumeInfo() {
    const session = this.getCurrentSession();
    if (!session) return null;

    const nextItemNumber = session.itemsCompleted + 1;
    const lastItem = session.samplingData.length > 0 ? session.samplingData[session.samplingData.length - 1] : null;

    return {
      canResume: this.canResumeSession(),
      nextItemNumber: nextItemNumber,
      totalItems: session.totalItems,
      lastItemCode: lastItem?.itemCode || 'N/A',
      progress: `${session.itemsCompleted}/${session.totalItems}`,
      progressPercent: Math.round((session.itemsCompleted / session.totalItems) * 100),
      sessionAge: this.getElapsedMinutes(session.startTime) + ' menit',
    };
  }

  /**
   * PAUSE SESSION
   * Pause tanpa delete data
   */
  pauseSession() {
    const session = this.getCurrentSession();
    if (!session) return false;

    session.status = 'PAUSED';
    session.lastActivityTime = new Date().toISOString();
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    
    console.log('⏸️ Session dipause');
    return true;
  }

  /**
   * COMPLETE SESSION
   * Selesaikan dan siap untuk export
   */
  completeSession() {
    const session = this.getCurrentSession();
    if (!session) return false;

    session.status = 'COMPLETED';
    session.endTime = new Date().toISOString();
    session.lastActivityTime = new Date().toISOString();
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    
    console.log('✅ Session selesai');
    return session;
  }

  /**
   * ABANDON SESSION (tidak selesai)
   * Hapus session jika user keluar/error
   */
  abandonSession() {
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem(this.progressKey);
    console.log('🗑️ Session dihapus');
    return true;
  }

  /**
   * OFFLINE QUEUE - Simpan untuk sync nanti
   */
  addToOfflineQueue(itemData) {
    let queue = JSON.parse(localStorage.getItem(this.progressKey)) || [];
    queue.push({
      ...itemData,
      queued: true,
      queuedTime: new Date().toISOString(),
    });
    localStorage.setItem(this.progressKey, JSON.stringify(queue));
  }

  getOfflineQueue() {
    return JSON.parse(localStorage.getItem(this.progressKey)) || [];
  }

  getOfflineQueueCount() {
    return this.getOfflineQueue().length;
  }

  /**
   * SYNC DATA KE CLOUD
   * Kirim offline queue ke server
   */
  async syncToCloud(cloudUrl, sessionData) {
    if (!navigator.onLine) {
      console.warn('⚠️ Masih offline, sync ditunda');
      return { success: false, message: 'Offline - sync akan dilakukan saat online' };
    }

    const queue = this.getOfflineQueue();
    if (queue.length === 0) {
      console.log('ℹ️ Tidak ada data untuk di-sync');
      return { success: true, message: 'Semua data sudah ter-sync', synced: 0 };
    }

    try {
      const response = await fetch(cloudUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_SAMPLING_DATA',
          sessionData: sessionData,
          samplingData: queue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloud error: ${response.status}`);
      }

      const result = await response.json();

      // Clear queue jika berhasil
      localStorage.removeItem(this.progressKey);
      
      // Update session - mark items as synced
      const session = this.getCurrentSession();
      if (session) {
        session.samplingData.forEach(item => item.synced = true);
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
      }

      console.log('☁️ Sync berhasil, ' + queue.length + ' items tersimpan');
      return { 
        success: true, 
        message: `${queue.length} item(s) di-sync ke cloud`,
        synced: queue.length 
      };
    } catch (error) {
      console.error('❌ Sync error:', error);
      return { 
        success: false, 
        message: 'Gagal sync: ' + error.message,
        synced: 0 
      };
    }
  }

  /**
   * SAVE LAST SYNC TIME
   */
  saveLastSync(datetime) {
    localStorage.setItem(this.lastSyncKey, datetime.toISOString());
  }

  getLastSync() {
    const syncTime = localStorage.getItem(this.lastSyncKey);
    return syncTime ? new Date(syncTime) : null;
  }

  /**
   * UTILITY: Hitung elapsed time
   */
  getElapsedMinutes(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now - start) / 60000);
  }

  /**
   * EXPORT DATA
   * Siapkan data untuk export PDF/Excel
   */
  exportSessionData() {
    const session = this.getCurrentSession();
    if (!session) return null;

    return {
      sessionId: session.id,
      warehouse: session.warehouseName,
      operator: session.operatorName,
      startTime: session.startTime,
      endTime: session.endTime || new Date().toISOString(),
      totalItemsSampled: session.itemsCompleted,
      totalItemsRecount: session.itemsRecount,
      samplingData: session.samplingData,
      summary: this.generateSummary(session),
    };
  }

  /**
   * GENERATE SUMMARY
   */
  generateSummary(session) {
    const items = session.samplingData;
    const okItems = items.filter(i => i.status === 'OK').length;
    const recountItems = items.filter(i => i.status === 'RECOUNT').length;
    const suspiciousItems = items.filter(i => i.status === 'SUSPICIOUS').length;

    return {
      totalSampled: items.length,
      itemsOK: okItems,
      itemsNeedRecount: recountItems,
      itemsSuspicious: suspiciousItems,
      accuracyPercent: ((okItems / items.length) * 100).toFixed(2),
      avgRecountPerItem: (items.reduce((sum, i) => sum + i.recountCount, 0) / items.length).toFixed(2),
      totalRecountAttempts: items.reduce((sum, i) => sum + i.recountCount, 0),
    };
  }

  /**
   * DEBUG: Print session info
   */
  debugPrintSession() {
    const session = this.getCurrentSession();
    console.log('=== SESSION DEBUG ===');
    console.log('Session:', session);
    console.log('Offline Queue:', this.getOfflineQueue());
    console.log('Progress:', this.getProgress());
    console.log('======================');
  }
}

// Global instance
window.sessionManager = new SessionManager();
