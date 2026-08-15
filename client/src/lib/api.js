// 统一 API 请求封装：同源 session 认证，自动带 cookie
async function request(method, url, body) {
  const opts = {
    method,
    headers: {},
    credentials: 'same-origin'
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      // FormData 由浏览器自动设置 Content-Type（含 boundary）
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.message) || `请求失败 (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: url => request('GET', url),
  post: (url, body) => request('POST', url, body)
};
