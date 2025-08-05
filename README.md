# Binance Widget

一个精致小巧的币安交易对价格监控桌面小部件，支持 macOS 和 Windows。

## 功能特性

- 🔄 实时价格更新（WebSocket连接币安API）
- 📊 显示当日涨跌幅和百分比
- 📈 显示最高价、最低价和成交量
- 🎯 支持主流交易对快速切换
- 🪟 小窗口设计，支持置顶显示
- 🎨 精美的渐变UI设计

## 技术栈

- **框架**: Electron + React
- **样式**: CSS3 渐变设计
- **数据源**: 币安WebSocket API
- **打包**: electron-builder

## 开发运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run electron-dev

# 构建应用
npm run build

# 打包应用
npm run dist
```

## 支持的交易对

- BTC/USDT
- ETH/USDT  
- BNB/USDT
- ADA/USDT
- SOL/USDT

## 项目结构

```
├── public/
│   ├── electron.js      # Electron主进程
│   └── index.html       # HTML模板
├── src/
│   ├── App.js          # React主组件
│   ├── App.css         # 样式文件
│   └── index.js        # React入口
└── package.json        # 项目配置
```

## 开发说明

- 窗口尺寸：320x240px（可调整到300-400px宽度）
- 支持置顶显示，方便监控价格
- 实时WebSocket连接，数据更新及时
- 响应式设计，适配不同窗口大小

## 打包分发

```bash
# 打包macOS版本
npm run dist

# 打包后的文件在 dist/ 目录下
```

打包后会生成：
- macOS: `.dmg` 安装包
- Windows: `.exe` 安装程序

## 许可证

MIT License