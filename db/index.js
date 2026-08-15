const mysql = require('mysql2/promise');
const config = require('../config');

// 创建连接池（不指定 database，便于初始化时先建库）
let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

// 通用查询封装
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

// 取单行
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { getPool, query, queryOne };
