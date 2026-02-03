# JSON Export Format Design

**Date:** 2026-02-03
**Status:** Design Approved

## Overview

Add a JSON export format to the Folo Exporter Chrome extension, allowing users to export unread articles in JSON format with full article data and metadata.

## Requirements

- Add JSON as a third export format alongside Category Mode and List Mode
- Include all article fields in the export
- Add metadata wrapper (export time, total count)
- Keep articles in the same order as fetched from API (unsorted)

## UI Changes

### Replace Radio Buttons with Dropdown

**Current:** Radio buttons for format selection
**New:** Dropdown (`<select>`) with three options:

| Label | Value |
|-------|-------|
| 分类模式 | `grouped` |
| 列表模式 | `list` |
| JSON格式 | `json` |

**File:** `popup.html`
- Remove existing format radio button group
- Add `<select id="format-select">`

**File:** `popup.css`
- Add styling for the dropdown element

## JSON Structure

```json
{
  "exportTime": "2026-02-03T14:30:00.000Z",
  "exportTimeFormatted": "2026-02-03 14:30:00",
  "total": 123,
  "articles": [
    {
      "id": "entry-123",
      "title": "Article Title",
      "url": "https://example.com/article",
      "publishedAt": "2026-02-01T10:00:00.000Z",
      "insertedAt": "2026-02-01T12:00:00.000Z",
      "summary": "Article summary text...",
      "feedTitle": "Feed Name",
      "category": "Tech"
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `exportTime` | ISO 8601 string | Machine-readable timestamp |
| `exportTimeFormatted` | string | Human-readable localized time |
| `total` | number | Total article count |
| `articles` | array | Array of article objects (same order as fetched) |

### Article Fields (All existing fields)

- `id` - Entry ID
- `title` - Article title
- `url` - Article URL
- `publishedAt` - Published timestamp
- `insertedAt - Inserted timestamp
- `summary` - Article summary
- `feedTitle` - Feed name
- `category` - Subscription category

## Export Behavior

### Copy Button
- Copies raw JSON string to clipboard
- Pretty-printed with 2-space indentation

### Download Button
- Downloads as `.json` file
- Filename format: `folo-export-YYYY-MM-DD-HH-mm.json`
- Example: `folo-export-2026-02-03-14-30.json`

## Implementation

### Files to Modify

1. **popup.html**
   - Replace format radio buttons with `<select id="format-select">`

2. **popup.js**
   - Rename `generateMarkdown()` → `generateExport()`
   - Add new `generateJSON()` function
   - Update `handleCopy()` and `handleDownload()` to use `generateExport()`
   - Change format selection logic:
     - From: `document.querySelector('input[name="format"]:checked').value`
     - To: `document.getElementById('format-select').value`

3. **popup.css**
   - Add dropdown styling

### No Changes Needed

- API fetching (already retrieves all article fields)
- Caching (stores raw article data)
- Mark as Read feature (disabled)
