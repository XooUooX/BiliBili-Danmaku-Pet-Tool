# 贡献指南

感谢参与改进 BiliBili 弹宠小助手。

## 开发流程

1. Fork 仓库并创建功能分支。
2. 执行 `npm ci` 和 `npm --prefix client ci`。
3. 从 `.env.example` 创建本地 `.env`，不要提交真实密钥。
4. 完成功能后执行 `npm run verify`。
5. 确认 `npm audit --omit=dev` 和 `npm --prefix client audit` 没有高危漏洞。
6. 提交 Pull Request，说明改动目的、测试方式和数据库影响。

## 代码约定

- 后端使用 CommonJS，前端使用 ES Modules。
- 保持现有 React 组件和 Tailwind CSS 风格。
- SQL 必须使用参数化查询，不要拼接用户输入。
- 新增数据库字段时，同时更新 `db/schema.js`、增量迁移和字段备注。
- 新增环境变量时，同时更新 `.env.example` 和文档。
- 涉及 B币、硬币、余额或支付的操作必须有明确提示、边界校验和幂等处理。

## 提交信息建议

使用清晰、可检索的提交信息，例如：

- `feat: add live room category filter`
- `fix: prevent duplicate daily task execution`
- `docs: update deployment guide`
- `chore: remove generated files`

## Pull Request 清单

- [ ] 后端 Node 语法检查通过
- [ ] 前端生产构建通过
- [ ] 数据库迁移可重复执行
- [ ] 未提交 `.env`、日志、构建产物或账号数据
- [ ] 涉及界面变化时提供截图
- [ ] 涉及行为变化时更新 README 或 INSTALL 文档
