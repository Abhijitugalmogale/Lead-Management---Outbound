const db = require('../db');
const localStore = require('../db/localStore');
const { runCollection } = require('../services/collectionRunner.service');

/**
 * POST /api/v1/collection-runs
 * Trigger a new collection run
 */
const triggerCollectionRun = async (req, res, next) => {
  try {
    const { data_source_id, source_url, file_type = 'rss' } = req.body;

    // Run the collection workflow asynchronously or await based on execution
    const result = await runCollection({
      dataSourceId: data_source_id,
      fileType: file_type,
      sourceUrl: source_url,
    });

    return res.status(201).json({
      message: 'Collection run completed',
      run: result,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/collection-runs
 * List collection runs and report errors
 */
const listCollectionRuns = async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      const result = localStore.getCollectionRuns({ status, limit, offset });
      return res.status(200).json({ runs: result.runs, total: result.total });
    }

    let query = `
      SELECT j.*, s.name as source_name, s.source_type
      FROM job_run j
      LEFT JOIN data_source s ON j.data_source_id = s.data_source_id
      WHERE j.job_type = 'source_collection'
    `;
    const params = [];
    let idx = 1;

    if (status) {
      query += ` AND j.status = $${idx}`;
      params.push(status.toLowerCase());
      idx++;
    }

    query += ` ORDER BY j.started_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countRes = await db.query("SELECT COUNT(*) FROM job_run WHERE job_type = 'source_collection'");

    return res.status(200).json({
      runs: result.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/collection-runs/:id
 */
const getCollectionRunById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!db.isConnected) {
      return res.status(200).json({ run: { job_run_id: id, status: 'mock' } });
    }

    const result = await db.query(
      `SELECT j.*, s.name as source_name, s.source_type
       FROM job_run j
       LEFT JOIN data_source s ON j.data_source_id = s.data_source_id
       WHERE j.job_run_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Collection run not found' });
    }

    const run = result.rows[0];

    // Fetch discovered items in this run
    const itemsRes = await db.query(
      `SELECT * FROM discovered_project WHERE job_run_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    run.discovered_projects = itemsRes.rows;

    return res.status(200).json({ run });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  triggerCollectionRun,
  listCollectionRuns,
  getCollectionRunById,
};
