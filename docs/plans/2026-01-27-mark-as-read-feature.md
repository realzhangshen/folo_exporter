# Mark as Read Feature Design

**Date**: 2026-01-27
**Status**: Approved

## Overview

Add a "Mark as Read" feature to Folo Exporter that allows users to mark all fetched unread articles as read in Folo.

## Requirements

- Add a button to mark all fetched articles as read
- Button should be disabled by default, enabled only after successful fetch
- Show confirmation dialog before executing the irreversible action
- Display clear success/error feedback
- Handle API errors gracefully

## UI Design

### Button Placement

```
┌─────────────────────────────────────┐
│  [Fetch Unread Articles]            │
│                                     │
│  Found 42 articles                  │
│                                     │
│  [Mark as Read]  [Copy] [Download]  │
└─────────────────────────────────────┘
```

### Button States

| State | Style |
|-------|-------|
| Initial | Disabled, gray |
| After fetch | Enabled, blue |
| Processing | Disabled, "标记中..." |
| Success | "✓ 已标记 42 篇", 2s then reset |

### Confirmation Dialog

```
┌─────────────────────────────────────┐
│  确认标记已读                        │
│                                     │
│  将 42 篇文章标记为已读              │
│  此操作不可撤销                      │
│                                     │
│         [取消]  [确认标记]           │
└─────────────────────────────────────┘
```

## Technical Implementation

### API Endpoint

Uses Folo API to mark entries as read. To be verified via browser DevTools:

```javascript
// Expected endpoint (to be confirmed)
POST https://api.folo.is/v1/entries/read
{
  "entryIds": ["uuid1", "uuid2", ...]
}

// Or per-entry fallback
PUT https://api.folo.is/v1/entries/{id}/read
```

### Data Flow

```
User clicks "Mark as Read"
       ↓
Show confirmation dialog (with article count)
       ↓
User confirms → Button loading state
       ↓
Call API to mark as read
       ↓
    ├─ Success → Show success toast → Button恢复
    │
    └─ Failure → Show error message → Button恢复
```

### Code Structure

**popup.html**
- Add "Mark as Read" button to export section
- Add confirmation dialog element

**popup.js**
- `showConfirmDialog()` - Show confirmation with count
- `markAsRead()` - Call Folo API
- Update `UI.setMarkAsReadEnabled()` - Control button state

**popup.css**
- Style for mark button (accent color)
- Modal dialog styles

## Error Handling

| Scenario | Response |
|----------|----------|
| Not logged in / Token expired | "请先在 Folo 登录" |
| Network error | "网络连接失败，请重试" |
| Partial success | "部分文章标记失败：X/Y 成功" |
| Empty list | Button stays disabled |

## Testing

| Test Case | Expected Result |
|-----------|-----------------|
| No unread articles | Button remains disabled |
| 10 articles, confirm | Dialog shows "将 10 篇文章标记为已读" |
| Cancel | Dialog closes, no API call |
| Success | "✓ 已标记 10 篇" shown |
| API failure | Error message shown, button retryable |
| Not logged in | "请先在 Folo 登录" prompt |
