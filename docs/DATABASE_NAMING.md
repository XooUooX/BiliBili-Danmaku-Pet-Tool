# 数据库表命名说明

## 命名规范

- 全部使用小写 `snake_case`。
- 全部统一使用项目级前缀 `bili_`。
- 表名使用复数或明确的业务集合名称。
- 建表结构包含中文表备注及字段备注。

## 表名迁移清单

| 原表名 | 新表名 | 表用途 |
| --- | --- | --- |
| `users` | `bili_users` | 平台用户与管理员账号 |
| `oauth_identities` | `bili_oauth_identities` | 用户第三方登录身份与授权信息 |
| `email_codes` | `bili_email_codes` | 邮箱验证码及使用状态 |
| `bili_accounts` | `bili_accounts` | 用户绑定的哔哩哔哩账号 |
| `danmu_tasks` | `bili_danmu_tasks` | 直播间弹幕发送任务 |
| `daily_tasks` | `bili_daily_tasks` | 哔哩哔哩账号每日任务配置 |
| `daily_task_logs` | `bili_daily_task_logs` | 每日任务执行日志 |
| `danmu_logs` | `bili_danmu_logs` | 弹幕发送执行日志 |
| `task_templates` | `bili_task_templates` | 弹幕任务预设模板 |
| `duration_packages` | `bili_duration_packages` | 账号服务时长套餐 |
| `orders` | `bili_orders` | 用户在线支付订单 |
| `cards` | `bili_cards` | 余额充值卡密 |
| `card_redemptions` | `bili_card_redemptions` | 卡密兑换明细 |
| `balance_logs` | `bili_balance_logs` | 用户余额变动流水 |
| `settings` | `bili_settings` | 系统设置键值配置 |
| `live_rooms` | `bili_live_rooms` | 后台维护的在线直播间 |
| `lottery_prizes` | `bili_lottery_prizes` | 抽奖奖品配置 |
| `lottery_records` | `bili_lottery_records` | 用户抽奖记录 |
| `friend_links` | `bili_friend_links` | 网站友情链接 |
| `tickets` | `bili_tickets` | 用户支持工单 |
| `ticket_messages` | `bili_ticket_messages` | 工单对话消息 |
| `pet_level_logs` | `bili_pet_level_logs` | 弹幕宠物等级变化记录 |

## 迁移方式

已有数据库可手动执行：

```powershell
npm.cmd run migrate-table-names
```

迁移脚本具有以下保护：

1. 仅在旧表存在且新表不存在时重命名。
2. 旧表和新表同时存在时立即停止，避免覆盖或合并错误数据。
3. 使用同一条 `RENAME TABLE` 语句批量迁移，保留原数据、索引和外键关系。
4. 自动为已有表同步中文表备注和字段备注。
5. 服务启动及 `npm run init-db` 时也会执行相同的幂等检查。

统一映射和备注配置位于：

- `db/tableMetadata.js`
- `db/migrateTableNames.js`
