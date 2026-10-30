# .env — 共享环境目录(配置 / 缓存 / 凭据 / 状态)

供 `E:\avlon` 下**所有子项目共用**的环境数据集中放这里。完整规则见根目录 `AGENTS.md` 第 4 节(本机文件,不入 git)。

## 约定布局

| 子目录 / 文件 | 用途 |
|---|---|
| `npm-cache\`、`pnpm-store\`、`pip-cache\`、`uv-cache\` | 各工具缓存(通过项目级配置或环境变量指过来) |
| `git\gitconfig` | 本地化的"全局" git 配置(用 `GIT_CONFIG_GLOBAL` 指向) |
| `credentials\` | 凭据 / token(⚠️ 已被 gitignore,严禁提交) |
| `log\` | 跨项目日志(项目自己的日志放项目内) |

## 规则

1. 开发中产生的配置 / 缓存 / 凭据 / 跨项目日志,优先落本目录,而不是主机。
2. 含敏感信息:整个目录内容不入 git(`README.md` 与 `MANIFEST.md` 除外)。
3. 变更后同步更新本目录的 [MANIFEST.md](MANIFEST.md);经用户同意对主机做过的变更也登记在这里,便于日后清理。
