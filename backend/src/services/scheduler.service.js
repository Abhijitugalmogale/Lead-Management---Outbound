const cron = require('node-cron');
const db = require('../db');
const { runCollection } = require('./collectionRunner.service');

let scheduledTask = null;

/**
 * Initializes the automated collection scheduler
 */
const initScheduler = () => {
  // Run daily at 02:00 AM (or every 6 hours if configured)
  const cronExpression = process.env.COLLECTION_CRON || '0 2 * * *';

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`[SCHEDULER] Starting automated outbound collection run at ${new Date().toISOString()}`);

    if (!db.isConnected) {
      console.log('[SCHEDULER] Database not connected. Skipping scheduled collection.');
      return;
    }

    try {
      // Find all active permitted sources of type 'news_feed' or 'official_api'
      const sourcesRes = await db.query(
        `SELECT * FROM data_source
         WHERE is_active = TRUE AND is_permitted = TRUE AND source_type IN ('news_feed', 'official_api')`
      );

      for (const source of sourcesRes.rows) {
        console.log(`[SCHEDULER] Running collection for source: ${source.name}`);
        // If terms_note or URL is available
        const sourceUrl = source.terms_note && source.terms_note.startsWith('http') ? source.terms_note : null;
        if (sourceUrl) {
          await runCollection({
            dataSourceId: source.data_source_id,
            fileType: source.source_type === 'news_feed' ? 'rss' : 'html',
            sourceUrl,
          });
        }
      }
      console.log('[SCHEDULER] Completed automated outbound collection run.');
    } catch (err) {
      console.error('[SCHEDULER] Error during scheduled collection:', err.message);
    }
  });

  console.log(`[SCHEDULER] Outbound collection scheduler initialized (${cronExpression})`);
};

module.exports = {
  initScheduler,
};
