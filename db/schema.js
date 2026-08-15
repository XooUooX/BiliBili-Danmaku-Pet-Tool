// 所有建表语句，按依赖顺序排列
module.exports = [
  // 用户表
  `CREATE TABLE IF NOT EXISTS bili_users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '登录用户名',
    email VARCHAR(128) DEFAULT NULL COMMENT '绑定邮箱',
    qq VARCHAR(20) DEFAULT NULL COMMENT '联系QQ',
    avatar TEXT DEFAULT NULL COMMENT '用户头像地址',
    password VARCHAR(255) NOT NULL COMMENT '登录密码哈希',
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '账户可用余额',
    is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否管理员：1是，0否',
    status TINYINT(1) NOT NULL DEFAULT 1 COMMENT '账号状态：1正常，0禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '平台用户与管理员账号'`,

  // 第三方登录身份
  `CREATE TABLE IF NOT EXISTS bili_oauth_identities (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    provider VARCHAR(32) NOT NULL COMMENT '第三方平台标识',
    social_uid VARCHAR(191) NOT NULL COMMENT '第三方平台用户唯一标识',
    access_token TEXT DEFAULT NULL COMMENT '第三方授权令牌',
    nickname VARCHAR(191) DEFAULT NULL COMMENT '第三方平台昵称',
    avatar TEXT DEFAULT NULL COMMENT '第三方平台头像地址',
    gender VARCHAR(32) DEFAULT NULL COMMENT '第三方平台性别信息',
    location VARCHAR(191) DEFAULT NULL COMMENT '第三方平台地区信息',
    login_ip VARCHAR(64) DEFAULT NULL COMMENT '最近登录IP',
    last_login_at DATETIME DEFAULT NULL COMMENT '最近登录时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uniq_oauth_identity (provider, social_uid),
    UNIQUE KEY uniq_user_provider (user_id, provider),
    INDEX(user_id),
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户第三方登录身份与授权信息'`,
  // 邮箱验证码
  `CREATE TABLE IF NOT EXISTS bili_email_codes (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    email VARCHAR(128) NOT NULL COMMENT '接收验证码的邮箱',
    code VARCHAR(8) NOT NULL COMMENT '邮箱验证码',
    scene VARCHAR(16) NOT NULL DEFAULT 'register' COMMENT '验证码使用场景',
    expires_at DATETIME NOT NULL COMMENT '验证码过期时间',
    used TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已使用：1是，0否',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(email),
    INDEX(expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '邮箱验证码及使用状态'`,

  // 绑定的B站账号
  `CREATE TABLE IF NOT EXISTS bili_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    bili_uid VARCHAR(32) DEFAULT NULL COMMENT '哔哩哔哩用户UID',
    nickname VARCHAR(128) DEFAULT NULL COMMENT '哔哩哔哩昵称',
    avatar TEXT DEFAULT NULL COMMENT '哔哩哔哩头像地址',
    cookie TEXT NOT NULL COMMENT '哔哩哔哩登录Cookie',
    csrf VARCHAR(64) DEFAULT NULL COMMENT '哔哩哔哩CSRF令牌',
    active TINYINT(1) NOT NULL DEFAULT 0 COMMENT '账号是否激活：1是，0否',
    expire_at DATETIME DEFAULT NULL COMMENT '服务到期时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(user_id),
    CONSTRAINT fk_acc_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户绑定的哔哩哔哩账号'`,

  // 弹幕任务
  `CREATE TABLE IF NOT EXISTS bili_danmu_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    account_id INT NOT NULL COMMENT '哔哩哔哩账号ID',
    room_id VARCHAR(32) NOT NULL COMMENT '直播间ID',
    schedule_type VARCHAR(16) NOT NULL DEFAULT 'fixed' COMMENT '调度类型：固定、随机或每日',
    interval_seconds INT NOT NULL DEFAULT 60 COMMENT '固定发送间隔秒数',
    interval_min INT NOT NULL DEFAULT 300 COMMENT '随机间隔最小秒数',
    interval_max INT NOT NULL DEFAULT 600 COMMENT '随机间隔最大秒数',
    preset VARCHAR(32) DEFAULT NULL COMMENT '任务预设标识',
    mode VARCHAR(16) NOT NULL DEFAULT 'sequential' COMMENT '消息发送模式',
    messages TEXT NOT NULL COMMENT '待发送消息内容',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    auto_switch_room TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否自动切换直播间',
    room_category VARCHAR(16) DEFAULT NULL COMMENT '自动切换的直播间分类',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(account_id),
    CONSTRAINT fk_task_acc FOREIGN KEY (account_id) REFERENCES bili_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '直播间弹幕发送任务'`,

  // 每日任务配置（每个账号可配置多个每日任务）
  `CREATE TABLE IF NOT EXISTS bili_daily_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    account_id INT NOT NULL COMMENT '哔哩哔哩账号ID',
    task_key VARCHAR(32) NOT NULL COMMENT '每日任务类型标识',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    config TEXT COMMENT '任务扩展配置JSON',
    last_run_at DATETIME DEFAULT NULL COMMENT '最近执行时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(account_id),
    CONSTRAINT fk_daily_acc FOREIGN KEY (account_id) REFERENCES bili_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '哔哩哔哩账号每日任务配置'`,

  // 每日任务执行日志
  `CREATE TABLE IF NOT EXISTS bili_daily_task_logs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    daily_task_id INT NOT NULL COMMENT '每日任务ID',
    task_key VARCHAR(32) NOT NULL COMMENT '每日任务类型标识',
    success TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否执行成功',
    code INT DEFAULT NULL COMMENT '执行结果代码',
    result VARCHAR(255) DEFAULT NULL COMMENT '执行结果说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(daily_task_id),
    INDEX(created_at),
    CONSTRAINT fk_dailylog_task FOREIGN KEY (daily_task_id) REFERENCES bili_daily_tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '每日任务执行日志'`,

  // 弹幕发送日志
  `CREATE TABLE IF NOT EXISTS bili_danmu_logs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    task_id INT NOT NULL COMMENT '弹幕任务ID',
    room_id VARCHAR(32) NOT NULL COMMENT '直播间ID',
    message VARCHAR(255) DEFAULT NULL COMMENT '发送的弹幕内容',
    success TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否发送成功',
    code INT DEFAULT NULL COMMENT '发送结果代码',
    result VARCHAR(255) DEFAULT NULL COMMENT '发送结果说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(task_id),
    INDEX(created_at),
    CONSTRAINT fk_log_task FOREIGN KEY (task_id) REFERENCES bili_danmu_tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '弹幕发送执行日志'`,

  // 任务模板（后台维护，用户端可选）
  `CREATE TABLE IF NOT EXISTS bili_task_templates (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    preset_key VARCHAR(32) NOT NULL UNIQUE COMMENT '模板唯一标识',
    group_name VARCHAR(64) NOT NULL DEFAULT '其他' COMMENT '模板分组名称',
    label VARCHAR(64) NOT NULL COMMENT '模板显示名称',
    schedule_type VARCHAR(16) NOT NULL DEFAULT 'fixed' COMMENT '默认调度类型',
    interval_seconds INT NOT NULL DEFAULT 60 COMMENT '默认固定间隔秒数',
    interval_min INT NOT NULL DEFAULT 300 COMMENT '默认随机最小间隔秒数',
    interval_max INT NOT NULL DEFAULT 600 COMMENT '默认随机最大间隔秒数',
    mode VARCHAR(16) NOT NULL DEFAULT 'sequential' COMMENT '默认消息发送模式',
    messages TEXT NOT NULL COMMENT '默认消息内容',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，数值越小越靠前',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '弹幕任务预设模板'`,

  // 时长套餐（后台维护价格与天数，用户购买为账号续期）
  `CREATE TABLE IF NOT EXISTS bili_duration_packages (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    name VARCHAR(64) NOT NULL COMMENT '套餐名称',
    days INT NOT NULL DEFAULT 30 COMMENT '套餐有效天数',
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '套餐价格',
    description TEXT DEFAULT NULL COMMENT '套餐说明',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，数值越小越靠前',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '账号服务时长套餐'`,

  // 订单（在线充值）
  `CREATE TABLE IF NOT EXISTS bili_orders (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '平台订单号',
    user_id INT NOT NULL COMMENT '平台用户ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
    channel VARCHAR(32) NOT NULL COMMENT '支付渠道',
    status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT '订单状态',
    trade_no VARCHAR(128) DEFAULT NULL COMMENT '第三方支付交易号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    paid_at DATETIME DEFAULT NULL COMMENT '支付完成时间',
    INDEX(user_id),
    INDEX(status),
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户在线支付订单'`,

  // 卡密
  `CREATE TABLE IF NOT EXISTS bili_cards (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    code VARCHAR(64) NOT NULL UNIQUE COMMENT '卡密兑换码',
    amount DECIMAL(10,2) NOT NULL COMMENT '卡密面值',
    max_uses INT NOT NULL DEFAULT 1 COMMENT '最大可兑换次数',
    used_count INT NOT NULL DEFAULT 0 COMMENT '已兑换次数',
    used TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已全部使用',
    used_by INT DEFAULT NULL COMMENT '最后兑换用户ID',
    used_at DATETIME DEFAULT NULL COMMENT '最后兑换时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(used)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '余额充值卡密'`,

  // 卡密兑换记录（每人每卡限一次）
  `CREATE TABLE IF NOT EXISTS bili_card_redemptions (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    card_id INT NOT NULL COMMENT '卡密ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uniq_card_user (card_id, user_id),
    INDEX(user_id),
    CONSTRAINT fk_redeem_card FOREIGN KEY (card_id) REFERENCES bili_cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_redeem_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '卡密兑换明细'`,

  // 余额变动流水
  `CREATE TABLE IF NOT EXISTS bili_balance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    change_amount DECIMAL(10,2) NOT NULL COMMENT '本次余额变动金额',
    balance_after DECIMAL(10,2) NOT NULL COMMENT '变动后的余额',
    type VARCHAR(32) NOT NULL COMMENT '余额变动类型',
    remark VARCHAR(255) DEFAULT NULL COMMENT '变动备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(user_id),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户余额变动流水'`,

  // 系统设置（键值对）
  `CREATE TABLE IF NOT EXISTS bili_settings (
    skey VARCHAR(64) NOT NULL PRIMARY KEY COMMENT '设置项键名',
    svalue TEXT COMMENT '设置项值',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '系统设置键值配置'`,

  // 在线直播间（后台维护，前台分类展示）
  `CREATE TABLE IF NOT EXISTS bili_live_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    room_id VARCHAR(32) NOT NULL COMMENT '直播间ID',
    category VARCHAR(16) NOT NULL DEFAULT 'danchong' COMMENT '直播间分类',
    title VARCHAR(255) DEFAULT NULL COMMENT '直播间标题',
    cover VARCHAR(512) DEFAULT NULL COMMENT '直播间封面地址',
    uname VARCHAR(128) DEFAULT NULL COMMENT '主播昵称',
    uid VARCHAR(32) DEFAULT NULL COMMENT '主播UID',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，数值越小越靠前',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uniq_room (room_id),
    INDEX(category),
    INDEX(enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '后台维护的在线直播间'`,

  // 抽奖奖品（后台维护：名称/类型/价值/权重/库存）
  `CREATE TABLE IF NOT EXISTS bili_lottery_prizes (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    name VARCHAR(64) NOT NULL COMMENT '奖品名称',
    type VARCHAR(16) NOT NULL DEFAULT 'none' COMMENT '奖品类型',
    value DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '奖品数值',
    weight INT NOT NULL DEFAULT 0 COMMENT '中奖权重',
    stock INT NOT NULL DEFAULT -1 COMMENT '奖品库存，-1为不限',
    image VARCHAR(512) DEFAULT NULL COMMENT '奖品图片地址',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，数值越小越靠前',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '抽奖奖品配置'`,

  // 抽奖记录
  `CREATE TABLE IF NOT EXISTS bili_lottery_records (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    prize_id INT DEFAULT NULL COMMENT '奖品ID',
    prize_name VARCHAR(64) NOT NULL COMMENT '中奖时的奖品名称',
    prize_type VARCHAR(16) NOT NULL DEFAULT 'none' COMMENT '中奖时的奖品类型',
    prize_value DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '中奖时的奖品数值',
    cost DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '本次抽奖消耗金额',
    is_free TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否免费抽奖',
    fulfilled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '奖品是否已发放',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(user_id),
    INDEX(created_at),
    CONSTRAINT fk_lott_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户抽奖记录'`,

  // 友情链接
  `CREATE TABLE IF NOT EXISTS bili_friend_links (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    name VARCHAR(64) NOT NULL COMMENT '链接名称',
    url VARCHAR(512) NOT NULL COMMENT '链接地址',
    description VARCHAR(255) DEFAULT NULL COMMENT '链接说明',
    logo VARCHAR(512) DEFAULT NULL COMMENT '链接Logo地址',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，数值越小越靠前',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(enabled),
    INDEX(sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '网站友情链接'`,

  // 工单
  `CREATE TABLE IF NOT EXISTS bili_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id INT NOT NULL COMMENT '平台用户ID',
    category VARCHAR(16) NOT NULL DEFAULT 'other' COMMENT '工单分类',
    title VARCHAR(128) NOT NULL COMMENT '工单标题',
    status VARCHAR(16) NOT NULL DEFAULT 'open' COMMENT '工单状态',
    last_reply_by VARCHAR(8) NOT NULL DEFAULT 'user' COMMENT '最后回复方',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX(user_id),
    INDEX(status),
    CONSTRAINT fk_ticket_user FOREIGN KEY (user_id) REFERENCES bili_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '用户支持工单'`,

  // 工单消息（用户与管理员多轮对话，附件存图片URL的JSON数组）
  `CREATE TABLE IF NOT EXISTS bili_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    ticket_id INT NOT NULL COMMENT '所属工单ID',
    sender VARCHAR(8) NOT NULL DEFAULT 'user' COMMENT '消息发送方',
    content TEXT NOT NULL COMMENT '消息正文',
    images TEXT DEFAULT NULL COMMENT '附件图片地址JSON数组',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(ticket_id),
    CONSTRAINT fk_tmsg_ticket FOREIGN KEY (ticket_id) REFERENCES bili_tickets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '工单对话消息'`,

  // 弹幕宠物升级历史记录
  `CREATE TABLE IF NOT EXISTS bili_pet_level_logs (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    account_id INT NOT NULL COMMENT '哔哩哔哩账号ID',
    room_id VARCHAR(32) NOT NULL COMMENT '直播间ID',
    level_before INT DEFAULT NULL COMMENT '升级前等级',
    level_after INT NOT NULL COMMENT '升级后等级',
    level_name VARCHAR(64) DEFAULT NULL COMMENT '等级名称',
    pet_name VARCHAR(64) DEFAULT NULL COMMENT '宠物名称',
    coin INT DEFAULT NULL COMMENT '升级时金币数',
    attack INT DEFAULT NULL COMMENT '升级时攻击力',
    defense INT DEFAULT NULL COMMENT '升级时防御力',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX(account_id),
    INDEX(created_at),
    CONSTRAINT fk_petlog_acc FOREIGN KEY (account_id) REFERENCES bili_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '弹幕宠物等级变化记录'`
];

