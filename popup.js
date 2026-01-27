/**
 * Folo Exporter - Popup Script
 * Fetches unread articles from Folo API and exports to Markdown
 */

const API_BASE = 'https://api.folo.is';
const BATCH_SIZE = 200;  // 请求大小
const API_MAX_LIMIT = 100;  // API 实际上限
const CACHE_KEY = 'folo_cache';

// State
let articles = [];
let seenIds = new Set();
let cacheData = null;
let isRefreshing = false;

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const fetchBtn = document.getElementById('fetch-btn');
const fetchBtnText = document.getElementById('fetch-btn-text');
const clearBtn = document.getElementById('clear-btn');
const cacheStatus = document.getElementById('cache-status');
const cacheText = document.getElementById('cache-text');
const progress = document.getElementById('progress');
const progressCount = document.getElementById('progress-count');
const results = document.getElementById('results');
const totalCount = document.getElementById('total-count');
const categoryList = document.getElementById('category-list');
const exportSection = document.getElementById('export-section');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const message = document.getElementById('message');

// Cache Module
const Cache = {
  async save(articles) {
    const data = {
      articles,
      fetchTime: Date.now(),
      count: articles.length
    };
    await chrome.storage.local.set({ [CACHE_KEY]: data });
    cacheData = data;
  },

  async load() {
    const result = await chrome.storage.local.get(CACHE_KEY);
    return result[CACHE_KEY] || null;
  },

  async clear() {
    await chrome.storage.local.remove(CACHE_KEY);
    cacheData = null;
  },

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  },

  isStale(timestamp) {
    const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
    return Date.now() - timestamp > STALE_THRESHOLD;
  }
};

// UI Module
const UI = {
  showCacheStatus(count, fetchTime) {
    const timeAgo = Cache.formatTime(fetchTime);
    const isStale = Cache.isStale(fetchTime);

    cacheText.textContent = `上次更新: ${timeAgo} (${count} 篇)`;
    cacheStatus.classList.remove('hidden');

    if (isStale) {
      cacheStatus.classList.add('stale');
    } else {
      cacheStatus.classList.remove('stale');
    }
  },

  hideCacheStatus() {
    cacheStatus.classList.add('hidden');
  },

  showClearButton() {
    clearBtn.classList.remove('hidden');
  },

  hideClearButton() {
    clearBtn.classList.add('hidden');
  },

  setRefreshing(isRefreshing) {
    if (isRefreshing) {
      fetchBtn.disabled = true;
      fetchBtnText.textContent = '刷新中...';
    } else {
      fetchBtn.disabled = false;
      fetchBtnText.textContent = 'Fetch Unread Articles';
    }
  },

  setExportEnabled(enabled) {
    copyBtn.disabled = !enabled;
    downloadBtn.disabled = !enabled;
  }
};

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

  // Load cached data
  const cached = await Cache.load();
  if (cached && cached.articles.length > 0) {
    cacheData = cached;
    articles = cached.articles;
    displayResults();
    results.classList.remove('hidden');
    exportSection.classList.remove('hidden');
    UI.showCacheStatus(cached.count, cached.fetchTime);
    UI.showClearButton();
    UI.setExportEnabled(true);
  }

  // Event listeners
  fetchBtn.addEventListener('click', handleFetch);
  clearBtn.addEventListener('click', handleClear);
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
  UI.hideCacheStatus();
  UI.hideClearButton();

  // Show progress
  isRefreshing = true;
  UI.setRefreshing(true);
  progress.classList.remove('hidden');
  progressCount.textContent = '0';

  try {
    // Fetch all unread articles
    await fetchAllUnread();

    // Save to cache
    await Cache.save(articles);

    // Show results
    progress.classList.add('hidden');
    UI.setRefreshing(false);

    if (articles.length === 0) {
      showMessage('No unread articles found', 'success');
      return;
    }

    displayResults();
    results.classList.remove('hidden');
    exportSection.classList.remove('hidden');
    UI.showCacheStatus(articles.length, Date.now());
    UI.showClearButton();
    UI.setExportEnabled(true);

  } catch (e) {
    console.error('Fetch error:', e);
    progress.classList.add('hidden');
    UI.setRefreshing(false);

    // Restore previous cache if available
    if (cacheData && cacheData.articles.length > 0) {
      articles = cacheData.articles;
      displayResults();
      results.classList.remove('hidden');
      exportSection.classList.remove('hidden');
      UI.showCacheStatus(cacheData.count, cacheData.fetchTime);
      UI.showClearButton();
    }

    showMessage(`Error: ${e.message}`, 'error');
  }
}

async function handleClear() {
  await Cache.clear();
  articles = [];
  seenIds = new Set();
  results.classList.add('hidden');
  exportSection.classList.add('hidden');
  UI.hideCacheStatus();
  UI.hideClearButton();
  UI.setExportEnabled(false);
  showMessage('Cache cleared', 'success');
}

async function fetchAllUnread() {
  let hasMore = true;
  let publishedBefore = null;
  let requestCount = 0;

  while (hasMore) {
    requestCount++;
    const body = {
      limit: BATCH_SIZE,
      view: -1,
      read: false
    };
    if (publishedBefore) {
      body.publishedBefore = publishedBefore;
    }

    console.log(`[Folo Exporter] Request #${requestCount}: limit=${BATCH_SIZE}, publishedBefore=${publishedBefore || 'none'}`);

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

    console.log(`[Folo Exporter] Response #${requestCount}: got ${entries.length} entries`);

    if (entries.length === 0) {
      hasMore = false;
    } else {
      // Process entries (with deduplication)
      const beforeCount = articles.length;
      for (const entry of entries) {
        const id = entry.entries?.id;
        if (id && seenIds.has(id)) {
          continue; // Skip duplicate
        }
        if (id) {
          seenIds.add(id);
        }
        articles.push({
          id: id,
          title: entry.entries?.title || 'Untitled',
          url: entry.entries?.url || '',
          publishedAt: entry.entries?.publishedAt,
          summary: entry.entries?.summary || '',
          feedTitle: entry.feeds?.title || 'Unknown',
          category: entry.subscriptions?.category || 'Uncategorized'
        });
      }

      progressCount.textContent = articles.length;
      // Use the last entry's publishedAt as the cursor for next request
      const lastEntry = entries[entries.length - 1];
      if (lastEntry?.entries?.publishedAt) {
        publishedBefore = lastEntry.entries.publishedAt;
      }

      // If we got less than API's max limit, we're done
      if (entries.length < API_MAX_LIMIT) {
        hasMore = false;
      }
      // If all entries were duplicates, we're also done
      else if (articles.length === beforeCount) {
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
