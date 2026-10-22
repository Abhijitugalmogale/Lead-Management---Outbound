import React, { useState, useEffect } from 'react';
import { Database, Plus, ShieldCheck, CheckCircle2, Globe, FileText, Rss, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_SOURCES = [
  {
    data_source_id: 'src-1',
    name: 'MNRE Official Renewable Portals & Tenders',
    source_type: 'official_api',
    terms_note: 'Ministry of New and Renewable Energy official tenders and auction results',
    is_permitted: true,
    is_active: true,
  },
  {
    data_source_id: 'src-2',
    name: 'CEA Monthly Renewable Generation & Status Reports',
    source_type: 'official_file',
    terms_note: 'Central Electricity Authority monthly monitoring PDFs and CSV downloads',
    is_permitted: true,
    is_active: true,
  },
  {
    data_source_id: 'src-3',
    name: 'SECI Renewable Auction & Allocation Portals',
    source_type: 'official_api',
    terms_note: 'Solar Energy Corporation of India utility-scale auction notices and PPA awards',
    is_permitted: true,
    is_active: true,
  },
  {
    data_source_id: 'src-4',
    name: 'Renewable Energy Industry RSS News Feeds',
    source_type: 'news_feed',
    terms_note: 'Public industry feeds (Mercom, PV Tech, Saur Energy) for greenfield announcements',
    is_permitted: true,
    is_active: true,
  },
  {
    data_source_id: 'src-5',
    name: 'Manual & Verified Industry Document Uploads',
    source_type: 'manual_research',
    terms_note: 'Internal research spreadsheets and verified state nodal agency filings',
    is_permitted: true,
    is_active: true,
  },
];

export const SourceRegistry = () => {
  const [sources, setSources] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('official_api');
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const data = await api.getSources();
        if (data && data.sources && data.sources.length > 0) {
          setSources(data.sources);
        } else {
          setSources(DEFAULT_SOURCES);
        }
      } catch (err) {
        setSources(DEFAULT_SOURCES);
      }
    };
    fetchSources();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      await api.createSource({
        name,
        source_type: type,
        terms_note: terms,
        is_permitted: true,
      });
      setShowModal(false);
      setName('');
      setTerms('');
    } catch (err) {
      alert(`Error creating source: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (srcType) => {
    switch (srcType) {
      case 'official_api':
        return <Globe size={20} className="text-cyan" />;
      case 'official_file':
        return <FileText size={20} className="text-amber" />;
      case 'news_feed':
        return <Rss size={20} className="text-emerald" />;
      default:
        return <Database size={20} className="text-purple" />;
    }
  };

  return (
    <div className="sources-container animate-fade-in">
      <div className="queue-header-bar">
        <div>
          <h1 className="page-title">Permitted Data Sources Registry</h1>
          <p className="page-desc">
            Configured government agencies, regulatory file downloads, and news feeds permitted for outbound project discovery.
          </p>
        </div>

        <button className="btn btn-primary btn-glow" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>Register New Source</span>
        </button>
      </div>

      <div className="sources-grid">
        {sources.map((src) => (
          <div key={src.data_source_id} className="source-card glass-panel">
            <div className="source-card-top">
              <div className="source-icon-box">{getSourceIcon(src.source_type)}</div>
              <div className="source-status-badge">
                <span className="source-status-dot"></span>
                <span>Active</span>
              </div>
            </div>

            <h3 className="source-name">{src.name}</h3>
            <p className="source-terms">{src.terms_note || 'Official regulatory source'}</p>

            <div className="source-footer">
              <span className="badge badge-source">{src.source_type}</span>
              <div className="permitted-tag">
                <ShieldCheck size={14} className="text-emerald" />
                <span>Legally Permitted</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title" style={{ marginBottom: '16px' }}>Register Outbound Source</h2>
            <form onSubmit={handleCreate}>
              <label className="input-label">Source Display Name:</label>
              <input
                type="text"
                className="custom-input"
                placeholder="e.g., MEDA Maharashtra Wind Register"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <label className="input-label" style={{ marginTop: '12px' }}>Source Type:</label>
              <select className="custom-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="official_api">Official API / Portal</option>
                <option value="official_file">Official File (PDF / CSV Download)</option>
                <option value="news_feed">RSS / Atom News Feed</option>
                <option value="manual_research">Manual Research & Upload</option>
              </select>

              <label className="input-label" style={{ marginTop: '12px' }}>Terms of Use / URL Note:</label>
              <textarea
                className="custom-textarea"
                rows="2"
                placeholder="Public access under national open data portal policy"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Registering...' : 'Register Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
