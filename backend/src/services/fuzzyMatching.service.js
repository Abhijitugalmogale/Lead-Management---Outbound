const levenshtein = require('fast-levenshtein');
const { normalizeCompanyName } = require('../controllers/company.controller');

/**
 * Calculates similarity ratio between two strings from 0.0 to 1.0
 */
const calculateSimilarity = (str1 = '', str2 = '') => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const distance = levenshtein.get(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return 1.0 - distance / maxLength;
};

/**
 * Compares a candidate company name with a list of existing companies
 * @param {string} candidateName Raw company name
 * @param {Array<{ company_id: string, legal_name: string, normalized_name: string }>} existingCompanies
 * @param {number} threshold Default 0.82 (82% similarity)
 * @returns {Array<{ company: Object, similarity: number, isExactMatch: boolean }>}
 */
const findMatchingCompanies = (candidateName, existingCompanies = [], threshold = 0.82) => {
  const normCandidate = normalizeCompanyName(candidateName);
  if (!normCandidate) return [];

  const matches = [];

  for (const existing of existingCompanies) {
    const normExisting = existing.normalized_name || normalizeCompanyName(existing.legal_name);

    // Exact normalized match
    if (normCandidate === normExisting) {
      matches.push({
        company: existing,
        similarity: 1.0,
        isExactMatch: true,
      });
      continue;
    }

    // Levenshtein ratio
    const sim = calculateSimilarity(normCandidate, normExisting);
    if (sim >= threshold) {
      matches.push({
        company: existing,
        similarity: parseFloat(sim.toFixed(3)),
        isExactMatch: false,
      });
    }
  }

  // Sort descending by similarity
  return matches.sort((a, b) => b.similarity - a.similarity);
};

module.exports = {
  calculateSimilarity,
  findMatchingCompanies,
};
