/**
 * Folo Exporter - Popup Script
 * Fetches unread articles from Folo API and exports to Markdown
 */

const API_BASE = 'https://api.folo.is';
const BATCH_SIZE = 100;

// State
let articles = [];
let seenIds = new Set();

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const fetchBtn = document.getElementById('fetch-btn');
const fetchBtnText = document.getElementById('fetch-btn-text');
const progress = document.getElementById('progress');
const progressCount = document.getElementById('progress-count');
const results = document.getElementById('results');
const totalCount = document.getElementById('total-count');
const categoryList = document.getElementById('category-list');
const exportSection = document.getElementById('export-section');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const message = document.getElementById('message');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Check connection
  const connected = await checkConnection();

  if (connected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected to Folo';
    fetchBtn.disabled = false;
  } else {
    statusDot.classList.add('error');
    statusText.textContent = 'Please login to Folo first';
  }

  // Event listeners
  fetchBtn.addEventListener('click', handleFetch);
  copyBtn.addEventListener('click', handleCopy);
  downloadBtn.addEventListener('click', handleDownload);
}

async function checkConnection() {
  try {
    const response = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ limit: 1, view: -1 })
    });
    return response.ok;
  } catch (e) {
    console.error('Connection check failed:', e);
    return false;
  }
}

async function handleFetch() {
  // Reset state
  articles = [];
  seenIds = new Set();
  hideMessage();
  results.classList.add('hidden');
  exportSection.classList.add('hidden');

  // Show progress
  fetchBtn.disabled = true;
  fetchBtnText.textContent = 'Fetching...';
  progress.classList.remove('hidden');
  progressCount.textContent = '0';

  try {
    // Fetch all unread articles
    await fetchAllUnread();

    // Show results
    progress.classList.add('hidden');
    fetchBtn.disabled = false;
    fetchBtnText.textContent = 'Fetch Unread Articles';

    if (articles.length === 0) {
      showMessage('No unread articles found', 'success');
      return;
    }

    displayResults();
    results.classList.remove('hidden');
    exportSection.classList.remove('hidden');

  } catch (e) {
    console.error('Fetch error:', e);
    progress.classList.add('hidden');
    fetchBtn.disabled = false;
    fetchBtnText.textContent = 'Fetch Unread Articles';
    showMessage(`Error: ${e.message}`, 'error');
  }
}

async function fetchAllUnread() {
  let hasMore = true;
  let insertedBefore = null;
  let consecutiveAllDuplicates = 0;

  while (hasMore) {
    const body = {
      limit: BATCH_SIZE,
      view: -1,
      read: false
    };

    if (insertedBefore) {
      body.insertedBefore = insertedBefore;
    }

    const response = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch articles');
    }

    const result = await response.json();
    const entries = result.data || [];

    if (entries.length === 0) {
      hasMore = false;
    } else {
      // Process entries (with deduplication)
      let newCount = 0;
      for (const entry of entries) {
        const id = entry.entries?.id;
        if (id && seenIds.has(id)) {
          continue; // Skip duplicate
        }
        if (id) {
          seenIds.add(id);
        }
        newCount++;
        articles.push({
          id: id,
          title: entry.entries?.title || 'Untitled',
          url: entry.entries?.url || '',
          publishedAt: entry.entries?.publishedAt,
          insertedAt: entry.entries?.insertedAt,
          summary: entry.entries?.summary || '',
          feedTitle: entry.feeds?.title || 'Unknown',
          category: entry.subscriptions?.category || 'Uncategorized'
        });
      }

      progressCount.textContent = articles.length;

      // Safety check: if all entries were duplicates, stop
      if (newCount === 0) {
        consecutiveAllDuplicates++;
        if (consecutiveAllDuplicates >= 2) {
          hasMore = false;
          continue;
        }
      } else {
        consecutiveAllDuplicates = 0;
      }

      // Get the oldest insertedAt for next batch
      const lastEntry = entries[entries.length - 1];
      insertedBefore = lastEntry.entries?.insertedAt;

      // If we got less than BATCH_SIZE, we're done
      if (entries.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  }
}

function displayResults() {
  totalCount.textContent = articles.length;

  // Group by category
  const categories = {};
  for (const article of articles) {
    const cat = article.category;
    if (!categories[cat]) {
      categories[cat] = 0;
    }
    categories[cat]++;
  }

  // Sort by count descending
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  // Render
  categoryList.innerHTML = sorted.map(([name, count]) => `
    <div class="category-item">
      <span class="category-name">${escapeHtml(name)}</span>
      <span class="category-count">${count}</span>
    </div>
  `).join('');
}

function generateMarkdown() {
  const format = document.querySelector('input[name="format"]:checked').value;
  const now = new Date().toLocaleString();

  let md = `# Folo Unread Articles Export\n`;
  md += `Export time: ${now}\n`;
  md += `Total: ${articles.length} articles\n\n`;
  md += `---\n\n`;

  if (format === 'grouped') {
    // Group by category
    const grouped = {};
    for (const article of articles) {
      const cat = article.category;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(article);
    }

    // Sort categories by count
    const sortedCats = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

    for (const [category, items] of sortedCats) {
      md += `## ${category} (${items.length})\n\n`;

      for (const article of items) {
        md += formatArticle(article);
      }

      md += `---\n\n`;
    }
  } else {
    // Flat list sorted by time
    const sorted = [...articles].sort((a, b) =>
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    for (const article of sorted) {
      md += formatArticle(article);
    }
  }

  return md;
}

function formatArticle(article) {
  let md = `### ${article.title}\n`;
  md += `- Source: ${article.feedTitle}\n`;
  md += `- Time: ${formatDate(article.publishedAt)}\n`;
  md += `- Link: ${article.url}\n`;

  if (article.summary) {
    md += `- Summary: ${article.summary}\n`;
  }

  md += `\n`;
  return md;
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleString();
}

async function handleCopy() {
  const markdown = generateMarkdown();

  try {
    await navigator.clipboard.writeText(markdown);
    showMessage('Copied to clipboard!', 'success');
  } catch (e) {
    console.error('Copy failed:', e);
    showMessage('Failed to copy', 'error');
  }
}

function handleDownload() {
  const markdown = generateMarkdown();
  const now = new Date().toISOString().split('T')[0];
  const filename = `folo-export-${now}.md`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
  showMessage(`Downloaded ${filename}`, 'success');
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
  message.classList.remove('hidden');

  setTimeout(() => {
    message.classList.add('hidden');
  }, 3000);
}

function hideMessage() {
  message.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
