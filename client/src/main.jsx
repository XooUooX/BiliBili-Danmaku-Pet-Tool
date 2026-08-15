import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { ThemeProvider } from './hooks/use-theme';
import { clearChunkRecoveryGuardLater, installChunkRecovery } from './lib/chunk-recovery';
import './index.css';

installChunkRecovery();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('页面缺少根节点 #root');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

window.__APP_STARTED__ = true;
window.clearTimeout(window.__APP_BOOT_TIMER__);
clearChunkRecoveryGuardLater();