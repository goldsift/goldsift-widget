import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { useKlineWebSocket } from '../hooks';

// K线图组件 - 使用TradingView轻量级图表
export const CandlestickChart = ({ symbol, priceData, pairType = 'spot' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 使用K线WebSocket获取真实数据，传入pairType参数
  const { klineData, isConnected: isKlineConnected, isHistoryLoaded, lastUpdateType } = useKlineWebSocket(symbol, '1m', pairType);

  // 初始化图表 - 只在组件挂载或symbol变化时初始化一次
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    // 添加延迟确保DOM已渲染
    const initChart = () => {
      if (!chartContainerRef.current) {
        setTimeout(initChart, 100);
        return;
      }

      try {
        const chart = createChart(chartContainerRef.current, {
          width: 248, // 适配小窗口
          height: 60,
          layout: {
            background: { color: '#f5f5f5' }, // 设置浅灰色背景
            textColor: '#666666',
            attributionLogo: false, // 隐藏TradingView归属链接
          },
          grid: {
            vertLines: { 
              color: '#e0e0e0',
              visible: true
            },
            horzLines: { 
              color: '#e0e0e0',
              visible: true
            },
          },
          crosshair: {
            mode: 0, // 禁用十字光标
          },
          rightPriceScale: {
            visible: false, // 隐藏价格轴
          },
          timeScale: {
            visible: false, // 隐藏时间轴
            borderVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            barSpacing: 2, // 设置K线间距，使其更密集
            rightOffset: 2,
            minBarSpacing: 1, // 最小间距
          },
          handleScroll: false, // 禁用滚动
          handleScale: false,  // 禁用缩放
          watermark: {
            visible: false, // 隐藏水印
          },
        });

        // lightweight-charts v5的正确语法
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          priceLineVisible: false,
          lastValueVisible: false,
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        setIsInitialized(true);
      } catch (error) {
        console.error(`[Chart] Error initializing chart for ${symbol}:`, error);
      }
    };

    // 使用setTimeout确保DOM已完全渲染
    const timeoutId = setTimeout(initChart, 10);

    // 清理函数
    return () => {
      clearTimeout(timeoutId);
    };
  }, [symbol]); // 只依赖symbol

  // 当获取到真实K线数据时更新图表
  useEffect(() => {
    if (!candlestickSeriesRef.current || !klineData.length || !isHistoryLoaded) return;

    try {
      console.log(`[Chart] Updating with real kline data, total: ${klineData.length} klines, updateType: ${lastUpdateType}`);
      
      // 只显示最后20条数据，保证图表清晰可读
      const displayData = klineData.slice(-20);
      console.log(`[Chart] Displaying ${displayData.length} klines for ${symbol}`);
      
      if (lastUpdateType === 'update' && displayData.length > 0) {
        // 如果是更新最新的K线，使用update方法性能更好
        const latestKline = displayData[displayData.length - 1];
        candlestickSeriesRef.current.update(latestKline);
      } else {
        // 如果是新增K线或初始加载，使用setData
        candlestickSeriesRef.current.setData(displayData);
      }
      
      // 自动适配价格范围
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error(`[Chart] Error updating kline data:`, error);
    }
  }, [klineData, isHistoryLoaded, symbol, lastUpdateType]);

  // 清理图表的单独useEffect
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [symbol]); // 当symbol变化时清理旧图表

  // 响应容器尺寸变化 - 只在图表初始化后设置一次
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current || !isInitialized) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current || !chartRef.current) {
        return;
      }

      const { width } = entries[0].contentRect;
      chartRef.current.applyOptions({ width: Math.max(width, 200), height: 60 });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [isInitialized]); // 只在初始化完成后设置一次

  // 总是渲染容器，但根据初始化状态显示不同内容
  return (
    <div className="chart-container tradingview-chart" style={{ position: 'relative' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '60px' }} />
      {(!isInitialized || !isHistoryLoaded) && (
        <div className="chart-loading" style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(245, 245, 245, 0.9)',
          color: '#666666'
        }}>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span style={{ fontSize: '10px', color: '#666666', marginTop: '4px' }}>
            {!isHistoryLoaded ? '加载历史数据...' : '初始化图表...'}
          </span>
        </div>
      )}
      {isInitialized && isHistoryLoaded && klineData.length === 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(245, 245, 245, 0.9)',
          color: '#666666',
          fontSize: '10px'
        }}>
          暂无K线数据
        </div>
      )}
    </div>
  );
};

// 简化的价格趋势线组件（用于简洁模式的价格历史显示）
export const TrendLine = ({ priceData }) => {
  const canvasRef = useRef(null);
  const [priceHistory, setPriceHistory] = useState([]);

  // 收集价格历史
  useEffect(() => {
    if (priceData && priceData.price) {
      setPriceHistory(prev => {
        const newHistory = [...prev, {
          time: Date.now(),
          price: priceData.price,
          trend: priceData.trend
        }];
        
        // 保持最近20个数据点
        return newHistory.slice(-20);
      });
    }
  }, [priceData]);

  // 绘制趋势线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceHistory.length < 2) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // 设置canvas实际尺寸
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // 设置样式尺寸
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const { width, height } = { width: rect.width, height: rect.height };
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 计算价格范围
    const prices = priceHistory.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // 绘制趋势线
    ctx.beginPath();
    ctx.strokeStyle = priceData?.trend === 'up' ? '#137333' : '#d93025';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    priceHistory.forEach((point, index) => {
      const x = (index / (priceHistory.length - 1)) * width;
      const y = height - ((point.price - minPrice) / priceRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // 添加渐变填充
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    const color = priceData?.trend === 'up' ? '#137333' : '#d93025';
    gradient.addColorStop(0, color + '20'); // 20% opacity
    gradient.addColorStop(1, color + '00'); // 0% opacity
    
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = gradient;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // 绘制最新价格点
    if (priceHistory.length > 0) {
      const lastPoint = priceHistory[priceHistory.length - 1];
      const x = width;
      const y = height - ((lastPoint.price - minPrice) / priceRange) * height;
      
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x - 2, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    
  }, [priceHistory, priceData]);

  return (
    <div className="trend-line-container" style={{ width: '100%', height: '30px', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '30px',
          display: 'block'
        }}
      />
    </div>
  );
};