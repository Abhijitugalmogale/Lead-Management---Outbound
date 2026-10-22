const { execFile } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { extractRenewableEntities } = require('./rssAdapter');

/**
 * Executes Python pdfplumber script to extract tables and text from PDF
 * @param {string} filePath Absolute path to PDF file
 * @returns {Promise<Object>}
 */
const extractPdfData = (filePath) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '../../scripts/extract_pdf.py');

    // Call Python 3.11 with the script
    execFile('py', ['-3.11', scriptPath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`PDF extraction failed: ${error.message} - ${stderr}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.success) {
          return reject(new Error(parsed.error || 'Unknown PDF extraction error'));
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse PDF script output: ${err.message}`));
      }
    });
  });
};

/**
 * Transforms extracted PDF data into candidate renewable project records
 * @param {string} filePath
 * @returns {Promise<Array<Object>>}
 */
const parsePdfProjects = async (filePath) => {
  const data = await extractPdfData(filePath);
  const projects = [];

  // Process extracted tables
  if (data.tables && data.tables.length > 0) {
    for (const tbl of data.tables) {
      const rows = tbl.rows;
      if (!rows || rows.length < 2) continue;

      const header = rows[0].map((c) => (c ? c.toLowerCase() : ''));

      // Find index of column names
      let nameIdx = header.findIndex((h) => h.includes('project') || h.includes('location') || h.includes('plant'));
      let capIdx = header.findIndex((h) => h.includes('mw') || h.includes('capacity'));
      let devIdx = header.findIndex((h) => h.includes('developer') || h.includes('company') || h.includes('bidder'));

      if (nameIdx === -1) nameIdx = 0;
      if (devIdx === -1 && rows[0].length > 1) devIdx = 1;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const rowText = row.filter(Boolean).join(' ');
        const fingerprint = crypto.createHash('sha256').update(rowText).digest('hex');
        const extracted = extractRenewableEntities(rowText);

        const projName = row[nameIdx] ? row[nameIdx].trim() : 'RE Tender Project';
        const compName = devIdx !== -1 && row[devIdx] ? row[devIdx].trim() : null;

        let capacity = extracted.capacity_mw;
        if (capIdx !== -1 && row[capIdx]) {
          const capParsed = parseFloat(row[capIdx].toString().replace(/[^0-9.]/g, ''));
          if (!isNaN(capParsed)) capacity = capParsed;
        }

        projects.push({
          fingerprint,
          project_name: projName,
          company_name: compName,
          capacity_mw: capacity,
          technology: extracted.technology,
          state: extracted.state,
          raw_data: { table_page: tbl.page, row_cells: row },
        });
      }
    }
  }

  // If no tables, extract candidate mentions from full text
  if (projects.length === 0 && data.full_text) {
    const lines = data.full_text.split('\n').filter((l) => l.trim().length > 10);
    for (const line of lines) {
      if (/(\d+(?:\.\d+)?)\s*(?:MW|mw)/i.test(line)) {
        const fingerprint = crypto.createHash('sha256').update(line).digest('hex');
        const extracted = extractRenewableEntities(line);
        projects.push({
          fingerprint,
          project_name: 'RE Project Notice',
          company_name: null,
          capacity_mw: extracted.capacity_mw,
          technology: extracted.technology,
          state: extracted.state,
          raw_data: { snippet: line.trim() },
        });
      }
    }
  }

  return projects;
};

module.exports = {
  extractPdfData,
  parsePdfProjects,
};
