// 初始化数据库：建库、建表、创建默认管理员
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config');
const schema = require('../db/schema');
const { migrateTableNames, applyDatabaseComments } = require('../db/migrateTableNames');

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function ensureColumn(conn, table, column, definition, label = column) {
  if (await hasColumn(conn, table, column)) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`[OK] ${table} 表已补充 ${label} 列`);
  return true;
}

async function hasIndex(conn, table, indexName) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, indexName]
  );
  return rows.length > 0;
}

async function main() {
  const unsafeAdminPasswords = new Set(['admin888', 'replace-with-a-strong-password', '']);
  if (unsafeAdminPasswords.has(String(config.admin.password))) {
    throw new Error('请先在 .env 中设置安全的 ADMIN_PASSWORD，再初始化数据库');
  }
  // 1. 先用无 database 的连接创建数据库
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4'
  });

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
  );
  console.log(`[OK] 数据库 ${config.db.database} 已就绪`);
  await conn.changeUser({ database: config.db.database });

  // 兼容旧版本：先迁移旧表名，避免随后创建同名空表。
  await migrateTableNames(conn);

  // 2. 建表
  for (const sql of schema) {
    await conn.query(sql);
  }
  console.log(`[OK] 数据表已创建（共 ${schema.length} 张）`);

  // 2.1 增量迁移：为已存在的 bili_users 表补充 email 列
  // 增量迁移：逐列检查，兼容不同历史版本。
  await ensureColumn(conn, 'bili_users', 'email', 'VARCHAR(128) DEFAULT NULL AFTER username');
  await ensureColumn(conn, 'bili_users', 'qq', 'VARCHAR(20) DEFAULT NULL AFTER email');
  await ensureColumn(conn, 'bili_users', 'avatar', 'TEXT DEFAULT NULL AFTER qq');
  if (!(await hasIndex(conn, 'bili_users', 'email'))) {
    await conn.query('ALTER TABLE bili_users ADD INDEX email (email)');
    console.log('[OK] bili_users 表已补充 email 索引');
  }

  // 第三方登录身份表由 schema 的 CREATE TABLE IF NOT EXISTS 自动创建。
  const [oauthUserProviderIndex] = await conn.query(
    "SHOW INDEX FROM bili_oauth_identities WHERE Key_name = 'uniq_user_provider'"
  );
  if (oauthUserProviderIndex.length === 0) {
    const [duplicates] = await conn.query(
      `SELECT user_id, provider, COUNT(*) AS c
         FROM bili_oauth_identities
        GROUP BY user_id, provider
       HAVING COUNT(*) > 1
        LIMIT 1`
    );
    if (duplicates.length > 0) {
      throw new Error('bili_oauth_identities 存在同一用户重复绑定同一平台的数据，请先清理后再迁移');
    }
    await conn.query(
      'ALTER TABLE bili_oauth_identities ADD UNIQUE KEY uniq_user_provider (user_id, provider)'
    );
    console.log('[OK] bili_oauth_identities 表已增加用户/平台唯一约束');
  }
  const cardSchemaChanged = [
    await ensureColumn(conn, 'bili_cards', 'max_uses', 'INT NOT NULL DEFAULT 1 AFTER amount'),
    await ensureColumn(conn, 'bili_cards', 'used_count', 'INT NOT NULL DEFAULT 0 AFTER max_uses')
  ].some(Boolean);
  if (cardSchemaChanged) {
    // 已使用的旧卡密同步 used_count。
    await conn.query('UPDATE bili_cards SET used_count = 1 WHERE used = 1 AND used_count = 0');
  }

  // 为已存在的弹幕任务表补充所有调度与自动切换字段。
  await ensureColumn(conn, 'bili_danmu_tasks', 'schedule_type', "VARCHAR(16) NOT NULL DEFAULT 'fixed' AFTER room_id");
  await ensureColumn(conn, 'bili_danmu_tasks', 'interval_min', 'INT NOT NULL DEFAULT 300 AFTER interval_seconds');
  await ensureColumn(conn, 'bili_danmu_tasks', 'interval_max', 'INT NOT NULL DEFAULT 600 AFTER interval_min');
  await ensureColumn(conn, 'bili_danmu_tasks', 'preset', 'VARCHAR(32) DEFAULT NULL AFTER interval_max');
  await ensureColumn(conn, 'bili_danmu_tasks', 'auto_switch_room', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER enabled');
  await ensureColumn(conn, 'bili_danmu_tasks', 'room_category', 'VARCHAR(16) DEFAULT NULL AFTER auto_switch_room');

  // 2.4 增量迁移：bili_lottery_prizes 表 color 列改为 image 列
  const [lpCols] = await conn.query("SHOW COLUMNS FROM bili_lottery_prizes LIKE 'image'");
  if (lpCols.length === 0) {
    const [oldCol] = await conn.query("SHOW COLUMNS FROM bili_lottery_prizes LIKE 'color'");
    if (oldCol.length > 0) {
      await conn.query('ALTER TABLE bili_lottery_prizes CHANGE COLUMN color image VARCHAR(512) DEFAULT NULL');
    } else {
      await conn.query('ALTER TABLE bili_lottery_prizes ADD COLUMN image VARCHAR(512) DEFAULT NULL AFTER stock');
    }
    console.log('[OK] bili_lottery_prizes 表已将 color 列迁移为 image 列');
  }

  // 2.6 增量迁移：为已存在的 bili_duration_packages 表补充 description 列
  const [pkgCols] = await conn.query("SHOW COLUMNS FROM bili_duration_packages LIKE 'description'");
  if (pkgCols.length === 0) {
    await conn.query('ALTER TABLE bili_duration_packages ADD COLUMN description TEXT DEFAULT NULL AFTER price');
    console.log('[OK] bili_duration_packages 表已补充 description 列');
  }

  // 2.5 种子：默认任务模板（仅在表为空时插入）
  // 为已有数据库同步表备注和字段备注。
  await applyDatabaseComments(conn);

  const [tplRows] = await conn.query('SELECT COUNT(*) c FROM bili_task_templates');
  if (tplRows[0].c === 0) {
    const petIdle = ['修炼/双修/突破', '修仙/双修/突破', '修炼/突破', '修仙/突破', '双修/突破', '修炼', '修仙', '双修', '突破'][0].split('/').join('\n');
    const seeds = [
      ['pet_idle', '弹幕宠物', '弹宠挂机', 'random', 60, 300, 600, 'sequential', petIdle, 1],
      ['pet_sign', '弹幕宠物', '弹宠签到', 'daily', 60, 300, 600, 'sequential', '签到', 2],
      ['cat_idle', '猫猫养成', '猫猫挂机', 'random', 60, 300, 600, 'sequential', '喵', 3],
      ['cat_rob', '猫猫养成', '猫猫打劫', 'fixed', 3600, 300, 600, 'sequential', '打劫', 4],
      ['cat_fish', '猫猫养成', '猫猫钓鱼', 'fixed', 3600, 300, 600, 'sequential', '钓鱼', 5]
    ];
    for (const s of seeds) {
      await conn.query(
        `INSERT INTO bili_task_templates
           (preset_key, group_name, label, schedule_type, interval_seconds, interval_min, interval_max, mode, messages, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s
      );
    }
    console.log(`[OK] 已写入 ${seeds.length} 个默认任务模板`);
  }

  // 2.5 种子：默认时长套餐（仅在表为空时插入）
  const [pkgRows] = await conn.query('SELECT COUNT(*) c FROM bili_duration_packages');
  if (pkgRows[0].c === 0) {
    const pkgs = [
      ['周卡', 7, 7.0, 1],
      ['月卡', 30, 25.0, 2],
      ['季卡', 90, 68.0, 3],
      ['年卡', 365, 238.0, 4]
    ];
    for (const p of pkgs) {
      await conn.query(
        'INSERT INTO bili_duration_packages (name, days, price, sort_order) VALUES (?, ?, ?, ?)',
        p
      );
    }
    console.log(`[OK] 已写入 ${pkgs.length} 个默认时长套餐`);
  }

  // 3. 创建默认管理员
  const [rows] = await conn.execute('SELECT id FROM bili_users WHERE username = ?', [
    config.admin.username
  ]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await conn.execute(
      'INSERT INTO bili_users (username, password, is_admin, balance) VALUES (?, ?, 1, 0)',
      [config.admin.username, hash]
    );
    console.log(`[OK] 默认管理员已创建：${config.admin.username} / ${config.admin.password}`);
  } else {
    console.log(`[--] 管理员 ${config.admin.username} 已存在，跳过`);
  }

  await conn.end();
  console.log('初始化完成。');
  process.exit(0);
}

main().catch(err => {
  console.error('初始化失败:', err.message);
  process.exit(1);
});

