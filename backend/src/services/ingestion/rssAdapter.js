const Parser = require('rss-parser');
const crypto = require('crypto');

const parser = new Parser({
  customFields: {
    item: ['description', 'content:encoded'],
  },
});

/**
 * Computes SHA-256 fingerprint from string
 */
const computeFingerprint = (content) => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Extracts capacity, technology, and location from text snippet
 */
const extractRenewableEntities = (text = '') => {
  const result = {
    capacity_mw: null,
    technology: 'solar',
    state: null,
  };

  // 1. Capacity MW pattern (e.g., 300 MW, 250MW, 50.5 MW)
  const mwMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:MW|mw|megawatt)/i);
  if (mwMatch) {
    result.capacity_mw = parseFloat(mwMatch[1]);
  }

  // 2. Technology pattern
  if (/wind\s*(?:farm|power|energy|project)/i.test(text)) {
    result.technology = 'wind';
  } else if (/hybrid\s*(?:wind|solar|power|project)/i.test(text)) {
    result.technology = 'hybrid';
  } else if (/battery|storage|bess/i.test(text)) {
    result.technology = 'storage';
  } else {
    result.technology = 'solar';
  }

  // 3. Indian states pattern
  const states = [
    'Rajasthan', 'Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu',
    'Madhya Pradesh', 'Andhra Pradesh', 'Telangana', 'Uttar Pradesh',
    'Punjab', 'Haryana', 'Odisha', 'Kerala'
  ];
  for (const s of states) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(text)) {
      result.state = s;
      break;
    }
  }

  return result;
};

/**
 * Fetches and parses an RSS feed URL
 * @param {string} feedUrl
 * @returns {Promise<Array<Object>>}
 */
const fetchRssFeed = async (feedUrl) => {
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = [];

    for (const entry of feed.items) {
      const fullText = `${entry.title || ''} ${entry.contentSnippet || entry.content || entry.description || ''}`;
      const fingerprint = computeFingerprint(entry.guid || entry.link || fullText);
      const extracted = extractRenewableEntities(fullText);

      items.push({
        fingerprint,
        title: entry.title || 'Untitled Notice',
        link: entry.link || feedUrl,
        pubDate: entry.pubDate ? new Date(entry.pubDate) : new Date(),
        rawContent: fullText,
        capacity_mw: extracted.capacity_mw,
        technology: extracted.technology,
        state: extracted.state,
      });
    }

    return items;
  } catch (err) {
    console.error('Error fetching RSS feed:', feedUrl, err.message);
    throw err;
  }
};

module.exports = {
  fetchRssFeed,
  computeFingerprint,
  extractRenewableEntities,
};
