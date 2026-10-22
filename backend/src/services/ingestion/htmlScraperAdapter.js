const cheerio = require('cheerio');
const crypto = require('crypto');
const { extractRenewableEntities } = require('./rssAdapter');

/**
 * Extracts renewable project tables or cards from static HTML string
 * @param {string} htmlContent
 * @param {string} sourceUrl
 * @returns {Array<Object>}
 */
const parseHtmlProjects = (htmlContent, sourceUrl = '') => {
  const $ = cheerio.load(htmlContent);
  const projects = [];

  // 1. Look for tabular data (e.g. <table> rows)
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const rowText = $(row).text().replace(/\s+/g, ' ').trim();
      const fingerprint = crypto.createHash('sha256').update(rowText).digest('hex');
      const extracted = extractRenewableEntities(rowText);

      // Attempt to extract project name from first or second cell
      const col1 = $(cells[0]).text().trim();
      const col2 = $(cells[1]).text().trim();
      const col3 = cells.length > 2 ? $(cells[2]).text().trim() : '';

      projects.push({
        fingerprint,
        project_name: col2.length > col1.length ? col2 : col1,
        company_name: col3 || null,
        capacity_mw: extracted.capacity_mw,
        technology: extracted.technology,
        state: extracted.state,
        source_url: sourceUrl,
        raw_text: rowText,
      });
    }
  });

  return projects;
};

module.exports = {
  parseHtmlProjects,
};
