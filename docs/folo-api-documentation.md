# Folo API 文档

> 基于对 https://github.com/RSSNext/Folo 源码的分析
>
> 分析日期: 2026-01-27
>
> 状态: ✅ 已验证可用

## 1. 基础信息

| 项目 | 值 |
|------|-----|
| **后端 API** | `https://api.follow.is` |
| **前端 API** | `https://api.folo.is` (CORS 允许扩展访问) |
| **Web URL** | `https://app.folo.is` |
| **认证方式** | Cookies (`credentials: 'include'`) |
| **请求格式** | JSON |
| **响应格式** | JSON |

### CORS 问题

**重要**: `api.follow.is` 的 CORS 配置只允许 `https://folo.is` 访问，不允许浏览器扩展直接访问。

对于浏览器扩展，必须使用 `api.folo.is`，它的 CORS 配置允许扩展访问。

| 场景 | 使用的 API |
|------|-----------|
| 浏览器扩展 | `https://api.folo.is` ✅ |
| Folo 网页内 | `https://api.follow.is` |

## 2. 已验证可用的端点

### 获取文章列表

**端点**: `POST https://api.folo.is/entries` ✅

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 每页数量，最大 100 |
| `read` | boolean | 否 | 过滤已读状态，`false` 获取未读 |
| `view` | number | 是 | FeedViewType，`-1` 表示 inbox |
| `publishedAfter` | string | 否 | 分页游标，ISO 8601 时间戳 |

**请求示例**:
```javascript
const response = await fetch('https://api.folo.is/entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    limit: 100,
    read: false,
    view: -1,
    publishedAfter: '2025-01-01T00:00:00Z'
  })
});
```

**响应结构**:
```json
{
  "data": [
    {
      "entries": {
        "id": "entry-id-xxx",
        "title": "文章标题",
        "url": "https://example.com/article",
        "publishedAt": "2025-01-27T10:00:00Z",
        "insertedAt": "2025-01-27T11:00:00Z",
        "summary": "文章摘要",
        "read": false
      },
      "feeds": {
        "id": "feed-id-xxx",
        "title": "订阅源名称",
        "type": "rss"
      },
      "subscriptions": {
        "category": "分类名称"
      }
    }
  ]
}
```

### 分页逻辑 (已验证 ✅)

使用 `publishedAfter` 作为游标：

1. 第一次请求不传 `publishedAfter`，获取最新文章
2. 获取响应中最后一条记录的 `publishedAt` 时间戳
3. 下一次请求传入该时间戳作为 `publishedAfter`

**关键代码**:
```javascript
let publishedAfter = null;

while (hasMore) {
  const body = { limit: 100, view: -1, read: false };
  if (publishedAfter) {
    body.publishedAfter = publishedAfter;
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(body)
  });

  const entries = result.data || [];

  // 更新游标
  const lastEntry = entries[entries.length - 1];
  if (lastEntry?.entries?.publishedAt) {
    publishedAfter = lastEntry.entries.publishedAt;
  }

  // 如果返回少于 100 条，说明已到末尾
  if (entries.length < 100) {
    hasMore = false;
  }
}
```

## 3. 标记为已读 (待验证)

根据源码分析，后端 API 使用以下端点，但前端 API 可能不同：

### 尝试的端点 (按优先级)

| 端点 | 方法 | 状态 |
|------|------|------|
| `/reads/markAsRead` | POST | 待验证 |
| `/entries` | PATCH | 待验证 |
| `/entries/read` | POST | 待验证 |

**请求参数**:
```javascript
{
  entryIds: ['id1', 'id2', 'id3'],
  isInbox: false
}
```

## 4. 其他可能有用的端点 (未测试)

### 标记为未读

```
POST /reads/markAsUnread

{ entryId: "xxx", isInbox: false }
```

### 全部标记已读

```
POST /reads/markAllAsRead

{ view: -1, feedId?: "xxx", ... }
```

### 获取完整内容

```
POST /entries
{ withContent: true, ... }
```

### 收藏/取消收藏

端点未知（可能在 `/collections` 或 `/stars`）

### 订阅管理

可能涉及的端点：
- `/subscriptions` - 订阅列表
- `/feeds` - 订阅源管理
- `/lists` - 列表管理

## 5. FeedViewType 枚举

从源码推断的 view 值：

| 值 | 说明 |
|----|------|
| `-1` | Inbox (收件箱) |
| `0` | Feeds (订阅源) |
| `1` | Lists (列表) |
| `2` | 可能是其他视图 |

## 6. 修复历史

### 2026-01-27 修复

**问题**:
1. 分页代码尝试了太多无效的游标参数
2. 标记已读端点不确定

**解决**:
1. 简化分页，只使用 `publishedAfter` 游标
2. 标记已读尝试多个端点，优先 `/reads/markAsRead`

**验证结果**: ✅ 成功抓取超过 100 篇文章

## 7. 源码参考

| 文件路径 | 说明 |
|----------|------|
| `packages/internal/store/src/modules/entry/store.ts` | 文章列表 API 调用 |
| `packages/internal/store/src/modules/unread/store.ts` | 已读/未读标记 API |
| `packages/internal/shared/src/env.common.ts` | 环境配置 |
