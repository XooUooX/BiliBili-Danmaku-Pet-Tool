const axios = require('axios');
const FormData = require('form-data');
const settings = require('./settings');

/**
 * 上传图片到兰空图床
 * @param {Buffer} fileBuffer - 图片文件 buffer
 * @param {string} filename - 文件名
 * @param {number} strategyId - 存储策略 ID（可选）
 * @returns {Promise<Object>} 上传结果
 */
async function uploadImage(fileBuffer, filename, strategyId = null) {
  const config = settings.getLskyConfig();
  
  if (!config.enabled) {
    throw new Error('图床功能未启用');
  }
  
  if (!config.apiUrl || !config.token) {
    throw new Error('图床配置不完整，请先在设置中配置 API 地址和令牌');
  }
  
  // 创建表单数据
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: filename,
    contentType: getContentType(filename)
  });
  
  // 如果指定了存储策略 ID
  if (strategyId || config.strategyId) {
    formData.append('strategy_id', strategyId || config.strategyId);
  }
  
  try {
    // 调用兰空图床 API
    const response = await axios.post(
      `${config.apiUrl}/api/v1/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/json'
        },
        timeout: 30000 // 30秒超时
      }
    );
    
    // 检查响应
    // Lsky Pro v1/v2 API 响应格式：{ status: true/false, message: '...', data: {...} }
    if (response.data && response.data.status === true) {
      // 兼容 v1 和 v2 的响应格式
      const links = response.data.data.links || response.data.data;
      return {
        success: true,
        url: links.url,
        thumbnail: links.thumbnail_url || links.thumbnail || links.url,
        data: response.data.data
      };
    } else {
      throw new Error(response.data?.message || '上传失败');
    }
  } catch (error) {
    if (error.response) {
      // 服务器返回错误
      const msg = error.response.data?.message || error.response.statusText;
      throw new Error(`图床上传失败: ${msg}`);
    } else if (error.request) {
      // 请求发出但无响应
      throw new Error('图床服务器无响应，请检查 API 地址配置');
    } else {
      // 其他错误
      throw new Error(`图床上传错误: ${error.message}`);
    }
  }
}

/**
 * 根据文件名获取 MIME 类型
 */
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * 验证文件是否为图片
 */
function isValidImageFile(filename, allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']) {
  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * 验证文件大小
 */
function isValidFileSize(fileSize, maxSizeMB = 10) {
  return fileSize <= maxSizeMB * 1024 * 1024;
}

module.exports = {
  uploadImage,
  isValidImageFile,
  isValidFileSize
};
