const { contextBridge, ipcRenderer } = require('electron');

// 通过contextBridge安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口管理API
  resizeWindow: (tradingPairsCount, mode) => 
    ipcRenderer.invoke('resize-window', { tradingPairsCount, mode }),
  
  toggleMinimizeWindow: (isMinimized) =>
    ipcRenderer.invoke('toggle-minimize-window', isMinimized),
  
  getWindowSize: () => 
    ipcRenderer.invoke('get-window-size'),
  
  setAlwaysOnTop: (flag) => 
    ipcRenderer.invoke('set-always-on-top', flag),
  
  // 设置管理API
  saveSettings: (settings) => 
    ipcRenderer.invoke('save-settings', settings),
  
  loadSettings: () => 
    ipcRenderer.invoke('load-settings'),
  
  // 应用信息API
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  
  // 开发者工具（仅开发模式）
  openDevTools: () => {
    if (process.env.NODE_ENV === 'development') {
      ipcRenderer.invoke('open-dev-tools');
    }
  }
});

// 错误处理
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded successfully');
  
  // 全局错误处理
  window.addEventListener('error', (event) => {
    console.error('Renderer process error:', event.error);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
});