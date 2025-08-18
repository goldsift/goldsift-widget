import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketPool, usePerformanceOptimization, useThrottle } from '../utils/performance';

// 全局WebSocket连接池
const wsPool = new WebSocketPool(3); // 最多3个连接

// 币安交易对数据获取Hook
export const useBinanceTradingPairs = () => {
  const [allPairs, setAllPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const cacheRef = useRef(null);
  
  // 缓存有效期：10分钟
  const CACHE_DURATION = 10 * 60 * 1000;

  // 获取现货交易对（不包含Alpha）
  const fetchSpotPairs = async () => {
    console.log('[TradingPairs] Fetching spot pairs...');
    const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (!response.ok) {
      throw new Error(`Spot API error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('[TradingPairs] Spot pairs response:', data.symbols?.length, 'symbols');
    
    const allSymbols = data.symbols || [];
    const tradingSymbols = allSymbols.filter(symbol => symbol.status === 'TRADING');
    const usdtSymbols = tradingSymbols.filter(symbol => symbol.quoteAsset === 'USDT');
    
    // 只返回普通现货交易对，不包含Alpha
    const spotPairs = usdtSymbols.map(symbol => ({
      symbol: `${symbol.baseAsset}/USDT`,
      name: getTokenName(symbol.baseAsset),
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      type: 'spot',
      volume: 0,
      originalSymbol: symbol.symbol
    }));
    
    return spotPairs;
  };

  // 获取Alpha交易对
  const fetchAlphaPairs = async () => {
    console.log('[TradingPairs] Fetching alpha pairs...');
    const response = await fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list', {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    if (!response.ok) {
      throw new Error(`Alpha API error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (data.code !== '000000') {
      throw new Error(`Alpha API response error: ${data.code}`);
    }
    
    console.log('[TradingPairs] Alpha tokens response:', data.data?.length, 'tokens');
    
    const tokens = data.data || [];
    
    const alphaPairs = tokens.map(token => {
      return {
        symbol: `${token.symbol}/USDT`,
        name: token.name || token.symbol,
        baseAsset: token.symbol,
        quoteAsset: 'USDT',
        type: 'alpha',
        volume: parseFloat(token.volume24h) || 0,
        originalSymbol: token.alphaId, // 使用alphaId作为原始标识
        price: parseFloat(token.price) || 0,
        change24h: parseFloat(token.percentChange24h) || 0,
        marketCap: parseFloat(token.marketCap) || 0,
        tokenId: token.tokenId
      };
    });
    
    console.log('[TradingPairs] Alpha pairs processed:', alphaPairs.length);
    
    return alphaPairs;
  };

  // 获取U本位合约交易对
  const fetchFuturesPairs = async () => {
    console.log('[TradingPairs] Fetching futures pairs...');
    const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
    if (!response.ok) {
      throw new Error(`Futures API error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('[TradingPairs] Futures pairs response:', data.symbols?.length, 'symbols');
    
    const allSymbols = data.symbols || [];
    const tradingSymbols = allSymbols.filter(symbol => symbol.status === 'TRADING');
    const usdtSymbols = tradingSymbols.filter(symbol => symbol.quoteAsset === 'USDT');
    
    // 只保留永续合约，严格按照contractType过滤
    const perpetualSymbols = usdtSymbols.filter(symbol => {
      return symbol.contractType === 'PERPETUAL';
    });
    
    console.log('[TradingPairs] Filtered perpetual contracts:', perpetualSymbols.length, 'from', usdtSymbols.length, 'total USDT symbols');
    
    const futuresPairs = perpetualSymbols.map(symbol => ({
      symbol: `${symbol.baseAsset}/USDT`,
      name: getTokenName(symbol.baseAsset),
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      type: 'futures',
      volume: 0,
      originalSymbol: symbol.symbol,
      contractType: symbol.contractType || 'PERPETUAL'
    }));
    
    // 调试：检查ETH相关的合约（应该只有1个了）
    const ethFutures = futuresPairs.filter(p => p.baseAsset === 'ETH');
    console.log('[TradingPairs] ETH futures after deduplication:', ethFutures.length, ethFutures);
    
    return futuresPairs;
  };

  const fetchTradingPairs = useCallback(async (forceRefresh = false) => {
    // 检查缓存
    if (!forceRefresh && cacheRef.current && lastFetch) {
      const isExpired = Date.now() - lastFetch > CACHE_DURATION;
      if (!isExpired) {
        setAllPairs(cacheRef.current);
        setLoading(false);
        return cacheRef.current;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // 并行获取现货、合约和Alpha数据
      const [spotPairs, futuresPairs, alphaPairs] = await Promise.all([
        fetchSpotPairs(),
        fetchFuturesPairs(),
        fetchAlphaPairs().catch(error => {
          console.warn('[TradingPairs] Alpha API failed, continuing without Alpha pairs:', error.message);
          return []; // 如果Alpha API失败，返回空数组，不影响其他数据
        })
      ]);
      
      // 合并所有交易对
      const allTradingPairs = [...spotPairs, ...futuresPairs, ...alphaPairs];
      
      // 按类型和主流币种排序
      const sortedPairs = allTradingPairs.sort((a, b) => {
        // 首先按类型排序：spot -> futures -> alpha
        const typeOrder = { spot: 0, futures: 1, alpha: 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        
        // 同类型内按主流币种优先排序
        const mainCoins = ['BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'AVAX', 'MATIC', 'LINK'];
        const aIndex = mainCoins.indexOf(a.baseAsset);
        const bIndex = mainCoins.indexOf(b.baseAsset);
        
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // 其他按字母排序
        return a.symbol.localeCompare(b.symbol);
      });

      setAllPairs(sortedPairs);
      cacheRef.current = sortedPairs;
      setLastFetch(Date.now());
      setLoading(false);
      
      return sortedPairs;
      
    } catch (err) {
      console.error('[TradingPairs] Error fetching trading pairs:', err);
      setError(err.message);
      setLoading(false);
      
      // 如果有缓存，使用缓存数据
      if (cacheRef.current) {
        setAllPairs(cacheRef.current);
        return cacheRef.current;
      }
      
      return [];
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchTradingPairs();
  }, []); // 移除依赖，避免循环

  // 搜索功能 - 支持类型过滤
  const searchPairs = useCallback((query, excludePairs = [], typeFilter = null) => {
    let filteredPairs = allPairs.filter(pair => !excludePairs.includes(pair.symbol));
    
    // 按类型过滤
    if (typeFilter) {
      filteredPairs = filteredPairs.filter(pair => pair.type === typeFilter);
    }
    
    if (!query.trim()) {
      return filteredPairs.slice(0, 50); // 限制50个结果
    }
    
    const lowercaseQuery = query.toLowerCase();
    
    return filteredPairs
      .filter(pair =>
        pair.symbol.toLowerCase().includes(lowercaseQuery) ||
        pair.name.toLowerCase().includes(lowercaseQuery) ||
        pair.baseAsset.toLowerCase().includes(lowercaseQuery) ||
        pair.type.toLowerCase().includes(lowercaseQuery)
      )
      .slice(0, 20); // 搜索结果限制20个
  }, [allPairs]);

  // 调试：监控 allPairs 的变化

  // 调试：监控 loading 的变化

  return {
    allPairs,
    loading,
    error,
    searchPairs,
    refetch: () => fetchTradingPairs(true),
    lastFetch
  };
};

// 移除多余的导出
// const originalUseBinanceTradingPairs = useBinanceTradingPairs;
// export { originalUseBinanceTradingPairs as useBinanceTradingPairs };

// 获取代币名称的辅助函数
const getTokenName = (baseAsset) => {
  const tokenNames = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'Binance Coin',
    'ADA': 'Cardano',
    'XRP': 'XRP',
    'SOL': 'Solana',
    'DOT': 'Polkadot',
    'AVAX': 'Avalanche',
    'MATIC': 'Polygon',
    'LINK': 'Chainlink',
    'UNI': 'Uniswap',
    'LTC': 'Litecoin',
    'ATOM': 'Cosmos',
    'NEAR': 'NEAR Protocol',
    'FTM': 'Fantom',
    'ALGO': 'Algorand',
    'MANA': 'Decentraland',
    'SAND': 'The Sandbox',
    'CRV': 'Curve DAO Token',
    'COMP': 'Compound'
  };
  
  return tokenNames[baseAsset] || baseAsset;
};

// K线数据WebSocket连接Hook
export const useKlineWebSocket = (symbol, interval = '1m') => {
  const [klineData, setKlineData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [lastUpdateType, setLastUpdateType] = useState(''); // 'update' 或 'new'
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // 获取历史K线数据
  const fetchHistoricalKlines = useCallback(async () => {
    if (!symbol) return;

    try {
      const binanceSymbol = symbol.replace('/', '');
      
      // 币安REST API获取历史K线数据
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=30`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 转换数据格式
      const formattedData = data.map(kline => ({
        time: Math.floor(kline[0] / 1000), // 开盘时间，转换为秒
        open: parseFloat(kline[1]),         // 开盘价
        high: parseFloat(kline[2]),         // 最高价
        low: parseFloat(kline[3]),          // 最低价
        close: parseFloat(kline[4]),        // 收盘价
        volume: parseFloat(kline[5])        // 成交量
      }));

      setKlineData(formattedData);
      setIsHistoryLoaded(true);
      
    } catch (error) {
      console.error(`[Kline] Error fetching historical data for ${symbol}:`, error);
      // 如果获取历史数据失败，仍然标记为已加载，这样WebSocket可以继续工作
      setIsHistoryLoaded(true);
    }
  }, [symbol, interval]);

  const setupKlineWebSocket = useCallback(() => {
    if (!symbol || !isHistoryLoaded) return;

    // 将 "BTC/USDT" 格式转换为 "btcusdt" 格式
    const binanceSymbol = symbol.replace('/', '').toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${interval}`;
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const kline = data.k;
        
        if (kline) {
          const newKlinePoint = {
            time: Math.floor(kline.t / 1000), // 转换为秒级时间戳
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v)
          };

          setKlineData(prevData => {
            const newData = [...prevData];
            
            // 检查最新一条K线是否是同一个时间段的
            if (newData.length > 0) {
              const lastKline = newData[newData.length - 1];
              
              if (lastKline.time === newKlinePoint.time) {
                // 如果是同一个时间段，更新最新的K线数据
                newData[newData.length - 1] = newKlinePoint;
                setLastUpdateType('update');
              } else if (newKlinePoint.time > lastKline.time) {
                // 如果是新的时间段，添加新的K线
                if (newData.length >= 30) {
                  newData.shift(); // 移除最旧的数据，保持30条
                }
                newData.push(newKlinePoint);
                setLastUpdateType('new');
              }
            } else {
              // 如果没有历史数据，直接添加
              newData.push(newKlinePoint);
              setLastUpdateType('new');
            }
            
            return newData;
          });
        }
      } catch (error) {
        console.error('[Kline] Error parsing WebSocket data:', error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      
      // 重连逻辑
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.pow(2, reconnectAttempts.current) * 1000;
        setTimeout(() => {
          reconnectAttempts.current++;
          setupKlineWebSocket();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error(`[Kline] WebSocket error for ${symbol}:`, error);
      setConnectionStatus('error');
    };
  }, [symbol, interval, isHistoryLoaded]);

  // 先获取历史数据，再建立WebSocket连接
  useEffect(() => {
    fetchHistoricalKlines();
  }, [fetchHistoricalKlines]);

  // 历史数据加载完成后建立WebSocket连接
  useEffect(() => {
    if (isHistoryLoaded) {
      setupKlineWebSocket();
    }
    
    // 清理函数
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [setupKlineWebSocket, isHistoryLoaded]);

  return {
    klineData,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isHistoryLoaded,
    lastUpdateType
  };
};

// WebSocket连接管理Hook
export const useWebSocket = (selectedPairs, allPairs = []) => {
  const [connections, setConnections] = useState(new Map());
  const [priceData, setPriceData] = useState(new Map());
  const [connectionStatus, setConnectionStatus] = useState(new Map());
  const reconnectAttempts = useRef(new Map());
  const maxReconnectAttempts = 5;
  const { trackRender } = usePerformanceOptimization();
  
  // 使用useRef来存储previousPrices，避免state更新延迟问题
  const previousPricesRef = useRef(new Map());

  // 使用节流处理价格更新，优化性能
  const throttledPriceUpdate = useThrottle((symbol, data) => {
    const currentPrice = parseFloat(data.c);
    const previousPrice = previousPricesRef.current.get(symbol);
    const priceChange = parseFloat(data.P);
    
    // 基于实时价格变化确定趋势
    let trend = 'neutral';
    
    if (previousPrice !== undefined) {
      if (currentPrice < previousPrice) {
        trend = 'down';
      } else if (currentPrice > previousPrice) {
        trend = 'up';
      }
    } else {
      // 第一次收到价格时，使用24h变化作为参考
      trend = priceChange >= 0 ? 'up' : 'down';
    }
    
    const processedData = {
      symbol: data.s,
      price: currentPrice,
      change: priceChange,
      changePercent: priceChange > 0 ? `+${priceChange.toFixed(2)}` : priceChange.toFixed(2),
      high: parseFloat(data.h),
      low: parseFloat(data.l),
      volume: Math.round(parseFloat(data.v)),
      trend: trend,
      timestamp: Date.now()
    };

    // 开发模式下显示价格变化日志
    if (process.env.NODE_ENV === 'development') {
      // Price tracking for debugging
    }

    // 更新显示
    setPriceData(prev => new Map(prev.set(symbol, processedData)));
    // 立即更新ref中的历史价格
    previousPricesRef.current.set(symbol, currentPrice);
  }, 200); // 200ms节流，在性能和实时性之间平衡

  // 设置WebSocket事件处理器
  const setupWebSocketHandlers = useCallback((ws, symbol) => {
    if (!ws) return;

    ws.onopen = () => {
      setConnectionStatus(prev => new Map(prev.set(symbol, 'connected')));
      reconnectAttempts.current.delete(symbol);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      throttledPriceUpdate(symbol, data);
    };

    ws.onclose = () => {
      setConnectionStatus(prev => new Map(prev.set(symbol, 'disconnected')));
      
      // 重连逻辑
      const attempts = reconnectAttempts.current.get(symbol) || 0;
      if (attempts < maxReconnectAttempts && selectedPairs.includes(symbol)) {
        const delay = Math.pow(2, attempts) * 1000; // 指数退避
        setTimeout(() => {
          const newWs = createConnection(symbol);
          if (newWs) {
            setConnections(prev => new Map(prev.set(symbol, newWs)));
          }
          reconnectAttempts.current.set(symbol, attempts + 1);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${symbol}:`, error);
      setConnectionStatus(prev => new Map(prev.set(symbol, 'error')));
    };
  }, [throttledPriceUpdate, selectedPairs, maxReconnectAttempts]);

  const createConnection = useCallback((symbol) => {
    // 从allPairs中找到对应的交易对信息获取类型
    const pairInfo = allPairs.find(pair => pair.symbol === symbol);
    const pairType = pairInfo?.type || 'spot';
    
    // 根据交易对类型生成WebSocket符号
    let wsSymbol;
    let url;
    
    switch (pairType) {
      case 'futures':
        // 将 "BTC/USDT" 格式转换为 "btcusdt" 格式
        wsSymbol = symbol.replace('/', '').toLowerCase();
        url = `wss://fstream.binance.com/ws/${wsSymbol}@ticker`;
        break;
        
      case 'alpha':
        // Alpha交易对使用原始的symbol格式，如 "ALPHA_105USDT"
        const originalSymbol = pairInfo?.originalSymbol;
        if (originalSymbol) {
          wsSymbol = originalSymbol.toLowerCase();
          // Alpha交易对可能使用不同的WebSocket端点，先尝试标准端点
          url = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
        } else {
          console.warn(`[WebSocket] No original symbol found for alpha pair: ${symbol}`);
          // 降级到现货端点
          wsSymbol = symbol.replace('/', '').toLowerCase();
          url = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
        }
        break;
        
      case 'spot':
      default:
        // 将 "BTC/USDT" 格式转换为 "btcusdt" 格式
        wsSymbol = symbol.replace('/', '').toLowerCase();
        url = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
        break;
    }
    
    console.log(`[WebSocket] Creating ${pairType} connection for ${symbol} (${wsSymbol}): ${url}`);
    
    const ws = new WebSocket(url);
    setupWebSocketHandlers(ws, symbol);
    return ws;
  }, [setupWebSocketHandlers, allPairs]);

  const closeConnection = useCallback((symbol) => {
    const ws = connections.get(symbol);
    if (ws) {
      ws.close();
      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(symbol);
        return newMap;
      });
      setConnectionStatus(prev => {
        const newMap = new Map(prev);
        newMap.delete(symbol);
        return newMap;
      });
      setPriceData(prev => {
        const newMap = new Map(prev);
        newMap.delete(symbol);
        return newMap;
      });
    }
  }, [connections]);

  // 管理多个交易对的连接
  useEffect(() => {
    // 添加新的连接
    selectedPairs.forEach(symbol => {
      if (!connections.has(symbol)) {
        const ws = createConnection(symbol);
        setConnections(prev => new Map(prev.set(symbol, ws)));
      }
    });

    // 关闭不需要的连接
    connections.forEach((ws, symbol) => {
      if (!selectedPairs.includes(symbol)) {
        closeConnection(symbol);
      }
    });
  }, [selectedPairs, connections, createConnection, closeConnection]);

  // 清理所有连接
  useEffect(() => {
    return () => {
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    };
  }, [connections]);

  return {
    priceData,
    connectionStatus,
    isConnected: (symbol) => connectionStatus.get(symbol) === 'connected'
  };
};

// 应用设置管理Hook
export const useAppSettings = () => {
  const [settings, setSettings] = useState({
    selectedPairs: ['BTC/USDT'],
    mode: 'simple',
    alwaysOnTop: true
  });
  const [isLoading, setIsLoading] = useState(true);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electronAPI) {
          const savedSettings = await window.electronAPI.loadSettings();
          setSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // 保存设置
  const saveSettings = useCallback(async (newSettings) => {
    try {
      setSettings(newSettings);
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(newSettings);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  const updateSetting = useCallback((key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  return {
    settings,
    updateSetting,
    saveSettings,
    isLoading
  };
};

// 窗口管理Hook
export const useWindowManager = (selectedPairs, mode) => {
  const [windowSize, setWindowSize] = useState({ width: 280, height: 96 });

  const updateWindowSize = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const newSize = await window.electronAPI.resizeWindow(selectedPairs.length, mode);
        if (newSize) {
          setWindowSize(newSize);
          console.log(`Window resized to: ${newSize.width}×${newSize.height} for ${selectedPairs.length} pairs in ${mode} mode`);
        }
      }
    } catch (error) {
      console.error('Failed to update window size:', error);
    }
  }, [selectedPairs.length, mode]);

  // 当交易对数量或模式改变时更新窗口尺寸
  useEffect(() => {
    // 添加短暂延迟确保设置已保存
    const timer = setTimeout(() => {
      updateWindowSize();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [selectedPairs.length, mode]);

  // 强制立即更新一次（用于测试）
  useEffect(() => {
    updateWindowSize();
  }, []);

  return {
    windowSize,
    updateWindowSize
  };
};