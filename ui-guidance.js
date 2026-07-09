/**
 * UI GUIDANCE & CHECKLIST
 * Provides in-app guidance, tutorials, and pre-sampling checklist
 * Fixes:
 * - User tidak tahu harus apakah sebelum mulai
 * - Clear step-by-step guidance
 * - On-app tutorials
 */

class UIGuidance {
  /**
   * PRE-SAMPLING CHECKLIST
   */
  static showPreSamplingChecklist() {
    const checklist = [
      {
        id: 'battery',
        label: 'Device charge penuh (min 80%)',
        checked: this.checkBattery(),
        icon: '🔋',
      },
      {
        id: 'network',
        label: 'WiFi/Mobile connected',
        checked: navigator.onLine,
        icon: '📶',
      },
      {
        id: 'cloud',
        label: 'Cloud sync URL aktif',
        checked: !!localStorage.getItem('cloud_sync_url'),
        icon: '☁️',
      },
      {
        id: 'warehouse',
        label: 'Gudang sudah dipilih',
        checked: !!localStorage.getItem('selected_warehouse'),
        icon: '🏢',
      },
      {
        id: 'master',
        label: 'Master data updated',
        checked: !!localStorage.getItem('master_data_timestamp'),
        icon: '📊',
      },
    ];

    return this.renderChecklist(checklist);
  }

  static checkBattery() {
    if (!navigator.getBattery) return true; // Fallback
    // Simplified - in production use Battery API
    return true;
  }

  static renderChecklist(items) {
    let html = `
      <div style="background: var(--card); border-radius: var(--r-lg); padding: 16px; border: 1px solid var(--bdr); margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 800; margin-bottom: 12px;">✓ CHECKLIST SEBELUM MULAI STO</div>
    `;

    items.forEach(item => {
      const status = item.checked ? '✅' : '⚠️';
      const color = item.checked ? '#0E9F6E' : '#D97706';
      html += `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--divider);">
          <span style="font-size: 18px;">${item.icon}</span>
          <span style="flex: 1; font-size: 13px;">${item.label}</span>
          <span style="color: ${color}; font-weight: 700;">${status}</span>
        </div>
      `;
    });

    html += `
        <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: 12px;" onclick="showPage('page-sampling')">
          Mulai STO
        </button>
      </div>
    `;

    return html;
  }

  /**
   * IN-APP TUTORIAL OVERLAY
   */
  static showTutorial(step = 1) {
    const tutorials = {
      1: {
        title: '📱 Input Cepat',
        content: 'Ketik angka lalu tekan ENTER (↵) untuk input super cepat',
        icon: '⌨️',
      },
      2: {
        title: '🔢 Buttons Adjust',
        content: 'Gunakan ➕ atau ➖ untuk adjust angka dengan cepat',
        icon: '🖱️',
      },
      3: {
        title: '📍 Lihat Lokasi',
        content: 'Tap badge "Lokasi" untuk konfirmasi lokasi barang yang benar',
        icon: '🏷️',
      },
      4: {
        title: '🔄 Recount Otomatis',
        content: 'Jika selisih > toleransi, app akan ingatkan untuk hitung ulang',
        icon: '⚠️',
      },
    };

    const tut = tutorials[step];
    return `
      <div style="background: var(--blue-lt); border: 2px solid var(--blue); border-radius: var(--r-lg); padding: 14px; margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">${tut.title}</div>
        <div style="font-size: 13px; color: var(--tx); line-height: 1.6;">${tut.content}</div>
        <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 10px;" onclick="UIGuidance.showTutorial(${step + 1 <= 4 ? step + 1 : 1})">
          ${step < 4 ? '➡️ Lanjut' : '✅ Paham'}
        </button>
      </div>
    `;
  }

  /**
   * PROGRESS INDICATOR
   */
  static renderProgressBar(current, total) {
    const percent = Math.round((current / total) * 100);
    const remaining = total - current;
    
    return `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 700;">Progress Hitung</span>
          <span style="font-size: 12px; font-weight: 700; color: var(--blue);">${current}/${total} (${percent}%)</span>
        </div>
        <div style="width: 100%; height: 8px; background: var(--divider); border-radius: 20px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #0E9F6E, #10B981); width: ${percent}%; transition: width 0.3s ease;"></div>
        </div>
        <div style="font-size: 11px; color: var(--tx3); margin-top: 6px;">
          Sisa: <strong>${remaining}</strong> item | Estimasi: <strong>${Math.ceil(remaining * 2)} menit</strong>
        </div>
      </div>
    `;
  }

  /**
   * NETWORK STATUS INDICATOR
   */
  static renderNetworkStatus() {
    const isOnline = navigator.onLine;
    const status = isOnline ? { icon: '🟢', text: 'Online', color: 'var(--green)' } : { icon: '🔴', text: 'Offline', color: '#DC2626' };
    const syncCount = parseInt(localStorage.getItem('rdi_sto_pending_sync') || '0');

    let html = `
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--divider); border-radius: var(--r-sm); margin-bottom: 12px; font-size: 12px;">
        <span style="font-size: 14px;">${status.icon}</span>
        <span style="color: ${status.color}; font-weight: 700;">${status.text}</span>
    `;

    if (!isOnline && syncCount > 0) {
      html += `<span style="margin-left: auto;">📋 ${syncCount} pending sync</span>`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * RECOUNT WARNING
   */
  static renderRecountWarning(selisihPersen, tolerance) {
    if (Math.abs(parseFloat(selisihPersen)) <= parseFloat(tolerance)) {
      return '';
    }

    return `
      <div style="background: var(--err-lt); border: 1px solid #FCA5A5; border-radius: var(--r-sm); padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 12px; font-weight: 800; color: var(--err); margin-bottom: 6px;">⚠️ HITUNG ULANG DIPERLUKAN</div>
        <div style="font-size: 12px; color: var(--tx2); line-height: 1.5;">
          Selisih <strong>${selisihPersen}%</strong> melebihi toleransi <strong>${tolerance}%</strong><br>
          Silakan hitung ulang dengan teliti!
        </div>
        <button class="btn btn-green btn-sm" style="width: 100%; margin-top: 8px;" onclick="resetInputAndRetry()">
          🔄 Hitung Ulang
        </button>
      </div>
    `;
  }

  /**
   * SESSION COMPLETE SUMMARY
   */
  static renderSessionSummary(summary) {
    return `
      <div style="background: var(--green-lt); border-radius: var(--r-lg); padding: 16px; border: 1px solid #A7F3D0; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: var(--green); margin-bottom: 12px;">✅ PROSES SELESAI!</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: var(--green);">${summary.totalSampled}</div>
            <div style="font-size: 11px; color: var(--tx3); margin-top: 2px;">Items Dihitung</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #0E9F6E;">${summary.accuracyPercent}%</div>
            <div style="font-size: 11px; color: var(--tx3); margin-top: 2px;">Akurasi</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #B45309;">${summary.itemsNeedRecount}</div>
            <div style="font-size: 11px; color: var(--tx3); margin-top: 2px;">Perlu Recount</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: var(--tx);">${summary.totalRecountAttempts}</div>
            <div style="font-size: 11px; color: var(--tx3); margin-top: 2px;">Total Recount</div>
          </div>
        </div>
      </div>
    `;
  }
}

window.UIGuidance = UIGuidance;