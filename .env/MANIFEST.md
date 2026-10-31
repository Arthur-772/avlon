# .env MANIFEST — 环境配置清单

> 每次新增 / 删除 / 变更配置或缓存布局后更新下表。
> 经用户同意对主机做过的变更(5.3 逃生舱)也登记在此,便于日后清理。

| 配置项 | 用途 | 位置 / 设置方式 | 备注 |
|---|---|---|---|
| GitHub 推送令牌 | avlon 推送认证(细粒度 PAT,仅 Contents 读写) | `.env\credentials\github.token`,经 `credhelper.cmd` 单次注入(不入 git、不落主机凭据库) | 2026-10-31 启用;泄露即于 GitHub 撤销 |
