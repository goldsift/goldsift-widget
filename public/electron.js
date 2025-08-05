const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;

// 窗口管理类
class WindowManager {
  constructor(window) {
    this.window = window;
    //this.minHeight = 96;  // 控制栏 + 最小内容
    this.baseWidth = 280;
  }
  
  calculateHeight(tradingPairsCount, mode) {
    const controlBarHeight = 40;
    // CSS实际高度：简洁模式44px，专业模式104px
    const cardHeight = mode === 'simple' ? 44 : 104;
    // 卡片间距：margin-bottom: 4px（最后一个卡片没有margin）
    const cardSpacing = tradingPairsCount > 1 ? (tradingPairsCount - 1) * 4 : 0;
    // 容器内边距：padding: 8px（上下各8px）
    const containerPadding = 16;
    // 减少额外空间，只保留必要的buffer
    const extraSpace = mode === 'simple' ? 20 : 20;
    
    const calculatedHeight = controlBarHeight + containerPadding + (tradingPairsCount * cardHeight) + cardSpacing + extraSpace;
    
    console.log(`Height calculation: control(${controlBarHeight}) + padding(${containerPadding}) + cards(${tradingPairsCount} × ${cardHeight}) + spacing(${cardSpacing}) + extra(${extraSpace}) = ${calculatedHeight}`);
    
    return calculatedHeight;
  }
  
  async updateSize(tradingPairsCount, mode) {
    const calculatedHeight = this.calculateHeight(tradingPairsCount, mode);
    // 去除标题高度判断
    const titleBarHeight = 10;
    
    // 获取屏幕尺寸并计算80%高度
    const { workAreaSize } = screen.getPrimaryDisplay();
    const maxScreenHeight = Math.floor(workAreaSize.height * 0.8);
    const maxContentHeight = maxScreenHeight - titleBarHeight;
    
    // 确保内容高度不超过屏幕80%限制
    const actualContentHeight = Math.min(calculatedHeight, maxContentHeight);
    
    // setSize设置的是整个窗口高度（包含标题栏），所以要加上标题栏高度
    const windowHeight = actualContentHeight + titleBarHeight;
    
    console.log(`Screen height: ${workAreaSize.height}, Max height (80%): ${maxScreenHeight}, Content height: ${actualContentHeight}, Window height: ${windowHeight}`);
    
    // 使用 setSize 的第三个参数 animate = false 来确保立即调整
    await this.window.setSize(this.baseWidth, windowHeight, false);
    return { width: this.baseWidth, height: actualContentHeight };
  }
}

let windowManager;
let lastWindowState = { width: 280, height: 200, x: 100, y: 100 }; // 保存上次窗口状态
let minimizedWindow = null; // 缩小状态的无边框窗口

function createMinimizedWindow(x, y) {
  minimizedWindow = new BrowserWindow({
    width: 70,
    height: 70,
    x: x,
    y: y,
    frame: false, // 无边框
    resizable: false,
    alwaysOnTop: true,
    transparent: true, // 透明背景
    backgroundColor: null, // 设置为null让Electron处理透明
    hasShadow: false, // 禁用阴影
    vibrancy: process.platform === 'darwin' ? 'ultra-dark' : null, // macOS透明效果
    visualEffectState: process.platform === 'darwin' ? 'active' : null,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // 防止背景优化影响透明度
      offscreen: false // 禁用离屏渲染
    },
    show: false,
    skipTaskbar: true, // 不在任务栏显示
    title: '币看'
  });

  // 额外的透明设置
  minimizedWindow.once('ready-to-show', () => {
    // 强制设置透明背景
    minimizedWindow.webContents.executeJavaScript(`
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
    `);
    minimizedWindow.show();
  });

  // 加载同样的URL但传递minimized参数
  const isDev = process.env.ELECTRON_IS_DEV === 'true' || process.env.NODE_ENV === 'development';
  const startUrl = isDev 
    ? 'http://localhost:3000?minimized=true' 
    : `file://${path.join(__dirname, '../build/index.html')}?minimized=true`;
  
  minimizedWindow.loadURL(startUrl);

  minimizedWindow.on('closed', () => {
    minimizedWindow = null;
  });

  return minimizedWindow;
}

function createWindow() {
  // 获取屏幕尺寸并计算80%高度作为最大高度
  const { workAreaSize } = screen.getPrimaryDisplay();
  const maxScreenHeight = Math.floor(workAreaSize.height * 0.8);
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 320,
    height: 200, // 稍微增加高度给标题栏留空间
    minWidth: 300,
    minHeight: 100,
    maxWidth: 400,
    maxHeight: maxScreenHeight, // 使用屏幕高度的80%
    x: 100, // 设置初始位置，避免正中心
    y: 100,
    webPreferences: {
      nodeIntegration: false, // 禁用Node集成，提升安全性
      contextIsolation: true, // 启用上下文隔离
      enableRemoteModule: false, // 禁用remote模块
      preload: path.join(__dirname, 'preload.js') // 使用preload脚本
    },
    resizable: true,
    alwaysOnTop: true, // 窗口置顶
    frame: true, // 保留标题栏便于拖拽
    titleBarStyle: process.platform === 'darwin' ? 'default' : 'default', // 使用默认样式确保可拖动
    show: false, // 初始隐藏，等加载完再显示
    title: '币看', // 设置窗口标题
    icon: process.platform === 'darwin' ? null : path.join(__dirname, 'icon.png'),
  });

  // 加载应用 - 简化开发模式判断
  const isDev = process.env.ELECTRON_IS_DEV === 'true' || process.env.NODE_ENV === 'development';
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  
  mainWindow.loadURL(startUrl);

  // 当ready-to-show时显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 初始化窗口管理器
  windowManager = new WindowManager(mainWindow);

  // 当窗口被关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
    windowManager = null;
  });

  // 开发模式下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，除非用户用Cmd + Q确定地退出，否则绝大部分应用会保持激活状态
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC事件处理
ipcMain.handle('resize-window', async (event, { tradingPairsCount, mode }) => {
  if (windowManager) {
    return await windowManager.updateSize(tradingPairsCount, mode);
  }
  return null;
});

// 处理缩小/展开窗口状态
ipcMain.handle('toggle-minimize-window', async (event, isMinimized) => {
  if (isMinimized) {
    if (mainWindow) {
      // 保存当前窗口状态
      const bounds = mainWindow.getBounds();
      lastWindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      };
      
      // 计算缩小窗口的位置（居中）
      const newX = bounds.x + (bounds.width - 70) / 2;
      const newY = bounds.y + (bounds.height - 70) / 2;
      
      // 创建无边框的缩小窗口
      createMinimizedWindow(Math.round(newX), Math.round(newY));
      
      // 隐藏主窗口
      mainWindow.hide();
      
      return { width: 70, height: 70 };
    }
  } else {
    // 展开：关闭缩小窗口，显示主窗口
    if (minimizedWindow) {
      // 获取最小化窗口的当前位置
      const minimizedBounds = minimizedWindow.getBounds();
      
      // 计算主窗口应该出现的位置（以最小化窗口为中心）
      const newMainX = minimizedBounds.x - (lastWindowState.width - 70) / 2;
      const newMainY = minimizedBounds.y - (lastWindowState.height - 70) / 2;
      
      // 更新保存的窗口状态位置
      lastWindowState.x = Math.round(newMainX);
      lastWindowState.y = Math.round(newMainY);
      
      minimizedWindow.close();
    }
    
    if (mainWindow) {
      // 恢复主窗口到计算出的新位置
      mainWindow.setSize(lastWindowState.width, lastWindowState.height);
      mainWindow.setPosition(lastWindowState.x, lastWindowState.y);
      mainWindow.show();
      
      return { 
        width: lastWindowState.width, 
        height: lastWindowState.height 
      };
    }
  }
  return null;
});

// 获取窗口尺寸
ipcMain.handle('get-window-size', () => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    return { width: bounds.width, height: bounds.height };
  }
  return null;
});

// 设置窗口置顶状态
ipcMain.handle('set-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    return true;
  }
  return false;
});

// 开发工具控制
ipcMain.handle('open-dev-tools', () => {
  if (mainWindow && isDev) {
    mainWindow.webContents.openDevTools();
    return true;
  }
  return false;
});

// 用户设置管理
const fs = require('fs');
const os = require('os');

const settingsPath = path.join(os.homedir(), '.binance-widget-settings.json');

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('保存设置失败:', error);
    return false;
  }
});

ipcMain.handle('load-settings', async () => {
  try {
    const data = await fs.promises.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 如果文件不存在或读取失败，返回默认设置
    return {
      selectedPairs: ['BTC/USDT'],
      mode: 'simple',
      alwaysOnTop: true
    };
  }
});