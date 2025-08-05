// 性能监控工具
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  // 开始性能监控
  startMonitoring() {
    if (!this.isEnabled) return;

    // 监控内存使用
    this.monitorMemoryUsage();
    
    // 监控渲染性能
    this.monitorRenderPerformance();
    
    // 监控WebSocket连接
    this.monitorWebSocketPerformance();
  }

  // 内存监控
  monitorMemoryUsage() {
    const checkMemory = () => {
      if (performance.memory) {
        const memory = {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };

        this.metrics.set('memory', memory);

        // 警告阈值：超过100MB
        if (memory.used > 100) {
          // High memory usage detected
        }
      }
    };

    checkMemory();
    setInterval(checkMemory, 30000); // 每30秒检查一次
  }

  // 渲染性能监控
  monitorRenderPerformance() {
    if (!window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure') {
          this.metrics.set(`render_${entry.name}`, entry.duration);
          
          // 警告阈值：超过16ms（60fps）
          if (entry.duration > 16) {
            // Slow render detected
          }
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.push(observer);
  }

  // WebSocket性能监控
  monitorWebSocketPerformance() {
    const originalWebSocket = window.WebSocket;
    const monitor = this;

    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);
      const startTime = performance.now();

      ws.addEventListener('open', () => {
        const connectionTime = performance.now() - startTime;
        monitor.metrics.set('websocket_connection_time', connectionTime);
      });

      ws.addEventListener('message', () => {
        const messageCount = monitor.metrics.get('websocket_messages') || 0;
        monitor.metrics.set('websocket_messages', messageCount + 1);
      });

      return ws;
    };
  }

  // 获取性能报告
  getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      recommendations: this.getRecommendations()
    };

    return report;
  }

  // 获取优化建议
  getRecommendations() {
    const recommendations = [];
    const memory = this.metrics.get('memory');

    if (memory && memory.used > 100) {
      recommendations.push('考虑减少WebSocket连接数量或实现连接池');
    }

    const wsMessages = this.metrics.get('websocket_messages');
    if (wsMessages && wsMessages > 1000) {
      recommendations.push('考虑实现消息防抖或节流机制');
    }

    return recommendations;
  }

  // 清理监控
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// React性能优化Hook
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

// 防抖Hook - 独立导出
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 节流Hook - 独立导出
export const useThrottle = (callback, delay) => {
  const lastRun = useRef(Date.now());

  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

export const usePerformanceOptimization = () => {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(performance.now());

  // 渲染性能监控
  const trackRender = useCallback((componentName) => {
    renderCountRef.current += 1;
    const now = performance.now();
    const renderTime = now - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`${componentName}-render-start`);
      
      // 使用requestAnimationFrame确保在渲染完成后测量
      requestAnimationFrame(() => {
        performance.mark(`${componentName}-render-end`);
        performance.measure(
          `${componentName}-render`,
          `${componentName}-render-start`,
          `${componentName}-render-end`
        );
      });
    }

    lastRenderTime.current = now;
  }, []);

  return {
    trackRender,
    renderCount: renderCountRef.current
  };
};

// WebSocket连接池管理
export class WebSocketPool {
  constructor(maxConnections = 5) {
    this.maxConnections = maxConnections;
    this.connections = new Map();
    this.connectionQueue = [];
    this.reconnectAttempts = new Map();
  }

  // 获取或创建连接
  getConnection(url, options = {}) {
    if (this.connections.has(url)) {
      return this.connections.get(url);
    }

    if (this.connections.size >= this.maxConnections) {
      // 如果达到最大连接数，排队等待
      return new Promise((resolve) => {
        this.connectionQueue.push({ url, options, resolve });
      });
    }

    return this.createConnection(url, options);
  }

  // 创建新连接
  createConnection(url, options) {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      this.reconnectAttempts.delete(url);
    };

    ws.onclose = () => {
      this.connections.delete(url);
      this.handleReconnect(url, options);
      this.processQueue();
    };

    ws.onerror = (error) => {
      console.error(`❌ WebSocket pool error for ${url}:`, error);
    };

    this.connections.set(url, ws);
    return ws;
  }

  // 处理重连
  handleReconnect(url, options) {
    const attempts = this.reconnectAttempts.get(url) || 0;
    const maxAttempts = options.maxReconnectAttempts || 5;

    if (attempts < maxAttempts) {
      const delay = Math.pow(2, attempts) * 1000; // 指数退避
      setTimeout(() => {
        this.reconnectAttempts.set(url, attempts + 1);
        this.createConnection(url, options);
      }, delay);
    }
  }

  // 处理连接队列
  processQueue() {
    if (this.connectionQueue.length > 0 && this.connections.size < this.maxConnections) {
      const { url, options, resolve } = this.connectionQueue.shift();
      const connection = this.createConnection(url, options);
      resolve(connection);
    }
  }

  // 关闭所有连接
  closeAll() {
    this.connections.forEach((ws, url) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.connections.clear();
    this.connectionQueue = [];
    this.reconnectAttempts.clear();
  }
}

// 导出性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 在应用启动时开始监控
if (typeof window !== 'undefined') {
  performanceMonitor.startMonitoring();
}