# avlon

> AI 主导的整合工作区(monorepo):子项目同居一仓、相互独立;工具环境集中治理,**极力避免污染主机**。

## 快速导航

| 入口 | 作用 |
|---|---|
| [AGENTS.md](AGENTS.md) | 工作区最高规范:权限 / git / 布局 / 环境本地化 / 主机保护 |
| [OPBR.md](OPBR.md) | OPBR 分工细则:规划 P / 构建 B / 审查 R / 运维 O |
| [PROJECTS.md](PROJECTS.md) | 项目索引——所有会话冷启动第一站 |
| `templates\` | 项目文档模板(PRD / 架构 / 验收 / CHANGELOG / ADR)+ 审查清单 |
| `.tool\` / `.env\` | 共享工具与环境框架(内容不入库,README / MANIFEST 入库) |

## 分支体系

| 分支 | 定位 |
|---|---|
| `master` | **初始化地基**:工作区体系骨架,不对应具体主机 |
| `Branch_<主机名>` | 各主机专属分支(如 `Branch_OWN`、`Branch_DP`),从地基 fork 后独立演进,互不关联 |
| `PD_<项目名>` | 成熟 / 被证实有意义 / 已进入迭代的项目,具有维护价值 |

> 各主机在自己的分支上定制 AGENTS.md(§0 记录该主机现状);换机重建依据:AGENTS.md + `.tool`/`.env` 的 MANIFEST。
