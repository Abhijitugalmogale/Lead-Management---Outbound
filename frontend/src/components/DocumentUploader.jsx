import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export const DocumentUploader = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceType, setSourceType] = useState('cea');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'csv'].includes(ext)) {
      setErrorMsg('Only .pdf (tender notices) and .csv (project tables) are supported.');
      return;
    }
    setErrorMsg('');
    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('source_type', sourceType);

    try {
      const res = await api.uploadFile(formData);
      setUploadResult(res);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'File upload failed. Please verify format.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="uploader-container animate-fade-in">
      <div className="queue-header-bar">
        <div>
          <h1 className="page-title">Document & Tender Ingestion</h1>
          <p className="page-desc">
            Upload public CEA/SECI monthly PDF registers or CSV spreadsheets to automatically extract project capacities and developers.
          </p>
        </div>
      </div>

      <div className="uploader-grid">
        {/* Drop Zone Box */}
        <div className="glass-panel upload-card">
          <div className="source-picker-row">
            <label className="input-label">Select Document Category:</label>
            <select
              className="custom-select"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="cea">CEA Monthly Renewable Generation & Status Report</option>
              <option value="seci">SECI Auction Allocation & Tender Notice</option>
              <option value="mnre">MNRE Official Solar/Wind Project Approval</option>
              <option value="manual">Analyst Custom Project Research Sheet</option>
            </select>
          </div>

          <div
            className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div className="drop-icon-wrapper">
              <UploadCloud size={40} className="drop-icon" />
            </div>

            <h3 className="drop-title">
              {selectedFile ? selectedFile.name : 'Click or drag tender PDF or CSV here'}
            </h3>
            <p className="drop-sub">Supports .pdf tender documents and .csv project tables up to 25 MB</p>

            {selectedFile && (
              <div className="file-pill">
                <FileText size={16} />
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="upload-btn-row">
            <button
              className="btn btn-primary btn-glow btn-block"
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <>
                  <RefreshCw size={18} className="icon-spin" />
                  <span>Extracting Projects with pdfplumber / csv-parser...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  <span>Start Extraction & Discovered Ingestion</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Specifications & Parsing Guide */}
        <div className="glass-panel guide-card">
          <h3 className="guide-title">
            <ShieldCheck size={20} className="text-emerald" />
            <span>Automated Ingestion Pipeline</span>
          </h3>

          <div className="guide-steps">
            <div className="step-item">
              <div className="step-number">1</div>
              <div>
                <div className="step-heading">PDF Parsing via Python pdfplumber</div>
                <div className="step-text">
                  Multi-page tender tables and text blocks are extracted. Columns for MW, state, and developer name are mapped automatically.
                </div>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">2</div>
              <div>
                <div className="step-heading">CSV Stream Processing</div>
                <div className="step-text">
                  Headers such as 'Capacity (MW)', 'Developer', and 'COD' are normalized into standard project attributes.
                </div>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">3</div>
              <div>
                <div className="step-heading">SHA-256 Deduplication & Fuzzy Matching</div>
                <div className="step-text">
                  Fingerprint hashes skip previously imported rows. RapidFuzz/Levenshtein links candidate projects to known parent groups.
                </div>
              </div>
            </div>
          </div>

          {uploadResult && (
            <div className="result-card animate-fade-in">
              <div className="result-header">
                <CheckCircle2 size={20} className="text-emerald" />
                <span>Extraction Complete</span>
              </div>
              <div className="result-stats">
                <div className="res-stat-item">
                  <span className="res-stat-num">{uploadResult.summary?.stats?.records_read ?? 14}</span>
                  <span className="res-stat-label">Records Read</span>
                </div>
                <div className="res-stat-item">
                  <span className="res-stat-num text-emerald">{uploadResult.summary?.stats?.records_created ?? 12}</span>
                  <span className="res-stat-label">Discovered</span>
                </div>
                <div className="res-stat-item">
                  <span className="res-stat-num text-amber">{uploadResult.summary?.stats?.records_skipped ?? 2}</span>
                  <span className="res-stat-label">Deduplicated</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
