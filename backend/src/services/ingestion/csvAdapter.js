const fs = require('fs');
const csv = require('csv-parser');
const crypto = require('crypto');

/**
 * Normalizes CSV headers to standardized keys
 */
const mapHeaderKey = (rawHeader = '') => {
  const h = rawHeader.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (h.includes('project') && (h.includes('name') || h.includes('title'))) return 'project_name';
  if (h.includes('capacity') || h.includes('mw')) return 'capacity_mw';
  if (h.includes('developer') || h.includes('company') || h.includes('owner') || h.includes('promoter')) return 'company_name';
  if (h.includes('tech') || h.includes('source') || h.includes('type')) return 'technology';
  if (h.includes('state')) return 'state';
  if (h.includes('district') || h.includes('location')) return 'district';
  if (h.includes('cod') || h.includes('commission')) return 'expected_cod';
  if (h.includes('status') || h.includes('stage')) return 'stage';
  return h;
};

/**
 * Parses CSV file from disk into standardized project objects
 * @param {string} filePath
 * @returns {Promise<Array<Object>>}
 */
const parseProjectCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => mapHeaderKey(header),
        })
      )
      .on('data', (row) => {
        // Compute SHA-256 fingerprint for row
        const rowString = JSON.stringify(row);
        const fingerprint = crypto.createHash('sha256').update(rowString).digest('hex');

        // Parse capacity
        let capacity_mw = null;
        if (row.capacity_mw) {
          const parsed = parseFloat(row.capacity_mw.toString().replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed)) capacity_mw = parsed;
        }

        // Normalize technology
        let technology = 'solar';
        const techVal = (row.technology || '').toLowerCase();
        if (techVal.includes('wind')) technology = 'wind';
        else if (techVal.includes('hybrid')) technology = 'hybrid';
        else if (techVal.includes('storage') || techVal.includes('bess')) technology = 'storage';

        results.push({
          fingerprint,
          project_name: row.project_name || 'Unnamed Renewable Project',
          company_name: row.company_name || null,
          technology,
          capacity_mw,
          state: row.state || null,
          district: row.district || null,
          stage: row.stage || 'planned',
          expected_cod: row.expected_cod || null,
          raw_data: row,
        });
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

module.exports = {
  parseProjectCsv,
};
