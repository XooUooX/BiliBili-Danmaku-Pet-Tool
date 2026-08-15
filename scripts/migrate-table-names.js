'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');
const { migrateDatabase } = require('../db/migrateTableNames');
const { TABLE_RENAMES } = require('../db/tableMetadata');

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4'
  });

  try {
    const result = await migrateDatabase(connection);
    const [rows] = await connection.query(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()`
    );
    const existing = new Set(rows.map(row => row.table_name));
    const expected = [...new Set(Object.values(TABLE_RENAMES))];
    const present = expected.filter(tableName => existing.has(tableName));
    const missing = expected.filter(tableName => !existing.has(tableName));

    if (!result.renames.length && !result.comments.changedTables && !result.comments.changedColumns) {
      console.log('[--] 数据库表名及备注已经是最新状态');
    }
    console.log(`[OK] 已确认 ${present.length}/${expected.length} 张业务表使用统一的 bili_ 命名`);
    if (missing.length) {
      console.warn(`[提示] 尚未创建的业务表：${missing.join(', ')}`);
      console.warn('[提示] 如需补齐表结构，请执行 npm run init-db');
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('[错误] 数据库表名迁移失败：', error.message);
  process.exit(1);
});
