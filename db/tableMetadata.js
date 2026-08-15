'use strict';

// 数据库统一命名规范：全部使用小写 snake_case，并统一使用 bili_ 项目前缀。
const TABLE_RENAMES = Object.freeze({
  users: 'bili_users',
  oauth_identities: 'bili_oauth_identities',
  email_codes: 'bili_email_codes',
  bili_accounts: 'bili_accounts',
  danmu_tasks: 'bili_danmu_tasks',
  daily_tasks: 'bili_daily_tasks',
  daily_task_logs: 'bili_daily_task_logs',
  danmu_logs: 'bili_danmu_logs',
  task_templates: 'bili_task_templates',
  duration_packages: 'bili_duration_packages',
  orders: 'bili_orders',
  cards: 'bili_cards',
  card_redemptions: 'bili_card_redemptions',
  balance_logs: 'bili_balance_logs',
  settings: 'bili_settings',
  live_rooms: 'bili_live_rooms',
  lottery_prizes: 'bili_lottery_prizes',
  lottery_records: 'bili_lottery_records',
  friend_links: 'bili_friend_links',
  tickets: 'bili_tickets',
  ticket_messages: 'bili_ticket_messages',
  pet_level_logs: 'bili_pet_level_logs'
});

const TABLE_COMMENTS = Object.freeze({
  users: '平台用户与管理员账号',
  oauth_identities: '用户第三方登录身份与授权信息',
  email_codes: '邮箱验证码及使用状态',
  bili_accounts: '用户绑定的哔哩哔哩账号',
  danmu_tasks: '直播间弹幕发送任务',
  daily_tasks: '哔哩哔哩账号每日任务配置',
  daily_task_logs: '每日任务执行日志',
  danmu_logs: '弹幕发送执行日志',
  task_templates: '弹幕任务预设模板',
  duration_packages: '账号服务时长套餐',
  orders: '用户在线支付订单',
  cards: '余额充值卡密',
  card_redemptions: '卡密兑换明细',
  balance_logs: '用户余额变动流水',
  settings: '系统设置键值配置',
  live_rooms: '后台维护的在线直播间',
  lottery_prizes: '抽奖奖品配置',
  lottery_records: '用户抽奖记录',
  friend_links: '网站友情链接',
  tickets: '用户支持工单',
  ticket_messages: '工单对话消息',
  pet_level_logs: '弹幕宠物等级变化记录'
});

const COMMON_COLUMN_COMMENTS = Object.freeze({
  id: '主键ID',
  user_id: '平台用户ID',
  account_id: '哔哩哔哩账号ID',
  room_id: '直播间ID',
  enabled: '是否启用：1启用，0停用',
  sort_order: '排序值，数值越小越靠前',
  created_at: '创建时间',
  updated_at: '更新时间'
});

const COLUMN_COMMENTS = Object.freeze({
  users: {
    username: '登录用户名', email: '绑定邮箱', qq: '联系QQ', avatar: '用户头像地址',
    password: '登录密码哈希', balance: '账户可用余额', is_admin: '是否管理员：1是，0否',
    status: '账号状态：1正常，0禁用'
  },
  oauth_identities: {
    provider: '第三方平台标识', social_uid: '第三方平台用户唯一标识', access_token: '第三方授权令牌',
    nickname: '第三方平台昵称', avatar: '第三方平台头像地址', gender: '第三方平台性别信息',
    location: '第三方平台地区信息', login_ip: '最近登录IP', last_login_at: '最近登录时间'
  },
  email_codes: {
    email: '接收验证码的邮箱', code: '邮箱验证码', scene: '验证码使用场景',
    expires_at: '验证码过期时间', used: '是否已使用：1是，0否'
  },
  bili_accounts: {
    bili_uid: '哔哩哔哩用户UID', nickname: '哔哩哔哩昵称', avatar: '哔哩哔哩头像地址',
    cookie: '哔哩哔哩登录Cookie', csrf: '哔哩哔哩CSRF令牌', active: '账号是否激活：1是，0否',
    expire_at: '服务到期时间'
  },
  danmu_tasks: {
    schedule_type: '调度类型：固定、随机或每日', interval_seconds: '固定发送间隔秒数',
    interval_min: '随机间隔最小秒数', interval_max: '随机间隔最大秒数', preset: '任务预设标识',
    mode: '消息发送模式', messages: '待发送消息内容', auto_switch_room: '是否自动切换直播间',
    room_category: '自动切换的直播间分类'
  },
  daily_tasks: {
    task_key: '每日任务类型标识', config: '任务扩展配置JSON', last_run_at: '最近执行时间'
  },
  daily_task_logs: {
    daily_task_id: '每日任务ID', task_key: '每日任务类型标识', success: '是否执行成功',
    code: '执行结果代码', result: '执行结果说明'
  },
  danmu_logs: {
    task_id: '弹幕任务ID', message: '发送的弹幕内容', success: '是否发送成功',
    code: '发送结果代码', result: '发送结果说明'
  },
  task_templates: {
    preset_key: '模板唯一标识', group_name: '模板分组名称', label: '模板显示名称',
    schedule_type: '默认调度类型', interval_seconds: '默认固定间隔秒数', interval_min: '默认随机最小间隔秒数',
    interval_max: '默认随机最大间隔秒数', mode: '默认消息发送模式', messages: '默认消息内容'
  },
  duration_packages: {
    name: '套餐名称', days: '套餐有效天数', price: '套餐价格', description: '套餐说明'
  },
  orders: {
    order_no: '平台订单号', amount: '订单金额', channel: '支付渠道', status: '订单状态',
    trade_no: '第三方支付交易号', paid_at: '支付完成时间'
  },
  cards: {
    code: '卡密兑换码', amount: '卡密面值', max_uses: '最大可兑换次数', used_count: '已兑换次数',
    used: '是否已全部使用', used_by: '最后兑换用户ID', used_at: '最后兑换时间'
  },
  card_redemptions: {
    card_id: '卡密ID'
  },
  balance_logs: {
    change_amount: '本次余额变动金额', balance_after: '变动后的余额', type: '余额变动类型', remark: '变动备注'
  },
  settings: {
    skey: '设置项键名', svalue: '设置项值'
  },
  live_rooms: {
    category: '直播间分类', title: '直播间标题', cover: '直播间封面地址', uname: '主播昵称',
    uid: '主播UID'
  },
  lottery_prizes: {
    name: '奖品名称', type: '奖品类型', value: '奖品数值', weight: '中奖权重', stock: '奖品库存，-1为不限',
    image: '奖品图片地址'
  },
  lottery_records: {
    prize_id: '奖品ID', prize_name: '中奖时的奖品名称', prize_type: '中奖时的奖品类型',
    prize_value: '中奖时的奖品数值', cost: '本次抽奖消耗金额', is_free: '是否免费抽奖', fulfilled: '奖品是否已发放'
  },
  friend_links: {
    name: '链接名称', url: '链接地址', description: '链接说明', logo: '链接Logo地址'
  },
  tickets: {
    category: '工单分类', title: '工单标题', status: '工单状态', last_reply_by: '最后回复方'
  },
  ticket_messages: {
    ticket_id: '所属工单ID', sender: '消息发送方', content: '消息正文', images: '附件图片地址JSON数组'
  },
  pet_level_logs: {
    level_before: '升级前等级', level_after: '升级后等级', level_name: '等级名称', pet_name: '宠物名称',
    coin: '升级时金币数', attack: '升级时攻击力', defense: '升级时防御力'
  }
});

function getColumnComments(logicalTableName) {
  return { ...COMMON_COLUMN_COMMENTS, ...(COLUMN_COMMENTS[logicalTableName] || {}) };
}

module.exports = {
  TABLE_RENAMES,
  TABLE_COMMENTS,
  COLUMN_COMMENTS,
  getColumnComments
};
