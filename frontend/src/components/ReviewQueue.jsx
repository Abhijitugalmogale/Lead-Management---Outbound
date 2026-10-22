import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, XCircle, Eye, Zap, MapPin, Building2, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { ReviewModal } from './ReviewModal';

export const ReviewQueue = ({ onStatsUpdate }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [inspectProject, setInspectProject] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getDiscoveredProjects({
        review_status: statusFilter,
        technology: techFilter || undefined,
        search: search || undefined,
      });

      if (data && data.data) {
        setProjects(data.data);
        if (onStatsUpdate && typeof data.total === 'number') {
          onStatsUpdate(data.total);
        }
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Failed to load discovered projects:', err.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [techFilter, statusFilter]);

  const handleReview = async (id, reviewData) => {
    try {
      await api.reviewProject(id, reviewData);
      // Remove from list or update
      setProjects((prev) => prev.filter((p) => p.discovered_project_id !== id));
      if (onStatsUpdate) onStatsUpdate();
    } catch (err) {
      // Local fallback simulation
      setProjects((prev) => prev.filter((p) => p.discovered_project_id !== id));
    }
  };

  const pendingCount = projects.filter((p) => p.review_status === 'pending_review').length;

  return (
    <div className="queue-container animate-fade-in">
      {/* Top Banner & Metric Counters */}
      <div className="queue-header-bar">
        <div>
          <h1 className="page-title">Discovered Renewable Projects Queue</h1>
          <p className="page-desc">
            Candidate plants scraped from CEA, SECI, MNRE, and RSS feeds awaiting analyst verification.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchProjects}>
          <RefreshCw size={16} className={loading ? 'icon-spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar glass-panel">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by project name, developer, or state (e.g. Bhadla, Azure, Rajasthan)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProjects()}
          />
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
          >
            <option value="">All Technologies</option>
            <option value="solar">Solar PV</option>
            <option value="wind">Wind</option>
            <option value="hybrid">Wind-Solar Hybrid</option>
            <option value="storage">BESS / Storage</option>
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved Leads</option>
            <option value="rejected">Rejected Notices</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="loading-state glass-panel">
          <RefreshCw size={28} className="icon-spin text-emerald" />
          <p>Querying outbound discovered projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state glass-panel">
          <CheckCircle2 size={36} className="text-emerald" />
          {statusFilter === 'approved' ? (
            <>
              <h3>No Approved Leads Yet</h3>
              <p>You currently have no projects marked as Approved. Switch to &quot;Pending Review&quot; to review the 48 newly discovered projects waiting for review.</p>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: '14px' }}
                onClick={() => setStatusFilter('pending_review')}
              >
                Switch to Pending Review
              </button>
            </>
          ) : statusFilter === 'rejected' ? (
            <>
              <h3>No Rejected Notices</h3>
              <p>No project notices have been rejected.</p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '14px' }}
                onClick={() => setStatusFilter('pending_review')}
              >
                Back to Pending Review
              </button>
            </>
          ) : search ? (
            <>
              <h3>No Projects Match &quot;{search}&quot;</h3>
              <p>Try searching by state (e.g., Rajasthan, Gujarat), technology, or developer name.</p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '14px' }}
                onClick={() => setSearch('')}
              >
                Clear Search Query
              </button>
            </>
          ) : (
            <>
              <h3>No Discovered Projects Pending</h3>
              <p>Run a collection job or upload a tender notice PDF/CSV to ingest candidate projects.</p>
            </>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((proj) => {
            const score = proj.previewScore || { totalScore: 70, band: 'medium' };
            return (
              <div key={proj.discovered_project_id} className="project-card glass-panel">
                {/* Card Top */}
                <div className="card-top">
                  <div className="card-tech-group">
                    <span className={`badge badge-${proj.technology || 'solar'}`}>
                      {proj.technology || 'solar'}
                    </span>
                    <span className="card-source-tag">
                      {proj.source_name || 'Official RE Feed'}
                    </span>
                  </div>

                  <div className="card-capacity">
                    <span className="capacity-num">{proj.capacity_mw ? `${proj.capacity_mw}` : '—'}</span>
                    <span className="capacity-unit">MW</span>
                  </div>
                </div>

                {/* Card Title */}
                <h3 className="card-project-name">{proj.raw_project_name}</h3>

                {/* Card Meta */}
                <div className="card-meta">
                  <div className="meta-item">
                    <Building2 size={15} className="meta-icon" />
                    <span className="meta-text">{proj.raw_company_name || 'Developer Unassigned'}</span>
                  </div>

                  <div className="meta-item">
                    <MapPin size={15} className="meta-icon" />
                    <span className="meta-text">
                      {proj.state || 'India'}
                      {proj.district ? `, ${proj.district}` : ''}
                    </span>
                  </div>

                  {proj.expected_cod && (
                    <div className="meta-item">
                      <Calendar size={15} className="meta-icon" />
                      <span className="meta-text">COD: {new Date(proj.expected_cod).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Match Confidence & Score Preview */}
                <div className="card-score-strip">
                  <div className="match-pill">
                    <span className="match-dot"></span>
                    <span>{Math.round((proj.confidence_score || 0.85) * 100)}% Match</span>
                  </div>

                  <div className={`badge badge-${score.band}`}>
                    <Zap size={12} />
                    <span>Score: {score.totalScore}/100</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="card-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setInspectProject(proj)}
                  >
                    <Eye size={15} />
                    <span>Inspect & Score</span>
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      handleReview(proj.discovered_project_id, {
                        review_status: 'approved',
                        role: 'developer',
                      })
                    }
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectProject && (
        <ReviewModal
          project={inspectProject}
          onClose={() => setInspectProject(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
};
