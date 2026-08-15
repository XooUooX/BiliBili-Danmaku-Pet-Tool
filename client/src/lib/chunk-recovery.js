const RELOAD_GUARD_KEY = 'bilibili_chunk_reload_attempted';
const RELOAD_GUARD_PARAM = '__chunk_reload';
const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed|Unable to preload CSS|Failed to load module script/i;

function errorText(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return [error.name, error.message, error.reason?.message, error.cause?.message]
    .filter(Boolean)
    .join(' ');
}

export function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(errorText(error));
}

export function attemptChunkRecovery(error) {
  if (!isChunkLoadError(error)) return false;

  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    // sessionStorage 不可用时改用地址参数记录，仍然只自动恢复一次。
    const url = new URL(window.location.href);
    if (url.searchParams.get(RELOAD_GUARD_PARAM) === '1') return false;
    url.searchParams.set(RELOAD_GUARD_PARAM, '1');
    window.location.replace(url.toString());
    return true;
  }
}

export function installChunkRecovery() {
  window.addEventListener('vite:preloadError', event => {
    const error = event.payload || event;
    if (attemptChunkRecovery(error)) event.preventDefault();
  });

  window.addEventListener('unhandledrejection', event => {
    if (attemptChunkRecovery(event.reason)) event.preventDefault();
  });
}

export function clearChunkRecoveryGuardLater() {
  // 页面稳定运行一段时间后再解锁，既避免刷新死循环，也允许未来发布新版本时再次恢复。
  window.setTimeout(clearChunkRecoveryGuard, 15000);
}

export function clearChunkRecoveryGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // 忽略禁用存储的浏览器环境。
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has(RELOAD_GUARD_PARAM)) {
    url.searchParams.delete(RELOAD_GUARD_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
  }
}