import React from 'react';
import {
  attemptChunkRecovery,
  clearChunkRecoveryGuard,
  isChunkLoadError
} from '@/lib/chunk-recovery';

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  boxSizing: 'border-box',
  color: '#18181b',
  background: '#f8fafc',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const cardStyle = {
  width: '100%',
  maxWidth: '460px',
  padding: '32px',
  border: '1px solid #e4e4e7',
  borderRadius: '18px',
  background: '#ffffff',
  boxShadow: '0 16px 45px rgba(15, 23, 42, 0.08)',
  textAlign: 'center'
};

const buttonStyle = {
  minWidth: '128px',
  padding: '11px 18px',
  border: 0,
  borderRadius: '10px',
  color: '#ffffff',
  background: '#2563eb',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer'
};

export default class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('页面渲染失败:', error, info);
    attemptChunkRecovery(error);
  }

  reload = () => {
    clearChunkRecoveryGuard();
    window.location.reload();
  };

  goHome = () => {
    clearChunkRecoveryGuard();
    window.location.assign('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkFailed = isChunkLoadError(error);
    return (
      <main style={pageStyle}>
        <section style={cardStyle} role="alert">
          <div style={{ fontSize: '38px', lineHeight: 1, marginBottom: '18px' }}>!</div>
          <h1 style={{ margin: '0 0 10px', fontSize: '22px' }}>
            {chunkFailed ? '页面版本已更新' : '页面加载失败'}
          </h1>
          <p style={{ margin: '0 0 24px', color: '#71717a', fontSize: '14px', lineHeight: 1.7 }}>
            {chunkFailed
              ? '浏览器加载到了旧版页面资源，请重新加载以获取最新版本。'
              : '页面运行时遇到了异常，请重新加载后再试。'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={this.reload}>重新加载</button>
            <button
              type="button"
              style={{ ...buttonStyle, color: '#3f3f46', background: '#f4f4f5' }}
              onClick={this.goHome}
            >
              返回首页
            </button>
          </div>
        </section>
      </main>
    );
  }
}