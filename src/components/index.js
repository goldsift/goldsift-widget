import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [typeFilter, setTypeFilter] = useState(null); // 类型过滤器
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const { trackRender } = usePerformanceOptimization();
  
  // 当dropdown状态改变时，给app容器添加/移除类名
  useEffect(() => {
    const appElement = document.querySelector('.app');
    if (appElement) {
      if (isOpen) {
        appElement.classList.add('dropdown-open');
      } else {
        appElement.classList.remove('dropdown-open');
      }
    }
    
    // 清理函数
    return () => {
      const appElement = document.querySelector('.app');
      if (appElement) {
        appElement.classList.remove('dropdown-open');
      }
    };
  }, [isOpen]);
  
  // 使用新的币安交易对Hook
  const { searchPairs, loading, error, allPairs } = useBinanceTradingPairs();
  
  // 防抖搜索查询
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  useEffect(() => {
    trackRender('SearchDropdown');
  });

  // 调试日志
  useEffect(() => {
    console.log('[SearchDropdown] Debug info:', {
      loading,
      error,
      allPairsLength: allPairs.length,
      debouncedSearchQuery,
      selectedPairs,
      filteredPairsLength: filteredPairs.length,
      isOpen
    });
  }, [loading, error, allPairs.length, debouncedSearchQuery, selectedPairs, filteredPairs.length, isOpen]);

  // 使用useCallback来稳定搜索函数的引用
  const performSearch = useCallback(() => {
    try {
      const results = searchPairs(debouncedSearchQuery, selectedPairs, typeFilter);
      setFilteredPairs(results);
    } catch (err) {
      console.error('[SearchDropdown] Search error:', err);
      setFilteredPairs([]);
    }
  }, [searchPairs, debouncedSearchQuery, selectedPairs, typeFilter]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      // 检查点击是否在搜索容器或下拉框内
      if (searchRef.current && !searchRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setIsOpen(e.target.value.length > 0 || !e.target.value);
  };

  const handleSelectPair = (pair) => {
    console.log('[SearchDropdown] Selecting pair:', pair.symbol, 'Type:', pair.type);
    // 传递完整的pair对象，包含类型信息
    onAddPair(pair);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // 如果还没有搜索结果，立即触发一次搜索
    if (filteredPairs.length === 0 && !loading) {
      try {
        const results = searchPairs('', selectedPairs, typeFilter);
        setFilteredPairs(results);
      } catch (err) {
        console.error('[SearchDropdown] Focus search error:', err);
      }
    }
  };

  // 获取类型标识和颜色
  const getTypeInfo = (type) => {
    switch (type) {
      case 'spot':
        return { label: '现货', color: '#52c41a', icon: 'S' };
      case 'futures':
        return { label: '合约', color: '#1890ff', icon: 'F' };
      case 'alpha':
        return { label: 'Alpha', color: '#f5a623', icon: 'A' };
      default:
        return { label: '未知', color: '#999', icon: '?' };
    }
  };

  return (
    <>
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
      </div>
      
      {isOpen && (
        <div 
          className="dropdown show" 
          ref={dropdownRef}
        >
          {/* 类型过滤器（暂时隐藏Alpha） */}
          <div className="type-filters">
            <button 
              className={`type-filter ${typeFilter === null ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SearchDropdown] Setting type filter to: null');
                setTypeFilter(null);
              }}
            >
              全部
            </button>
            <button 
              className={`type-filter ${typeFilter === 'spot' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SearchDropdown] Setting type filter to: spot');
                setTypeFilter('spot');
              }}
            >
              现货
            </button>
            <button 
              className={`type-filter ${typeFilter === 'futures' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SearchDropdown] Setting type filter to: futures');
                setTypeFilter('futures');
              }}
            >
              合约
            </button>
            {/* 暂时隐藏Alpha按钮 */}
            {/*
            <button 
              className={`type-filter ${typeFilter === 'alpha' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SearchDropdown] Setting type filter to: alpha');
                setTypeFilter('alpha');
              }}
            >
              Alpha
            </button>
            */}
          </div>
          
          {error ? (
            <div className="dropdown-item error">
              ⚠️ 加载失败: {error}
            </div>
          ) : filteredPairs.length > 0 ? (
            filteredPairs.map((pair, index) => {
              const typeInfo = getTypeInfo(pair.type);
              return (
                <div
                  key={`${pair.originalSymbol || pair.symbol}-${pair.type}-${index}`}
                  className="dropdown-item compact"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectPair(pair);
                  }}
                >
                  <span className="pair-symbol">{pair.symbol}</span>
                  <span 
                    className="type-badge" 
                    style={{ backgroundColor: typeInfo.color }}
                    title={typeInfo.label}
                  >
                    {typeInfo.icon}
                  </span>
                </div>
              );
            })
          ) : searchQuery.trim() ? (
            <div className="dropdown-item">
              没有找到匹配的交易对 (共{allPairs.length}个可用)
            </div>
          ) : loading ? (
            <div className="dropdown-item">
              正在加载交易对...
            </div>
          ) : allPairs.length > 0 ? (
            <div className="dropdown-item">
              输入关键词搜索交易对，或选择类型过滤 (共{allPairs.length}个可用)
            </div>
          ) : (
            <div className="dropdown-item">
              暂无可用的交易对
            </div>
          )}
        </div>
      )}
    </>
  );
};

// 交易对卡片组件
export const TradingPairCard = ({ 
  pair, 
  priceData, 
  isConnected, 
  mode, 
  onRemove,
  pairType = 'spot' // 新增交易对类型参数
}) => {
  const [showDelete, setShowDelete] = useState(false);
  const { trackRender } = usePerformanceOptimization();
  
  useEffect(() => {
    trackRender('TradingPairCard');
  });

  // 获取类型标识和颜色
  const getTypeInfo = (type) => {
    switch (type) {
      case 'spot':
        return { label: '现货', color: '#52c41a', icon: 'S' };
      case 'futures':
        return { label: '合约', color: '#1890ff', icon: 'F' };
      case 'alpha':
        return { label: 'Alpha', color: '#f5a623', icon: 'A' };
      default:
        return { label: '未知', color: '#999', icon: '?' };
    }
  };

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

  const typeInfo = getTypeInfo(pairType);

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
          typeInfo={typeInfo}
        />
      ) : (
        <ProfessionalCardContent 
          pair={pair}
          priceData={priceData}
          trendClass={trendClass}
          changeClass={changeClass}
          arrow={arrow}
          typeInfo={typeInfo}
          pairType={pairType}
        />
      )}
    </div>
  );
};

// 简洁模式卡片内容
const SimpleCardContent = ({ pair, priceData, trendClass, changeClass, arrow, typeInfo }) => (
  <div className="simple-content">
    <div className="simple-header">
      <div className="pair-name-section">
        <span className="pair-name">{pair}</span>
        <span 
          className="type-badge small" 
          style={{ backgroundColor: typeInfo.color }}
          title={typeInfo.label}
        >
          {typeInfo.icon}
        </span>
      </div>
      <div className="price-info">
        <span className={`price ${trendClass}`}>
          {formatPrice(priceData.price)}
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
const ProfessionalCardContent = ({ pair, priceData, trendClass, changeClass, arrow, typeInfo, pairType }) => (
  <div className="professional-content">
    <div className="professional-header">
      <div className="pair-name-section">
        <span className="pair-name">{pair}</span>
        <span 
          className="type-badge small" 
          style={{ backgroundColor: typeInfo.color }}
          title={typeInfo.label}
        >
          {typeInfo.icon}
        </span>
      </div>
      <div className="professional-price-info">
        <span className={`price ${trendClass}`}>
          {formatPrice(priceData.price)}
        </span>
        <span className={`trend-arrow ${trendClass}`}>{arrow}</span>
        <span className={`change-percent ${changeClass}`}>
          {priceData.changePercent}%
        </span>
      </div>
    </div>
    <CandlestickChart symbol={pair} priceData={priceData} pairType={pairType} />
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

// 智能价格格式化函数
const formatPrice = (price) => {
  if (price === 0 || price === null || price === undefined) {
    return '$0.00';
  }
  
  const num = parseFloat(price);
  if (isNaN(num)) {
    return '$0.00';
  }
  
  // 根据价格范围动态调整小数位数
  if (num >= 1000) {
    // 大于1000：显示2位小数
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (num >= 1) {
    // 1-1000：显示4位小数
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else if (num >= 0.01) {
    // 0.01-1：显示6位小数
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  } else if (num >= 0.0001) {
    // 0.0001-0.01：显示8位小数
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  } else {
    // 小于0.0001：科学记数法或显示更多位数
    if (num < 0.000001) {
      return '$' + num.toExponential(4);
    } else {
      return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 10 });
    }
  }
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