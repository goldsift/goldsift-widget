// electron.d.ts - Electron API类型声明
export interface ElectronAPI {
  // 窗口管理
  resizeWindow: (tradingPairsCount: number, mode: 'simple' | 'professional') => Promise<{width: number, height: number} | null>;
  getWindowSize: () => Promise<{width: number, height: number} | null>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  
  // 设置管理
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  loadSettings: () => Promise<AppSettings>;
  
  // 应用信息
  platform: string;
  version: string;
  
  // 开发者工具
  openDevTools: () => void;
}

export interface AppSettings {
  selectedPairs: string[];
  mode: 'simple' | 'professional';
  alwaysOnTop: boolean;
  windowPosition?: {x: number, y: number};
}

export interface TradingPairData {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  high: number;
  low: number;
  volume: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}