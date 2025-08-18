import React, { useEffect } from 'react';
import './App.css';
import { useWebSocket, useAppSettings, useWindowManager, useBinanceTradingPairs } from './hooks';
import { ControlBar, TradingPairCard } from './components';
import { usePerformanceOptimization } from './utils/performance';

// 可用的交易对列表
const AVAILABLE_PAIRS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin' },
  { symbol: 'ETH/USDT', name: 'Ethereum' },
  { symbol: 'SOL/USDT', name: 'Solana' },
  { symbol: 'ADA/USDT', name: 'Cardano' },
  { symbol: 'DOT/USDT', name: 'Polkadot' },
  { symbol: 'LINK/USDT', name: 'Chainlink' },
  { symbol: 'BNB/USDT', name: 'Binance Coin' },
  { symbol: 'AVAX/USDT', name: 'Avalanche' },
  { symbol: 'MATIC/USDT', name: 'Polygon' },
  { symbol: 'UNI/USDT', name: 'Uniswap' }
];

function App() {
  const { settings, updateSetting, isLoading } = useAppSettings();
  const { allPairs } = useBinanceTradingPairs();
  const { priceData, connectionStatus, isConnected } = useWebSocket(settings.selectedPairs, allPairs);
  const { windowSize } = useWindowManager(settings.selectedPairs, settings.mode);
  const { trackRender } = usePerformanceOptimization();
  const [isMinimized, setIsMinimized] = React.useState(false);
  
  // 检查URL参数判断是否为缩小模式
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const minimized = urlParams.get('minimized') === 'true';
    setIsMinimized(minimized);
    
    // 为最小化模式设置body class
    if (minimized) {
      document.body.classList.add('minimized');
    } else {
      document.body.classList.remove('minimized');
    }
  }, []);
  
  // 性能监控
  useEffect(() => {
    trackRender('App');
  });

  // 模式切换处理
  const handleModeChange = (newMode) => {
    updateSetting('mode', newMode);
  };

  // 缩小/展开处理
  const handleMinimizeToggle = async () => {
    // 如果当前是缩小窗口，点击展开
    if (isMinimized) {
      if (window.electronAPI) {
        try {
          await window.electronAPI.toggleMinimizeWindow(false);
          // 缩小窗口会被关闭，这里不需要更新状态
        } catch (error) {
          console.error('Failed to expand window:', error);
        }
      }
    } else {
      // 如果是主窗口，点击缩小
      const newMinimizedState = true;
      if (window.electronAPI) {
        try {
          await window.electronAPI.toggleMinimizeWindow(newMinimizedState);
          // 主窗口会被隐藏，缩小窗口会显示
        } catch (error) {
          console.error('Failed to minimize window:', error);
        }
      }
    }
  };

  // 添加交易对
  const handleAddPair = (pairSymbol) => {
    if (!settings.selectedPairs.includes(pairSymbol)) {
      const newPairs = [...settings.selectedPairs, pairSymbol];
      updateSetting('selectedPairs', newPairs);
    }
  };

  // 移除交易对
  const handleRemovePair = (pairSymbol) => {
    if (settings.selectedPairs.length > 1) { // 保证至少有一个交易对
      const newPairs = settings.selectedPairs.filter(pair => pair !== pairSymbol);
      updateSetting('selectedPairs', newPairs);
    }
  };

  // 设置窗口置顶状态
  useEffect(() => {
    if (window.electronAPI && !isLoading) {
      window.electronAPI.setAlwaysOnTop(settings.alwaysOnTop);
    }
  }, [settings.alwaysOnTop, isLoading]);

  // 处理错误
  useEffect(() => {
    const handleError = (error) => {
      console.error('App error:', error);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  // 应用加载中状态
  if (isLoading) {
    return (
      <div className="app">
        <div className="control-bar">
          <div className="loading-text">初始化中...</div>
        </div>
      </div>
    );
  }

  // 如果是缩小模式，只显示圆形展开按钮
  if (isMinimized) {
    return (
      <div className="app minimized">
        <div className="drag-wrapper">
          <button 
            className="expand-button" 
            onClick={handleMinimizeToggle}
            title="展开"
          >
            B
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${settings.mode}-mode`}>
      {/* 控制栏 */}
      <ControlBar
        mode={settings.mode}
        onModeChange={handleModeChange}
        onAddPair={handleAddPair}
        selectedPairs={settings.selectedPairs}
        onMinimize={handleMinimizeToggle}
        isMinimized={false}
      />

      {/* 交易对展示区域 */}
      <div className={`trading-pairs-container ${settings.mode}-mode`}>
        {settings.selectedPairs.map(pair => {
          // 从allPairs中找到对应的交易对信息获取类型
          const pairInfo = allPairs.find(p => p.symbol === pair);
          const pairType = pairInfo?.type || 'spot';
          
          return (
            <TradingPairCard
              key={pair}
              pair={pair}
              priceData={priceData.get(pair)}
              isConnected={isConnected(pair)}
              mode={settings.mode}
              onRemove={handleRemovePair}
              pairType={pairType}
            />
          );
        })}
        
        {/* 空状态提示 */}
        {settings.selectedPairs.length === 0 && (
          <div className="empty-state">
            <p>请添加交易对进行监控</p>
          </div>
        )}
      </div>

      {/* 开发模式信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info" style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          fontSize: '9px',
          color: '#666',
          background: 'rgba(255,255,255,0.8)',
          padding: '1px 3px',
          borderRadius: '2px',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {windowSize.width}×{windowSize.height} | {settings.selectedPairs.length}对 | {settings.mode}
        </div>
      )}
    </div>
  );
}

export default App;