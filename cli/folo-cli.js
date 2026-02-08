#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_API_BASE = 'https://api.folo.is';
const DEFAULT_WEB_URL = 'https://app.folo.is';
const API_MAX_LIMIT = 100;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_REQUESTS = 50;

function printHelp() {
  console.log(`Folo Exporter CLI

Usage:
  folo-exporter <command> [options]

Commands:
  login        Launch browser to login and save session state
  check-auth   Validate current session against Folo API
  fetch        Export unread entries to JSON or Markdown

Common options:
  --state <path>     Storage state JSON path (default: ~/.folo-exporter/storage-state.json)
  --cookie <string>  Raw cookie header (overrides --state)

fetch options:
  --format <type>    json | grouped | list (default: json)
  --out <path>       Output file path. If omitted, prints to stdout
  --batch-size <n>   Entries per request, max 100 (default: 100)
  --max-requests <n> Safety cap for paginated requests (default: 50)

login options:
  --headless <bool>  true | false (default: false)
  --timeout <sec>    Wait max seconds for successful login (default: 300)

Examples:
  folo-exporter login --state ~/.folo-exporter/storage-state.json
  folo-exporter check-auth --state ~/.folo-exporter/storage-state.json
  folo-exporter fetch --format json --out ./folo-export.json
  folo-exporter fetch --cookie "__Secure-next-auth.session-token=..." --format grouped
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {};

  while (args.length > 0) {
    const token = args.shift();
    if (!token.startsWith('--')) {
      throw new Error(`Unknown argument: ${token}`);
    }

    const key = token.slice(2);
    const next = args[0];

    if (!next || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = args.shift();
    }
  }

  return { command, options };
}

function resolveStatePath(rawPath) {
  if (!rawPath) {
    return path.join(os.homedir(), '.folo-exporter', 'storage-state.json');
  }
  if (rawPath.startsWith('~/')) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return path.resolve(rawPath);
}

function toInt(value, fallback, keyName) {
  if (value == null) return fallback;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${keyName}: ${value}`);
  }
  return n;
}

function parseBool(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadStorageState(statePath) {
  if (!fs.existsSync(statePath)) {
    throw new Error(`Storage state not found: ${statePath}`);
  }
  const raw = fs.readFileSync(statePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.cookies)) {
    throw new Error(`Invalid storage state file (cookies missing): ${statePath}`);
  }
  return parsed;
}

function cookieDomainMatches(cookieDomain, hostname) {
  if (!cookieDomain) return false;
  const domain = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function cookiePathMatches(cookiePath, requestPath) {
  const normalized = cookiePath || '/';
  return requestPath.startsWith(normalized);
}

function buildCookieHeaderFromStorageState(storageState, urlString) {
  const url = new URL(urlString);
  const nowSec = Math.floor(Date.now() / 1000);

  const pairs = storageState.cookies
    .filter((cookie) => {
      if (!cookie || !cookie.name) return false;
      if (!cookieDomainMatches(cookie.domain, url.hostname)) return false;
      if (!cookiePathMatches(cookie.path, url.pathname)) return false;
      if (typeof cookie.expires === 'number' && cookie.expires !== -1 && cookie.expires <= nowSec) {
        return false;
      }
      return true;
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`);

  return pairs.join('; ');
}

function normalizeArticle(entry) {
  return {
    id: entry.entries?.id || null,
    title: entry.entries?.title || 'Untitled',
    url: entry.entries?.url || '',
    publishedAt: entry.entries?.publishedAt || null,
    insertedAt: entry.entries?.insertedAt || null,
    summary: entry.entries?.summary || '',
    feedTitle: entry.feeds?.title || 'Unknown',
    category: entry.subscriptions?.category || 'Uncategorized'
  };
}

async function requestEntries({ apiBase, cookieHeader, body }) {
  const response = await fetch(`${apiBase}/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

async function checkAuth({ apiBase, cookieHeader }) {
  const result = await requestEntries({
    apiBase,
    cookieHeader,
    body: { limit: 1, view: -1 }
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: `Auth check failed with status ${result.status}`
    };
  }

  return {
    ok: true,
    status: result.status,
    count: Array.isArray(result.payload.data) ? result.payload.data.length : 0
  };
}

async function fetchAllUnread({ apiBase, cookieHeader, batchSize, maxRequests }) {
  let hasMore = true;
  let requestCount = 0;
  let publishedAfter = null;

  const seenIds = new Set();
  const articles = [];

  while (hasMore) {
    requestCount += 1;
    if (requestCount > maxRequests) {
      break;
    }

    const body = {
      limit: Math.min(batchSize, API_MAX_LIMIT),
      view: -1,
      read: false
    };
    if (publishedAfter) {
      body.publishedAfter = publishedAfter;
    }

    const result = await requestEntries({ apiBase, cookieHeader, body });
    if (!result.ok) {
      throw new Error(`Fetch failed with status ${result.status}`);
    }

    const entries = Array.isArray(result.payload.data) ? result.payload.data : [];
    if (entries.length === 0) {
      hasMore = false;
      continue;
    }

    let newCount = 0;
    for (const rawEntry of entries) {
      const article = normalizeArticle(rawEntry);
      if (!article.id) continue;
      if (seenIds.has(article.id)) continue;
      seenIds.add(article.id);
      articles.push(article);
      newCount += 1;
    }

    if (newCount === 0) {
      hasMore = false;
      continue;
    }

    const lastPublishedAt = entries[entries.length - 1]?.entries?.publishedAt;
    if (lastPublishedAt) {
      publishedAfter = lastPublishedAt;
    }

    if (entries.length < API_MAX_LIMIT) {
      hasMore = false;
    }
  }

  return articles;
}

function generateJsonExport(articles) {
  const now = new Date();
  return JSON.stringify({
    exportTime: now.toISOString(),
    exportTimeFormatted: now.toLocaleString(),
    total: articles.length,
    articles
  }, null, 2);
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatArticleMarkdown(article) {
  let md = `### ${article.title}\n`;
  md += `- Source: ${article.feedTitle}\n`;
  md += `- Time: ${formatDate(article.publishedAt)}\n`;
  md += `- Link: ${article.url}\n`;
  if (article.summary) {
    md += `- Summary: ${article.summary}\n`;
  }
  md += '\n';
  return md;
}

function generateMarkdownExport(articles, format) {
  let md = '# Folo Unread Articles Export\n';
  md += `Export time: ${new Date().toLocaleString()}\n`;
  md += `Total: ${articles.length} articles\n\n`;
  md += '---\n\n';

  if (format === 'grouped') {
    const grouped = new Map();
    for (const article of articles) {
      const key = article.category || 'Uncategorized';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(article);
    }

    const sortedGroups = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [category, items] of sortedGroups) {
      md += `## ${category} (${items.length})\n\n`;
      for (const article of items) {
        md += formatArticleMarkdown(article);
      }
      md += '---\n\n';
    }
  } else {
    const sorted = [...articles].sort((a, b) => {
      const ta = new Date(a.publishedAt || 0).getTime();
      const tb = new Date(b.publishedAt || 0).getTime();
      return tb - ta;
    });
    for (const article of sorted) {
      md += formatArticleMarkdown(article);
    }
  }

  return md;
}

function resolveCookieHeader({ cookieArg, statePath, apiBase }) {
  if (cookieArg) {
    return cookieArg;
  }

  const envCookie = process.env.FOLO_COOKIE;
  if (envCookie) {
    return envCookie;
  }

  const storageState = loadStorageState(statePath);
  const cookieHeader = buildCookieHeaderFromStorageState(storageState, `${apiBase}/entries`);
  if (!cookieHeader) {
    throw new Error('No matching cookies found in storage state. Please login again.');
  }
  return cookieHeader;
}

async function runLogin({ statePath, timeoutSec, headless }) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('playwright is required for login command. Install: npm i playwright');
  }

  ensureDirForFile(statePath);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(DEFAULT_WEB_URL, { waitUntil: 'domcontentloaded' });
  console.log(`Opened ${DEFAULT_WEB_URL}. Please complete login in the browser window.`);

  const deadline = Date.now() + timeoutSec * 1000;
  let authed = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);

    const result = await page.evaluate(async (apiBase) => {
      try {
        const response = await fetch(`${apiBase}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ limit: 1, view: -1 })
        });
        return { ok: response.ok, status: response.status };
      } catch (error) {
        return { ok: false, status: 0, error: String(error?.message || error) };
      }
    }, DEFAULT_API_BASE);

    if (result.ok) {
      authed = true;
      break;
    }
  }

  if (!authed) {
    await browser.close();
    throw new Error(`Login timed out after ${timeoutSec}s`);
  }

  await context.storageState({ path: statePath });
  await browser.close();

  console.log(`Saved storage state to ${statePath}`);
}

async function runCheckAuth({ apiBase, statePath, cookieArg }) {
  const cookieHeader = resolveCookieHeader({ cookieArg, statePath, apiBase });
  const result = await checkAuth({ apiBase, cookieHeader });

  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 2;
    return;
  }

  console.log(`Auth OK (status ${result.status}, sample entries: ${result.count})`);
}

async function runFetch({ apiBase, statePath, cookieArg, format, out, batchSize, maxRequests }) {
  if (!['json', 'grouped', 'list'].includes(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }

  const cookieHeader = resolveCookieHeader({ cookieArg, statePath, apiBase });
  const auth = await checkAuth({ apiBase, cookieHeader });
  if (!auth.ok) {
    throw new Error(`Auth invalid (status ${auth.status}). Re-login required.`);
  }

  const articles = await fetchAllUnread({ apiBase, cookieHeader, batchSize, maxRequests });

  let output;
  if (format === 'json') {
    output = generateJsonExport(articles);
  } else {
    output = generateMarkdownExport(articles, format);
  }

  if (out) {
    const outputPath = path.resolve(out);
    ensureDirForFile(outputPath);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Exported ${articles.length} articles -> ${outputPath}`);
  } else {
    process.stdout.write(output);
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === '-h' || options.help || options.h) {
    printHelp();
    return;
  }

  const apiBase = String(options['api-base'] || DEFAULT_API_BASE);
  const statePath = resolveStatePath(options.state);
  const cookieArg = options.cookie ? String(options.cookie) : null;

  if (command === 'login') {
    const timeoutSec = toInt(options.timeout, 300, 'timeout');
    const headless = parseBool(options.headless, false);
    await runLogin({ statePath, timeoutSec, headless });
    return;
  }

  if (command === 'check-auth') {
    await runCheckAuth({ apiBase, statePath, cookieArg });
    return;
  }

  if (command === 'fetch') {
    const format = String(options.format || 'json');
    const out = options.out ? String(options.out) : null;
    const batchSize = toInt(options['batch-size'], DEFAULT_BATCH_SIZE, 'batch-size');
    const maxRequests = toInt(options['max-requests'], DEFAULT_MAX_REQUESTS, 'max-requests');

    await runFetch({
      apiBase,
      statePath,
      cookieArg,
      format,
      out,
      batchSize,
      maxRequests
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
