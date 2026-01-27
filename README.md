# Folo Exporter

A Chrome extension to export all unread articles from [Folo](https://app.folo.is/) (formerly Follow.is) to Markdown format.

## Features

- **Fetch All Unread**: Retrieves all unread articles via API, not limited to visible items
- **No Read Trigger**: Uses direct API calls, won't mark articles as read
- **Category Grouping**: Articles grouped by your Folo categories
- **Rich Export**: Includes title, source, time, link, and AI summary (if available)
- **Multiple Formats**: Export grouped by category or as a flat list
- **Copy or Download**: Copy to clipboard or download as .md file

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the folder containing this extension

## Usage

1. Log in to [app.folo.is](https://app.folo.is/) in Chrome
2. Click the **Folo Exporter** icon in your browser toolbar
3. Click **Fetch Unread Articles**
4. Choose export format (grouped or flat)
5. Click **Copy to Clipboard** or **Download .md**

## Export Format

```markdown
# Folo Unread Articles Export
Export time: 1/27/2026, 3:30:00 PM
Total: 103 articles

---

## AI News (32)

### Article Title
- Source: Hugging Face Blog
- Time: 1/27/2026, 10:00:00 AM
- Link: https://example.com/article
- Summary: AI-generated summary of the article...

...
```

## Requirements

- Chrome browser
- Logged in to Folo (app.folo.is)

## How It Works

The extension calls Folo's API directly with your session cookie:

```javascript
POST https://api.folo.is/entries
Body: { limit: 100, view: -1, read: false }
```

This approach:
- Fetches all unread articles (no scroll limit)
- Doesn't trigger read status (API read ≠ page view)
- Gets complete data including AI summaries

## License

MIT
