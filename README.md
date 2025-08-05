# GoldSift Widget

一个轻量级的加密货币价格监控桌面小部件，提供实时价格数据和市场信息。基于 Electron 和 React 构建，支持 macOS 和 Windows 平台。

## 功能特性

- 🔄 **实时价格监控** - 通过 WebSocket 连接获取实时加密货币价格数据
- 📊 **完整市场数据** - 显示当前价格、当前涨跌情况
- 🎯 **多币种支持** - 支持主流交易对快速切换（BTC/USDT, ETH/USDT, BNB/USDT 等）
- 🪟 **桌面小部件** - 小窗口设计，支持置顶显示，不干扰其他应用
- 🎨 **现代化界面** - 精美的 UI 设计，支持实时数据可视化
- ⚡ **轻量高效** - 低资源占用，快速启动

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
# 启动开发服务器和 Electron
npm run electron-dev

# 仅启动 React 开发服务器
npm start

# 快速启动 Electron（需要先构建）
npm run electron-quick
```

### 构建和打包
```bash
# 构建 React 应用
npm run build

# 打包为可分发的应用程序
npm run dist

# 仅打包 Electron 应用
npm run electron-pack
```

### 测试
```bash
npm test
```

## 打包分发

运行打包命令后，会在 `dist/` 目录生成对应平台的安装包：

- **macOS**: `.dmg` 安装包
- **Windows**: `.exe` 安装程序

打包配置支持自动签名和更新机制。

## 技术架构

- **前端框架**: React 18
- **桌面框架**: Electron
- **数据源**: Binance WebSocket API
- **构建工具**: Create React App + electron-builder
- **样式**: CSS3 + 现代化渐变设计

## 项目结构

```
├── public/
│   ├── electron.js      # Electron 主进程
│   ├── index.html       # HTML 模板
│   └── preload.js       # 预加载脚本
├── src/
│   ├── App.js          # 主应用组件
│   ├── App.css         # 样式文件
│   ├── components/     # React 组件
│   ├── hooks/          # 自定义 Hooks
│   └── utils/          # 工具函数
├── icons/              # 应用图标
└── package.json        # 项目配置
```

## 开发指南

- 窗口尺寸：320x260px（可在 300-400px 宽度，200-350px 高度范围内调整）
- 支持置顶显示，方便实时监控
- WebSocket 连接状态指示器
- 响应式设计，适配不同窗口大小

## 许可证

MIT License