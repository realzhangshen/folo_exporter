# Folo API 文档（面向本仓库）

> 本文档用于指导本仓库内的 AI Agent，不是 Folo 官方 API 文档。
>
> 更新时间: 2026-02-08
>
> 证据来源:
> - 本仓库代码: `popup.js`, `cli/folo-cli.js`
> - 历史分析文档（已去除与现状冲突的结论）

## 1. 基础信息

| 项目 | 值 |
|------|-----|
| Web URL | `https://app.folo.is` |
| API Base（默认） | `https://api.folo.is` |
| API Base（兼容尝试） | `https://api.follow.is` |
| 认证方式 | Cookie 会话 |
| 请求格式 | JSON |
| 响应格式 | JSON |

注意：
1. 扩展侧与 CLI 侧都依赖已登录会话。
2. 没有内置长期 token 方案，主要走 Cookie。

## 2. 已在代码中稳定使用的接口

### 2.1 获取未读文章

- 方法: `POST /entries`
- Base: `https://api.folo.is`
- 用途: 抓取 inbox 未读

请求体（核心字段）：

```json
{
  "limit": 100,
  "view": -1,
  "read": false,
  "publishedAfter": "optional-iso-time"
}
```

字段说明：
- `limit`: 每批数量，代码中限制不超过 `100`
- `view: -1`: inbox
- `read: false`: 仅未读
- `publishedAfter`: 分页游标（取上一页最后一条的 `entries.publishedAt`）

### 2.2 会话检查

- 方法: `POST /entries`
- Body: `{ "limit": 1, "view": -1 }`
- 目的: 用最小请求验证登录态

本仓库中：
- 扩展 `checkConnection()` 使用此逻辑
- CLI `check-auth` 使用同样逻辑

## 3. 标记已读能力（重要）

旧文档曾写“不可用”，该结论对当前仓库已过期。

当前代码行为（`popup.js -> markAsRead()`）：
1. 按顺序尝试 `POST https://api.folo.is/reads`，Body `{ entryIds, isInbox: false }`
2. 再尝试 `POST https://api.folo.is/reads`，Body `{ entryIds }`
3. 再尝试 `POST https://api.follow.is/reads`，Body `{ entryIds, isInbox: false }`
4. 再尝试 `POST https://api.follow.is/reads`，Body `{ entryIds }`
5. 最后 fallback 到 `POST https://api.folo.is/reads/markAsRead`

行为约定：
- 只要任一请求 `response.ok` 即视为成功。
- 若所有尝试均为 `404`，返回“环境未开放接口”的错误。
- 因账号/环境差异，该能力可能可用也可能不可用，Agent 不应做绝对假设。

## 4. 分页与去重策略（当前实现）

1. 首次请求不带 `publishedAfter`
2. 每轮取最后一条 `publishedAt` 作为下一轮游标
3. 若本轮新增文章数为 `0`，立即停止（防死循环）
4. 若返回数量 `< 100`，停止
5. 安全上限：最多 50 请求（可在 CLI 中配置）
6. 去重键：`entries.id`

## 5. 数据结构（导出层）

本仓库统一导出字段：

```json
{
  "id": "entry-id-or-null",
  "title": "Untitled if missing",
  "url": "",
  "publishedAt": "ISO or null",
  "insertedAt": "ISO or null",
  "summary": "",
  "feedTitle": "Unknown if missing",
  "category": "Uncategorized if missing"
}
```

## 6. Agent 注意事项

1. 不要再引用“标记已读必定不可用”的旧结论。
2. 标记已读前，先判断是否有可用 `entryIds`。
3. 抓取流程推荐先做 `check-auth`，再做 `fetch`。
4. 认证失败优先判定为会话失效，而不是接口参数错误。
5. 优先使用 JSON 导出给下游 Agent 消费。

## 7. 代码锚点

- 扩展抓取入口: `popup.js` -> `fetchAllUnread()`
- 扩展登录态检查: `popup.js` -> `checkConnection()`
- 扩展标记已读: `popup.js` -> `markAsRead()`
- CLI 登录: `cli/folo-cli.js` -> `runLogin()`
- CLI 鉴权检查: `cli/folo-cli.js` -> `runCheckAuth()`
- CLI 抓取: `cli/folo-cli.js` -> `runFetch()` / `fetchAllUnread()`
