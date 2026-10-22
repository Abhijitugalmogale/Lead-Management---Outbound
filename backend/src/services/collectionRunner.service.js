const db = require('../db');
const localStore = require('../db/localStore');
const { fetchRssFeed } = require('./ingestion/rssAdapter');
const { parseProjectCsv } = require('./ingestion/csvAdapter');
const { parsePdfProjects } = require('./ingestion/pdfExtractor');
const { findMatchingCompanies } = require('./fuzzyMatching.service');
const { normalizeCompanyName } = require('../controllers/company.controller');

/**
 * Runs a collection job for a specific data source or uploaded file
 * @param {Object} options
 * @param {string} options.dataSourceId
 * @param {string} options.fileType ('csv' | 'pdf' | 'rss')
 * @param {string} options.filePath Local path to file (if file-based)
 * @param {string} options.sourceUrl URL (if RSS / web-based)
 * @returns {Promise<Object>} Job run summary
 */
const runCollection = async ({ dataSourceId, fileType, filePath, sourceUrl }) => {
  let jobRunId = null;
  const stats = {
    records_read: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    records_rejected: 0,
    sent_for_review: 0,
    errors: [],
  };

  const source = dataSourceId ? localStore.getSourceById(dataSourceId) : null;
  const sourceName = source ? source.name : (sourceUrl ? `Live Feed: ${sourceUrl}` : 'Document Upload');
  const sourceType = source ? source.source_type : (fileType === 'rss' ? 'news_feed' : 'manual_research');

  // 1. Create Job Run record in localStore & DB if connected
  const localJob = localStore.createJobRun({
    data_source_id: dataSourceId || null,
    source_name: sourceName,
    source_type: sourceType,
    status: 'running',
    started_at: new Date().toISOString()
  });
  jobRunId = localJob.job_run_id;

  if (db.isConnected) {
    try {
      const jobRes = await db.query(
        `INSERT INTO job_run (job_type, data_source_id, status, started_at)
         VALUES ('source_collection', $1, 'running', CURRENT_TIMESTAMP)
         RETURNING job_run_id`,
        [dataSourceId || null]
      );
      if (jobRes.rows[0]) {
        jobRunId = jobRes.rows[0].job_run_id;
      }
    } catch (e) {
      console.warn('DB job_run insert skipped:', e.message);
    }
  }

  try {
    let items = [];

    // 2. Fetch/Parse based on source type
    if (fileType === 'rss' || sourceUrl) {
      items = await fetchRssFeed(sourceUrl);
    } else if (fileType === 'csv' && filePath) {
      items = await parseProjectCsv(filePath);
    } else if (fileType === 'pdf' && filePath) {
      items = await parsePdfProjects(filePath);
    } else {
      throw new Error(`Unsupported source type or missing path: ${fileType}`);
    }

    stats.records_read = items.length;

    // 3. Load existing companies for fuzzy duplicate checking
    let existingCompanies = [];
    if (db.isConnected) {
      try {
        const compRes = await db.query('SELECT company_id, legal_name, normalized_name FROM company WHERE status = $1', ['active']);
        existingCompanies = compRes.rows;
      } catch (e) {
        existingCompanies = localStore.getCompanies();
      }
    } else {
      existingCompanies = localStore.getCompanies();
    }

    // 4. Process each discovered item
    for (const item of items) {
      const fingerprint = item.fingerprint;

      // Check deduplication key in DB if connected
      if (db.isConnected && dataSourceId && fingerprint) {
        try {
          const itemExists = await db.query(
            'SELECT 1 FROM source_item WHERE data_source_id = $1 AND fingerprint = $2',
            [dataSourceId, fingerprint]
          );
          if (itemExists.rows.length > 0) {
            stats.records_skipped++;
            continue;
          }
        } catch (e) {
          // ignore
        }
      }

      // Fuzzy matching for company name
      let matchedCompanyId = null;
      let matchedCompanyName = item.company_name || null;
      let confidenceScore = 0.85;

      if (item.company_name && existingCompanies.length > 0) {
        const matches = findMatchingCompanies(item.company_name, existingCompanies, 0.80);
        if (matches.length > 0) {
          matchedCompanyId = matches[0].company.company_id;
          matchedCompanyName = matches[0].company.legal_name;
          confidenceScore = matches[0].similarity;
        }
      }

      const projectName = item.project_name || item.title || 'Discovered RE Project';

      // Save into localStore
      localStore.createDiscoveredProject({
        job_run_id: jobRunId,
        data_source_id: dataSourceId || null,
        source_name: sourceName,
        source_type: sourceType,
        source_url: item.source_url || sourceUrl || null,
        raw_project_name: projectName,
        normalized_project_name: normalizeCompanyName(projectName),
        raw_company_name: item.company_name || null,
        normalized_company_name: item.company_name ? normalizeCompanyName(item.company_name) : null,
        matched_company_id: matchedCompanyId,
        matched_company_legal_name: matchedCompanyName,
        technology: item.technology || 'solar',
        capacity_mw: item.capacity_mw || null,
        state: item.state || null,
        district: item.district || null,
        confidence_score: confidenceScore,
        review_status: 'pending_review',
        raw_payload: item.raw_data || {}
      });

      // Also save into PostgreSQL if connected
      if (db.isConnected) {
        try {
          await db.query(
            `INSERT INTO discovered_project (
               job_run_id, data_source_id, raw_project_name, normalized_project_name,
               raw_company_name, normalized_company_name, matched_company_id,
               technology, capacity_mw, state, district, source_url,
               confidence_score, review_status, raw_payload
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending_review', $14)`,
            [
              jobRunId,
              dataSourceId || null,
              projectName,
              normalizeCompanyName(projectName),
              item.company_name || null,
              item.company_name ? normalizeCompanyName(item.company_name) : null,
              matchedCompanyId,
              item.technology || 'solar',
              item.capacity_mw || null,
              item.state || null,
              item.district || null,
              item.source_url || sourceUrl || null,
              confidenceScore,
              JSON.stringify(item.raw_data || {}),
            ]
          );

          if (dataSourceId && fingerprint) {
            await db.query(
              `INSERT INTO source_item (data_source_id, fingerprint, job_run_id)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [dataSourceId, fingerprint, jobRunId]
            );
          }
        } catch (e) {
          console.warn('DB project insert skipped:', e.message);
        }
      }

      stats.records_created++;
      stats.sent_for_review++;
    }

    // 5. Update Job Run to Succeeded in localStore & DB
    localStore.updateJobRun(localJob.job_run_id, {
      status: 'succeeded',
      ended_at: new Date().toISOString(),
      records_read: stats.records_read,
      records_created: stats.records_created,
      records_updated: stats.records_updated,
      records_skipped: stats.records_skipped,
      sent_for_review: stats.sent_for_review
    });

    if (db.isConnected && jobRunId) {
      try {
        await db.query(
          `UPDATE job_run
           SET status = 'succeeded',
               ended_at = CURRENT_TIMESTAMP,
               records_read = $1,
               records_created = $2,
               records_updated = $3,
               records_skipped = $4,
               sent_for_review = $5
           WHERE job_run_id = $6`,
          [stats.records_read, stats.records_created, stats.records_updated, stats.records_skipped, stats.sent_for_review, jobRunId]
        );
      } catch (e) {
        // ignore
      }
    }

    return {
      success: true,
      jobRunId,
      stats,
    };
  } catch (err) {
    stats.errors.push({ error: err.message });
    console.error('Collection job error:', err);

    localStore.updateJobRun(localJob.job_run_id, {
      status: 'failed',
      ended_at: new Date().toISOString(),
      errors: stats.errors
    });

    if (db.isConnected && jobRunId) {
      try {
        await db.query(
          `UPDATE job_run
           SET status = 'failed',
               ended_at = CURRENT_TIMESTAMP,
               errors = $1
           WHERE job_run_id = $2`,
          [JSON.stringify(stats.errors), jobRunId]
        );
      } catch (e) {
        // ignore
      }
    }

    return {
      success: false,
      jobRunId,
      error: err.message,
      stats,
    };
  }
};

module.exports = {
  runCollection,
};
