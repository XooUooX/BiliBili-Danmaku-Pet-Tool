const express = require('express');
const db = require('../db');
const payment = require('../services/payment');
const balanceService = require('../services/balance');

const router = express.Router();

// 标记订单已支付并加余额（带幂等：仅 pending -> paid 才加款）
// 使用行级锁防止并发竞态
async function markPaid(orderNo, tradeNo, channelType) {
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    
    // 用 FOR UPDATE 加行级锁，防止并发竞态
    const [rows] = await conn.execute(
      'SELECT * FROM bili_orders WHERE order_no = ? FOR UPDATE',
      [orderNo]
    );
    const order = rows[0];
    
    if (!order) {
      await conn.rollback();
      return false;
    }
    
    // 幂等检查
    if (order.status === 'paid') {
      await conn.rollback();
      return true;
    }
    
    // 仅 pending 订单才能标记为已支付
    if (order.status !== 'pending') {
      await conn.rollback();
      return false;
    }
    
    // 原子更新订单状态
    const [result] = await conn.execute(
      'UPDATE bili_orders SET status = "paid", trade_no = ?, paid_at = NOW() WHERE order_no = ? AND status = "pending"',
      [tradeNo || null, orderNo]
    );
    
    if (result.affectedRows === 1) {
      // 在事务内加余额并记录流水
      await conn.execute(
        'UPDATE bili_users SET balance = balance + ? WHERE id = ?',
        [order.amount, order.user_id]
      );
      const [balRows] = await conn.execute(
        'SELECT balance FROM bili_users WHERE id = ? FOR UPDATE',
        [order.user_id]
      );
      const balanceAfter = balRows[0] ? balRows[0].balance : 0;
      await conn.execute(
        'INSERT INTO bili_balance_logs (user_id, change_amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [order.user_id, order.amount, balanceAfter, 'recharge_' + channelType, `订单 ${orderNo} 充值`]
      );
    }
    
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ===== 易支付异步回调 =====
router.get('/notify/epay', async (req, res) => {
  const params = req.query;
  if (!payment.epayVerify(params)) return res.send('fail');
  if (params.trade_status === 'TRADE_SUCCESS') {
    try {
      await markPaid(params.out_trade_no, params.trade_no, 'epay');
    } catch (e) {
      return res.send('fail');
    }
  }
  res.send('success');
});

// ===== 支付宝异步回调 =====
router.post('/notify/alipay', async (req, res) => {
  const params = req.body;
  if (!payment.alipayVerify(params)) return res.send('fail');
  if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
    try {
      await markPaid(params.out_trade_no, params.trade_no, 'alipay');
    } catch (e) {
      return res.send('fail');
    }
  }
  res.send('success');
});

// 查询订单状态（前端轮询支付结果用）
router.get('/status/:orderNo', async (req, res) => {
  const order = await db.queryOne('SELECT status FROM bili_orders WHERE order_no = ?', [
    req.params.orderNo
  ]);
  res.json({ status: order ? order.status : 'unknown' });
});

module.exports = router;
