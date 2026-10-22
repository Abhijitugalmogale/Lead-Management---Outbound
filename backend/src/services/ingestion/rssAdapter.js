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

const decodeHtmlEntities = (text = '') => {
  return text
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
};

/**
 * Extracts capacity, technology, company, and location from text snippet
 */
const extractRenewableEntities = (text = '') => {
  const result = {
    capacity_mw: null,
    technology: 'solar',
    state: null,
    company_name: null,
  };

  const clean = decodeHtmlEntities(text);

  // 1. Capacity MW / GW pattern (e.g., 300 MW, 1.2 GW, 500 megawatt)
  const gwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:GW|gw|gigawatt)/i);
  if (gwMatch) {
    result.capacity_mw = parseFloat(gwMatch[1]) * 1000;
  } else {
    const mwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:MW|mw|megawatt)/i);
    if (mwMatch) {
      result.capacity_mw = parseFloat(mwMatch[1]);
    }
  }

  // 2. Technology pattern
  if (/wind\s*(?:farm|power|energy|project|turbine)/i.test(clean)) {
    result.technology = 'wind';
  } else if (/hybrid\s*(?:wind|solar|power|project)/i.test(clean)) {
    result.technology = 'hybrid';
  } else if (/battery|storage|bess|pumped\s*storage/i.test(clean)) {
    result.technology = 'storage';
  } else if (/ev\s*charging|electric\s*vehicle/i.test(clean)) {
    result.technology = 'ev_charging';
  } else {
    result.technology = 'solar';
  }

  // 3. Indian states pattern
  const states = [
    'Rajasthan', 'Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu',
    'Madhya Pradesh', 'Andhra Pradesh', 'Telangana', 'Uttar Pradesh',
    'Punjab', 'Haryana', 'Odisha', 'Kerala', 'Bihar', 'West Bengal',
    'Assam', 'Chhattisgarh', 'Jharkhand', 'Himachal Pradesh', 'Uttarakhand',
    'Goa', 'Jammu & Kashmir', 'Ladakh'
  ];
  for (const s of states) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(clean)) {
      result.state = s;
      break;
    }
  }

  // 4. Known renewable developers & energy companies
  const companies = [
    { name: 'Adani Green Energy Limited', regex: /\b(Adani(?:\s+Green)?)\b/i },
    { name: 'Tata Power Renewable Energy Limited', regex: /\b(Tata\s+Power(?:\s+Renewable)?)\b/i },
    { name: 'NTPC Renewable Energy Limited', regex: /\b(NTPC(?:\s+Green|\s+Renewable|\s+REL)?)\b/i },
    { name: 'ReNew Power Private Limited', regex: /\b(ReNew(?:\s+Power)?)\b/i },
    { name: 'Azure Power India Private Limited', regex: /\b(Azure\s+Power)\b/i },
    { name: 'Avaada Energy Private Limited', regex: /\b(Avaada(?:\s+Energy)?)\b/i },
    { name: 'ACME Solar Holdings Private Limited', regex: /\b(ACME(?:\s+Solar)?)\b/i },
    { name: 'Hero Future Energies Private Limited', regex: /\b(Hero\s+Future\s+Energies)\b/i },
    { name: 'Suzlon Energy Limited', regex: /\b(Suzlon(?:\s+Energy)?)\b/i },
    { name: 'JSW Neo Energy Limited', regex: /\b(JSW(?:\s+Energy|\s+Neo)?)\b/i },
    { name: 'Torrent Power Limited', regex: /\b(Torrent\s+Power)\b/i },
    { name: 'SJVN Green Energy Limited', regex: /\b(SJVN(?:\s+Green)?)\b/i },
    { name: 'NHPC Renewable Energy Limited', regex: /\b(NHPC)\b/i },
    { name: 'CleanMax Solar', regex: /\b(CleanMax)\b/i },
    { name: 'AmpIn Energy Transition', regex: /\b(AmpIn|Amp\s+Energy)\b/i },
    { name: 'Serentica Renewables', regex: /\b(Serentica)\b/i },
    { name: 'Ayana Renewable Power', regex: /\b(Ayana(?:\s+Renewable)?)\b/i },
    { name: 'Waaree Energies Limited', regex: /\b(Waaree(?:\s+Energies)?)\b/i },
    { name: 'Vikram Solar Limited', regex: /\b(Vikram\s+Solar)\b/i },
    { name: 'Premier Energies Limited', regex: /\b(Premier\s+Energies)\b/i },
    { name: 'Inox Wind Limited', regex: /\b(Inox\s+Wind)\b/i },
    { name: 'KPI Green Energy Limited', regex: /\b(KPI\s+Green)\b/i },
    { name: 'Gensol Engineering Limited', regex: /\b(Gensol(?:\s+Engineering)?)\b/i },
    { name: 'Navitas Solar', regex: /\b(Navitas(?:\s+Solar)?)\b/i },
    { name: 'WattPower', regex: /\b(WattPower)\b/i }
  ];

  for (const c of companies) {
    if (c.regex.test(clean)) {
      result.company_name = c.name;
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
      const cleanTitle = decodeHtmlEntities(entry.title || 'Untitled Renewable Notice').trim();
      const rawText = `${cleanTitle} ${entry.contentSnippet || entry.content || entry.description || ''}`;
      const fullText = decodeHtmlEntities(rawText);
      const fingerprint = computeFingerprint(entry.guid || entry.link || fullText);
      const extracted = extractRenewableEntities(fullText);

      items.push({
        fingerprint,
        project_name: cleanTitle,
        title: cleanTitle,
        link: entry.link || feedUrl,
        source_url: entry.link || feedUrl,
        pubDate: entry.pubDate ? new Date(entry.pubDate) : new Date(),
        rawContent: fullText,
        capacity_mw: extracted.capacity_mw,
        technology: extracted.technology,
        state: extracted.state,
        company_name: extracted.company_name,
        raw_data: { snippet: fullText.substring(0, 500), feed_source: feed.title || feedUrl }
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
  decodeHtmlEntities,
};
