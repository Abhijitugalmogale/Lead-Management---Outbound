import React from 'react';
import { Radio, Database, UploadCloud, Layers, Activity, ShieldCheck, Sun } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab, pendingCount = 0 }) => {
  return (
    <header className="header-container">
      <div className="header-inner">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-icon">
            <Sun className="icon-sun" size={24} />
          </div>
          <div>
            <div className="brand-title">
              VEDANJAY <span className="brand-accent">POWER</span>
            </div>
            <div className="brand-subtitle">Outbound Lead Discovery & Intelligence</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <Layers size={17} />
            <span>Review Queue</span>
            {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={17} />
            <span>Document Ingestion</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
            onClick={() => setActiveTab('runs')}
          >
            <Activity size={17} />
            <span>Collection Monitor</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            <Database size={17} />
            <span>Source Registry</span>
          </button>
        </nav>

        {/* Status Indicator */}
        <div className="header-status">
          <div className="status-pill">
            <span className="status-dot pulse-live"></span>
            <span className="status-text">Outbound Engine Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};
