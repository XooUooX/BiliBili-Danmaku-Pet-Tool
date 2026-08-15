# 每日任务排查指南

## 1. 先查看执行日志

在用户中心打开“每日任务”，进入对应任务的执行日志。重点关注：

- 账号是否已激活、是否过期。
- B站 Cookie 是否失效。
- 接口返回码和失败原因。
- 是否有人连续点击“立即执行”。
- 多实例中是否重复启用了调度器。

常见返回码仅供排查参考，上游接口含义可能随时变化：

| 返回码 | 常见含义 | 建议 |
| --- | --- | --- |
| `-101` | 未登录或 Cookie 失效 | 重新绑定 B站账号 |
| `-111` | CSRF 校验失败 | 重新绑定账号，确认 Cookie 完整 |
| `-352` | 风控校验失败 | 暂停任务并稍后重试 |
| `-403` | 权限不足或风控 | 降低频率，不要连续执行 |
| `65006` | 通常表示已经点赞 | 一般无需再次操作 |
| `73000` | 通常表示权益已领取 | 确认本月是否已完成 |

## 2. 区分“并发执行”和“重复执行”

每日任务使用 MySQL 命名锁，能够阻止同一个任务在同一时刻被多个请求或调度进程并发执行。

但以下操作仍会形成多轮独立日志：

- 第一轮结束后再次点击“立即执行”。
- 调度器自动执行结束后，用户又手动执行。
- 多实例配置错误，且任务之间并非同一时刻竞争锁。

“立即执行”是人工强制操作，不会因为当天或当月已经执行过而自动跳过整轮任务。充电任务尤其需要谨慎，因为再次执行可能再次消耗 B币。

## 3. 检查服务和调度器

控制台正常启动时应看到数据库连接成功和调度器启动信息。

多实例部署时：

- 仅一个实例设置 `SCHEDULER_ENABLED=true`。
- 其他实例设置 `SCHEDULER_ENABLED=false`。
- 所有实例连接同一个 MySQL 数据库，命名锁才能跨进程生效。

## 4. 检查账号状态

账号必须满足：

- `active = 1`
- 未超过 `expire_at`
- Cookie 与 CSRF Token 有效
- B站账号未被限制相关操作

## 5. 检查任务配置

### 每日任务

- 投币目标范围为 0–5 枚。
- 开启“同时点赞”时，即使今日投币经验已达到目标，程序仍可能按候选视频执行点赞。
- 指定 UP 主无法获取视频时，会尝试排行榜来源。
- 投币间隔较长是为了降低连续请求触发风控的概率。

### 充电任务

- 默认 50 电池，即 5 B币。
- 10 电池等于 1 B币。
- 每月自动调度只在到期时执行一次。
- 人工“立即执行”会立刻调用接口，不应连续点击。

### 大会员权益

- 部分权益每月只能领取一次。
- 已领取通常应视为业务完成，而不是重复重试。

## 6. 数据库排查

查看启用任务：

~~~sql
SELECT t.id, t.task_key, t.enabled, t.last_run_at,
       a.nickname, a.active, a.expire_at, u.status
FROM bili_daily_tasks AS t
JOIN bili_accounts AS a ON t.account_id = a.id
JOIN bili_users AS u ON a.user_id = u.id
WHERE t.enabled = 1;
~~~

查看最近日志：

~~~sql
SELECT id, daily_task_id, task_key, success, code, result, created_at
FROM bili_daily_task_logs
ORDER BY id DESC
LIMIT 100;
~~~

检查同一任务短时间内是否执行多轮：

~~~sql
SELECT daily_task_id,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS minute_bucket,
       COUNT(*) AS log_count
FROM bili_daily_task_logs
WHERE created_at >= NOW() - INTERVAL 1 DAY
GROUP BY daily_task_id, minute_bucket
ORDER BY minute_bucket DESC;
~~~

## 7. 推荐处理顺序

1. 停止连续点击“立即执行”。
2. 查看当前任务最新一轮完整日志。
3. 确认账号状态和 Cookie。
4. 确认只有一个实例启用调度器。
5. 对风控错误延长等待时间，不要立即重试。
6. 对充电、投币等消耗型任务核对真实余额和平台记录。
