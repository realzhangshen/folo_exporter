
# Follow.is RSS Exporter

Helper extension for [Follow.is](https://folo.is/) to export unread or all visible articles from your timeline into a clean Markdown list format. Perfect for archiving, sharing, or processing your reading list in other tools (like Notion, Obsidian, etc.).

## Features

- **One-Click Export**: Extract article titles and links directly from your current view.
- **Smart Filtering**:
    - **Unread Only**: Default mode exports only articles you haven't read yet (detects `text-text-secondary` styling).
    - **All Articles**: Toggle to export everything currently visible on the page.
- **Clean Markdown**: Outputs a checklist format `- [ ] [Title](URL)` ready for immediate use.
- **Privacy Focused**: Runs locally in your browser. No data is sent to external servers.

## Installation

Since this extension is not yet in the Chrome Web Store, you can install it manually in Developer Mode:

1.  **Clone or Download** this repository to a folder on your computer.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the folder where you downloaded this project.

## Usage

1.  Log in to [app.folo.is](https://app.folo.is/).
2.  Scroll through your timeline to load the articles you want to process.
3.  Click the **Follow Exporter** icon in your browser toolbar.
4.  (Optional) Uncheck "Only Unread Articles" if you want to export everything.
5.  Click **Copy to Clipboard**.
6.  Paste the result into your notes app or text editor.

## Development

### Project Structure

- `manifest.json`: Configuration using Manifest V3.
- `content.js`: The logic that runs on the web page to find and extract links.
- `popup.html` & `popup.js`: The user interface for the extension action.

### Local Setup

1.  Make changes to the code (e.g., `content.js` logic).
2.  Go to `chrome://extensions/`.
3.  Find "SuperMe: RSS Exporter" and click the **Refresh** (circular arrow) icon.
4.  Reload the Follow.is web page to apply changes.

## License

MIT License. Feel free to fork and modify!
