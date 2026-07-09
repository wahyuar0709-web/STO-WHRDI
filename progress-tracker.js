/**
 * PROGRESS TRACKER - Real-time KPI & Performance Metrics
 * Tracks:
 * - Items per hour (throughput)
 * - Recount frequency
 * - Accuracy score
 * - Time per item
 */

class ProgressTracker {
  constructor() {
    this.metricsKey = 'rdi_sto_metrics';
    this.metrics = this.loadMetrics();
  }

  /**
   * CALCULATE THROUGHPUT
   */
  calculateThroughput(startTime, itemsCompleted) {
    const elapsedMinutes = this.getElapsedMinutes(startTime);
    if (elapsedMinutes === 0) return 0;
    return (itemsCompleted / elapsedMinutes * 60).toFixed(1);
  }

  /**
   * CALCULATE ACCURACY
   */
  calculateAccuracy(items) {
    if (items.length === 0) return 100;
    const okItems = items.filter(i => i.status === 'OK').length;
    return ((okItems / items.length) * 100).toFixed(1);
  }

  /**
   * CALCULATE RECOUNT FREQUENCY
   */
  calculateRecountFrequency(items) {
    const recountItems = items.filter(i => i.recountCount > 0).length;
    return ((recountItems / items.length) * 100).toFixed(1);
  }

  /**
   * CALCULATE AVG TIME PER ITEM
   */
  calculateAvgTimePerItem(startTime, itemsCompleted) {
    const elapsedMinutes = this.getElapsedMinutes(startTime);
    if (itemsCompleted === 0) return 0;
    return (elapsedMinutes / itemsCompleted * 60).toFixed(0); // in seconds
  }

  /**
   * GET REAL-TIME METRICS
   */
  getRealTimeMetrics(sessionData) {
    const throughput = this.calculateThroughput(sessionData.startTime, sessionData.itemsCompleted);
    const accuracy = this.calculateAccuracy(sessionData.samplingData);
    const recountFreq = this.calculateRecountFrequency(sessionData.samplingData);
    const avgTime = this.calculateAvgTimePerItem(sessionData.startTime, sessionData.itemsCompleted);

    return {
      throughput: `${throughput} items/jam`,
      accuracy: `${accuracy}%`,
      recountFrequency: `${recountFreq}%`,
      avgTimePerItem: `${avgTime}s`,
      elapsedTime: `${this.getElapsedMinutes(sessionData.startTime)} menit`,
      estimatedCompletion: this.estimateCompletion(sessionData),
    };
  }

  /**
   * ESTIMATE COMPLETION TIME
   */
  estimateCompletion(sessionData) {
    const avgTime = this.calculateAvgTimePerItem(sessionData.startTime, sessionData.itemsCompleted);
    const remaining = sessionData.totalItems - sessionData.itemsCompleted;
    const estimatedSeconds = avgTime * remaining;
    const minutes = Math.ceil(estimatedSeconds / 60);
    
    if (minutes < 60) {
      return `~${minutes} menit lagi`;
    } else {
      const hours = Math.ceil(minutes / 60);
      return `~${hours} jam lagi`;
    }
  }

  /**
   * RENDER METRICS DASHBOARD
   */
  renderMetricsDashboard(sessionData) {
    const metrics = this.getRealTimeMetrics(sessionData);

    return `
      <div style="background: var(--card); border-radius: var(--r-lg); padding: 16px; border: 1px solid var(--bdr); margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 12px;">📊 REAL-TIME METRICS</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <div style="background: var(--bg); border-radius: var(--r-sm); padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: var(--tx3); margin-bottom: 4px;">THROUGHPUT</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--blue);">${metrics.throughput}</div>
          </div>
          <div style="background: var(--bg); border-radius: var(--r-sm); padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: var(--tx3); margin-bottom: 4px;">ACCURACY</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--green);">${metrics.accuracy}</div>
          </div>
          <div style="background: var(--bg); border-radius: var(--r-sm); padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: var(--tx3); margin-bottom: 4px;">AVG TIME/ITEM</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--tx);">${metrics.avgTimePerItem}</div>
          </div>
          <div style="background: var(--bg); border-radius: var(--r-sm); padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: var(--tx3); margin-bottom: 4px;">RECOUNT FREQ</div>
            <div style="font-size: 16px; font-weight: 800; color: #B45309;">${metrics.recountFrequency}</div>
          </div>
        </div>
        <div style="border-top: 1px solid var(--divider); margin-top: 10px; padding-top: 10px; font-size: 12px; color: var(--tx2);">
          <strong>Waktu berlangsung:</strong> ${metrics.elapsedTime}<br>
          <strong>Estimasi selesai:</strong> ${metrics.estimatedCompletion}
        </div>
      </div>
    `;
  }

  /**
   * SAVE METRICS
   */
  saveMetrics(operatorName, sessionData) {
    const metrics = this.getRealTimeMetrics(sessionData);
    const entry = {
      date: new Date().toISOString(),
      operator: operatorName,
      warehouse: sessionData.warehouseName,
      ...metrics,
    };

    let allMetrics = JSON.parse(localStorage.getItem(this.metricsKey)) || [];
    allMetrics.push(entry);
    localStorage.setItem(this.metricsKey, JSON.stringify(allMetrics));
  }

  /**
   * LOAD METRICS
   */
  loadMetrics() {
    return JSON.parse(localStorage.getItem(this.metricsKey)) || [];
  }

  /**
   * GET OPERATOR STATS
   */
  getOperatorStats(operatorName) {
    const operatorMetrics = this.metrics.filter(m => m.operator === operatorName);
    if (operatorMetrics.length === 0) return null;

    const avgThroughput = operatorMetrics.reduce((sum, m) => sum + parseFloat(m.throughput), 0) / operatorMetrics.length;
    const avgAccuracy = operatorMetrics.reduce((sum, m) => sum + parseFloat(m.accuracy), 0) / operatorMetrics.length;
    const sessions = operatorMetrics.length;

    return {
      sessions: sessions,
      avgThroughput: avgThroughput.toFixed(1),
      avgAccuracy: avgAccuracy.toFixed(1),
      lastSession: operatorMetrics[operatorMetrics.length - 1].date,
    };
  }

  /**
   * UTILITY: Get elapsed minutes
   */
  getElapsedMinutes(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now - start) / 60000);
  }
}

window.progressTracker = new ProgressTracker();