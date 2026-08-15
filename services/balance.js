const db = require('../db');

// 原子地增加用户余额并记录流水
// type: recharge_epay / recharge_alipay / recharge_wxpay / card / admin / consume
async function changeBalance(userId, amount, type, remark = '') {
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE bili_users SET balance = balance + ? WHERE id = ?', [amount, userId]);
    const [rows] = await conn.execute('SELECT balance FROM bili_users WHERE id = ? FOR UPDATE', [userId]);
    const balanceAfter = rows[0] ? rows[0].balance : 0;
    await conn.execute(
      'INSERT INTO bili_balance_logs (user_id, change_amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, balanceAfter, type, remark]
    );
    await conn.commit();
    return balanceAfter;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { changeBalance };
