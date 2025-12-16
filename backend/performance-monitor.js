const fs = require('fs');
const path = require('path');
const os = require('os');

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.maxMetrics = 1000;
  }

  recordMetric(data) {
    const metric = {
      timestamp: new Date().toISOString(),
      ...data,
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: os.loadavg(),
        platform: os.platform(),
        arch: os.arch()
      }
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.saveMetrics();
  }

  saveMetrics() {
    try {
      const metricsPath = path.join(__dirname, 'performance.json');
      fs.writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Failed to save performance metrics:', error);
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getStats() {
    if (this.metrics.length === 0) return null;

    const responseTimes = this.metrics
      .filter(m => m.responseTime)
      .map(m => m.responseTime);

    if (responseTimes.length === 0) return null;

    return {
      totalRequests: this.metrics.length,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      lastUpdated: this.metrics[this.metrics.length - 1].timestamp
    };
  }
}

module.exports = new PerformanceMonitor();