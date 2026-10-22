const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { runCollection } = require('../services/collectionRunner.service');

// Configure multer storage
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv and .pdf files are supported for project extraction'));
    }
  },
}).single('file');

/**
 * POST /api/v1/outbound/upload
 * Ingests an uploaded CSV or PDF document into Outbound collection
 */
const uploadAndProcessFile = async (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: 'File upload error', message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Validation error', message: 'No file uploaded' });
    }

    try {
      const { data_source_id } = req.body;
      const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

      const result = await runCollection({
        dataSourceId: data_source_id,
        fileType: ext,
        filePath: req.file.path,
      });

      return res.status(201).json({
        message: `File ${req.file.originalname} processed successfully`,
        summary: result,
      });
    } catch (processErr) {
      return next(processErr);
    }
  });
};

module.exports = {
  uploadAndProcessFile,
};
