import React, { useState, useRef, useEffect } from 'react';
import { CandlestickChart } from './Chart';
import { usePerformanceOptimization, useDebounce } from '../utils/performance';
import { useBinanceTradingPairs } from '../hooks';

// 模式切换组件
export const ModeSwitch = ({ currentMode, onModeChange }) => {
  const { trackRender } = usePerformanceOptimization();
  
  useEffect(() => {
    trackRender('ModeSwitch');
  });

  return (
    <div className="mode-switch">
      <button
        className={`mode-button ${currentMode === 'simple' ? 'active' : ''}`}
        onClick={() => onModeChange('simple')}
      >
        简洁
      </button>
      <button
        className={`mode-button ${currentMode === 'professional' ? 'active' : ''}`}
        onClick={() => onModeChange('professional')}
      >
        专业
      </button>
    </div>
  );
};

// 搜索下拉组件
export const SearchDropdown = ({ onAddPair, selectedPairs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredPairs, setFilteredPairs] = useState([]);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const { trackRender } = usePerformanceOptimization();
  
  // 使用新的币安交易对Hook
  const { searchPairs, loading, error, allPairs } = useBinanceTradingPairs();
  
  // 防抖搜索查询
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  useEffect(() => {
    trackRender('SearchDropdown');
  });

  // 调试日志
  useEffect(() => {
    // Debug info for development
  }, [loading, error, allPairs.length, debouncedSearchQuery, selectedPairs, searchPairs]);

  useEffect(() => {
    // 使用 hook 的搜索功能
    try {
      const results = searchPairs(debouncedSearchQuery, selectedPairs);
      setFilteredPairs(results);
    } catch (err) {
      console.error('[SearchDropdown] Search error:', err);
      setFilteredPairs([]);
    }
  }, [debouncedSearchQuery, selectedPairs, searchPairs, allPairs]);

  // 动态计算下拉框高度
  useEffect(() => {
    if (isOpen && searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom - 10; // 留10px边距
      const maxHeight = Math.min(62, Math.max(48, spaceBelow)); // 最小48px（2行），最大62px（3行）
      
      setDropdownStyle({
        maxHeight: `${maxHeight}px`
      });
    }
  }, [isOpen, filteredPairs]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && searchRef.current) {
        const rect = searchRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom - 10;
        const maxHeight = Math.min(62, Math.max(48, spaceBelow)); // 最小48px（2行），最大72px（3行）
        
        setDropdownStyle({
          maxHeight: `${maxHeight}px`
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setIsOpen(e.target.value.length > 0 || !e.target.value);
  };

  const handleSelectPair = (pair) => {
    onAddPair(pair.symbol);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div className="search-container" ref={searchRef}>
      <input
        type="text"
        className="search-input"
        placeholder={loading ? "加载交易对..." : "搜索交易对..."}
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        disabled={loading}
      />
      <span className="search-icon">{loading ? "⏳" : "🔍"}</span>
      
      {isOpen && (
        <div 
          className="dropdown show" 
          ref={dropdownRef}
          style={dropdownStyle}
        >
          {error ? (
            <div className="dropdown-item error">
              ⚠️ 加载失败: {error}
            </div>
          ) : filteredPairs.length > 0 ? (
            filteredPairs.map(pair => (
              <div
                key={pair.symbol}
                className="dropdown-item compact"
                onClick={() => handleSelectPair(pair)}
              >
                {pair.symbol}
              </div>
            ))
          ) : searchQuery.trim() ? (
            <div className="dropdown-item">
              没有找到匹配的交易对 (共{allPairs.length}个可用)
            </div>
          ) : loading ? (
            <div className="dropdown-item">
              正在加载交易对...
            </div>
          ) : (
            <div className="dropdown-item">
              输入关键词搜索交易对 (共{allPairs.length}个可用)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 交易对卡片组件
export const TradingPairCard = ({ 
  pair, 
  priceData, 
  isConnected, 
  mode, 
  onRemove 
}) => {
  const [showDelete, setShowDelete] = useState(false);
  const { trackRender } = usePerformanceOptimization();
  
  useEffect(() => {
    trackRender('TradingPairCard');
  });

  if (!priceData) {
    return (
      <div className="trading-pair-card loading-card">
        <div className="loading-content">
          <span className="pair-name">{pair}</span>
          <span className="loading-text">连接中...</span>
        </div>
      </div>
    );
  }

  const trendClass = priceData.trend === 'up' ? 'price-up' : 
                    priceData.trend === 'down' ? 'price-down' : 'price-neutral';
  const changeClass = priceData.trend === 'up' ? 'change-up' : 
                     priceData.trend === 'down' ? 'change-down' : 'change-neutral';
  const arrow = priceData.trend === 'up' ? '↗' : 
               priceData.trend === 'down' ? '↘' : '→';

  return (
    <div 
      className="trading-pair-card"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {showDelete && (
        <button 
          className="delete-button"
          onClick={() => onRemove(pair)}
        >
          ×
        </button>
      )}
      
      {mode === 'simple' ? (
        <SimpleCardContent 
          pair={pair}
          priceData={priceData}
          trendClass={trendClass}
          changeClass={changeClass}
          arrow={arrow}
        />
      ) : (
        <ProfessionalCardContent 
          pair={pair}
          priceData={priceData}
          trendClass={trendClass}
          changeClass={changeClass}
          arrow={arrow}
        />
      )}
    </div>
  );
};

// 简洁模式卡片内容
const SimpleCardContent = ({ pair, priceData, trendClass, changeClass, arrow }) => (
  <div className="simple-content">
    <div className="simple-header">
      <span className="pair-name">{pair}</span>
      <div className="price-info">
        <span className={`price ${trendClass}`}>
          ${priceData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`trend-arrow ${trendClass}`}>{arrow}</span>
      </div>
    </div>
    <div className="simple-footer">
      <span className="pair-full-name">{getPairName(pair)}</span>
      <span className={`change-percent ${changeClass}`}>
        {priceData.changePercent}% 24h
      </span>
    </div>
  </div>
);

// 专业模式卡片内容
const ProfessionalCardContent = ({ pair, priceData, trendClass, changeClass, arrow }) => (
  <div className="professional-content">
    <div className="professional-header">
      <span className="pair-name">{pair}</span>
      <div className="professional-price-info">
        <span className={`price ${trendClass}`}>
          ${priceData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`trend-arrow ${trendClass}`}>{arrow}</span>
        <span className={`change-percent ${changeClass}`}>
          {priceData.changePercent}%
        </span>
      </div>
    </div>
    <CandlestickChart symbol={pair} priceData={priceData} />
  </div>
);

// 控制栏组件
export const ControlBar = ({ 
  mode, 
  onModeChange, 
  onAddPair, 
  selectedPairs,
  onMinimize,
  isMinimized 
}) => {
  return (
    <div className="control-bar">
      {!isMinimized && (
        <>
          <ModeSwitch currentMode={mode} onModeChange={onModeChange} />
          <SearchDropdown onAddPair={onAddPair} selectedPairs={selectedPairs} />
        </>
      )}
      <button 
        className={isMinimized ? "expand-button" : "minimize-button"} 
        onClick={onMinimize}
        title={isMinimized ? "展开" : "缩小"}
      >
        {isMinimized ? "B" : "─"}
      </button>
    </div>
  );
};

// 辅助函数：获取交易对名称
const getPairName = (symbol) => {
  const names = {
    'BTC/USDT': 'Bitcoin',
    'ETH/USDT': 'Ethereum',
    'SOL/USDT': 'Solana',
    'ADA/USDT': 'Cardano',
    'DOT/USDT': 'Polkadot',
    'LINK/USDT': 'Chainlink',
    'BNB/USDT': 'Binance Coin'
  };
  return names[symbol] || symbol.split('/')[0];
};