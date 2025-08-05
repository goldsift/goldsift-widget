# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Binance Widget - a lightweight desktop application built with Electron and React that provides real-time cryptocurrency price monitoring. The app displays live price data for popular trading pairs (BTC/USDT, ETH/USDT, etc.) via Binance's WebSocket API in a small, always-on-top desktop widget.

## Development Commands

### Running the Application
- `npm run electron-dev` - Start both React dev server and Electron in development mode
- `npm run electron-quick` - Start Electron directly with dev flag (requires built React app)
- `npm start` - Start React development server only (port 3000)
- `npm run electron` - Start Electron with production build

### Building and Distribution
- `npm run build` - Build React app for production
- `npm run dist` - Full build and package for distribution (creates .dmg/.exe)
- `npm run electron-pack` - Package Electron app (runs build first)

### Testing
- `npm test` - Run React test suite

## Architecture

### Application Structure
- **Electron Main Process** (`public/electron.js`): Creates and manages the desktop window with specific constraints (320x260px, always-on-top, resizable within limits)
- **React Frontend** (`src/App.js`): Handles UI rendering and WebSocket connection to Binance API
- **Entry Point** (`src/index.js`): Standard React DOM root rendering

### Key Technical Details
- **WebSocket Integration**: Direct connection to `wss://stream.binance.com:9443/ws/` for real-time price data
- **Window Configuration**: Always-on-top desktop widget with size constraints (300-400px width, 200-350px height)
- **Security**: Uses `nodeIntegration: true` and `contextIsolation: false` (legacy Electron security model)
- **Supported Trading Pairs**: BTCUSDT, ETHUSDT, BNBUSDT, ADAUSDT, SOLUSDT

### Data Flow
1. User selects trading pair from dropdown
2. App establishes WebSocket connection to Binance ticker endpoint
3. Real-time price data is parsed and displayed (current price, 24h change, high/low, volume)
4. Connection status indicator shows WebSocket state

### Build Configuration
- **Target Platforms**: macOS (.dmg) and Windows (.exe)
- **Electron Builder**: Configured for desktop app packaging
- **Output Directory**: `dist/` for packaged applications
- **App Bundle**: Includes `build/**/*`, `public/electron.js`, and `node_modules/**/*`