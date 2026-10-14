# 数据开发工具箱 v1.0

单文件 HTML 工具，零依赖，双击即用。

## 功能

| 标签页 | 功能 |
|--------|------|
| Hive 建表 | 输入 DDL 或 SELECT，自动生成 Parquet 格式的 Hive 建表语句 |
| DDL ↔ SELECT | DDL 转 SELECT（标准/AS别名）、SELECT 转 CREATE TABLE |
| SQL 格式化 | SELECT 语句排版美化，列对齐，关键字规范化 |

## 相比原版的 Bug 修复

1. **嵌套括号解析** — `CREATE TABLE t (col1 DECIMAL(10,2), col2 STRING)` 不再丢失列。用 `findMatchingParen` 替代惰性正则。
2. **捕获组回退** — 移除了 `cm[3] || cm[2]` 的错误回退逻辑。
3. **字段翻译后缀匹配** — `translateFieldToChinese` 的后缀匹配现在仅对含下划线的 key 生效，避免 `id` 匹配所有以 `id` 结尾的字段。
4. **DDL 类型捕获** — `parseDDLStruct` 现在捕获列类型，不再只拿 name 和 comment。
5. **AS 别名对齐** — `generateSelectAlias` 的填充位置修正。
6. **反引号字符串** — `splitFields` 现在正确处理反引号包裹的标识符。
7. **分区事件去重** — 分区字段输入只用单一 debounce 处理器，不再 change+input 双触发。
8. **SQL 注释跳过** — `splitFields` 跳过 `--` 开头的注释行。

## 架构

```
index.html  (单文件，约 990 行)
├── CSS  设计令牌 + 组件样式 + 响应式
├── HTML  三标签页布局
└── JS
    ├── Core Utils     toast / clipboard / debounce
    ├── SQL Tokenizer  splitFields / findMatchingParen
    ├── Field Translator  翻译字典 + 匹配策略
    ├── DDL Parser      parseDDLStruct (带类型)
    ├── SELECT Parser   parseSelectStruct
    ├── Hive Engine     parseSQLToHive / generateHiveCreate
    ├── Converters      generateSelectStandard / Alias / selectToCreate
    ├── Formatter       formatSqlStmt
    └── UI Bindings     三标签页各自独立 IIFE
```

## 扩展新功能

在 HTML 中添加新标签按钮和 pane，然后在 JS 中添加对应的 IIFE 绑定块即可。