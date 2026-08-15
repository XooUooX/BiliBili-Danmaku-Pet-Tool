'use strict';

const {
  TABLE_RENAMES,
  TABLE_COMMENTS,
  getColumnComments
} = require('./tableMetadata');

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function quoteString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function rowsOf(connection, sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return rows;
}

async function getExistingTables(connection) {
  const rows = await rowsOf(
    connection,
    `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()`
  );
  return new Set(rows.map(row => row.table_name));
}

async function migrateTableNames(connection, logger = console) {
  const existing = await getExistingTables(connection);
  const renames = [];

  for (const [oldName, newName] of Object.entries(TABLE_RENAMES)) {
    if (oldName === newName) continue;

    const hasOld = existing.has(oldName);
    const hasNew = existing.has(newName);
    if (hasOld && hasNew) {
      throw new Error(
        `数据库表名迁移冲突：${oldName} 与 ${newName} 同时存在。为避免覆盖数据，迁移已停止。`
      );
    }
    if (hasOld) renames.push([oldName, newName]);
  }

  if (!renames.length) return [];

  const renameSql = renames
    .map(([oldName, newName]) => `${quoteIdentifier(oldName)} TO ${quoteIdentifier(newName)}`)
    .join(',\n  ');
  await connection.query(`RENAME TABLE\n  ${renameSql}`);
  logger.log(`[OK] 已统一 ${renames.length} 张数据库表的名称`);
  return renames;
}

function getCreateTableSql(row) {
  return row['Create Table'] || row['Create View'] || Object.values(row)[1] || '';
}

function findColumnDefinition(createSql, columnName) {
  const escapedName = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*(\\\`${escapedName}\\\`\\s+.+?)(?:,)?$`, 'mi');
  const match = createSql.match(pattern);
  return match ? match[1].trim() : null;
}

function replaceColumnComment(definition, comment) {
  const withoutComment = definition.replace(/\s+COMMENT\s+'(?:\\.|''|[^'])*'/i, '');
  return `${withoutComment} COMMENT ${quoteString(comment)}`;
}

async function applyDatabaseComments(connection, logger = console) {
  const existing = await getExistingTables(connection);
  let changedTables = 0;
  let changedColumns = 0;

  for (const [logicalName, tableName] of Object.entries(TABLE_RENAMES)) {
    if (!existing.has(tableName)) continue;

    const [tableInfo] = await rowsOf(
      connection,
      `SELECT TABLE_COMMENT AS table_comment
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    const tableComment = TABLE_COMMENTS[logicalName] || '';
    if (tableInfo && tableInfo.table_comment !== tableComment) {
      await connection.query(
        `ALTER TABLE ${quoteIdentifier(tableName)} COMMENT = ${quoteString(tableComment)}`
      );
      changedTables += 1;
    }

    const columnComments = getColumnComments(logicalName);
    const columnRows = await rowsOf(
      connection,
      `SELECT COLUMN_NAME AS column_name, COLUMN_COMMENT AS column_comment
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    const pendingColumns = columnRows.filter(row => {
      const expected = columnComments[row.column_name];
      return expected && row.column_comment !== expected;
    });
    if (!pendingColumns.length) continue;

    const [createRow] = await rowsOf(
      connection,
      `SHOW CREATE TABLE ${quoteIdentifier(tableName)}`
    );
    const createSql = getCreateTableSql(createRow);
    const modifications = [];

    for (const row of pendingColumns) {
      const definition = findColumnDefinition(createSql, row.column_name);
      if (!definition) {
        logger.warn(`[跳过] 无法读取 ${tableName}.${row.column_name} 的完整字段定义`);
        continue;
      }
      modifications.push(
        `MODIFY COLUMN ${replaceColumnComment(definition, columnComments[row.column_name])}`
      );
    }

    if (modifications.length) {
      await connection.query(
        `ALTER TABLE ${quoteIdentifier(tableName)}\n  ${modifications.join(',\n  ')}`
      );
      changedColumns += modifications.length;
    }
  }

  if (changedTables || changedColumns) {
    logger.log(`[OK] 已补充数据库备注：${changedTables} 张表、${changedColumns} 个字段`);
  }
  return { changedTables, changedColumns };
}

async function migrateDatabase(connection, logger = console) {
  const renames = await migrateTableNames(connection, logger);
  const comments = await applyDatabaseComments(connection, logger);
  return { renames, comments };
}

module.exports = {
  migrateTableNames,
  applyDatabaseComments,
  migrateDatabase
};
