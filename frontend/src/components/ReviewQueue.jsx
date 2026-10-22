import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, XCircle, Eye, Zap, MapPin, Building2, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { ReviewModal } from './ReviewModal';

// Sample demonstration projects if DB is empty / offline
const SAMPLE_DISCOVERED = [
  {
    discovered_project_id: 'sample-dp-1',
    raw_project_name: 'Bhadla Phase IV Solar Park 300 MW',
    raw_company_name: 'Azure Power India Private Limited',
    matched_company_legal_name: 'Azure Power India Pvt Ltd',
    matched_company_id: 'comp-1',
    technology: 'solar',
    capacity_mw: 300.0,
    state: 'Rajasthan',
    district: 'Jodhpur',
    expected_cod: '2027-03-31',
    confidence_score: 0.96,
    review_status: 'pending_review',
    source_name: 'SECI Renewable Auction & Allocation Portals',
    previewScore: {
      totalScore: 82,
      band: 'high',
      breakdown: { capacity_mw: 15, project_confirmed: 15, industry_relevance: 15, geography: 10, service_need: 12, contact_availability: 6, number_of_projects: 5, engagement_90d: 4 }
    }
  },
  {
    discovered_project_id: 'sample-dp-2',
    raw_project_name: 'Khavda Renewable Energy Zone Wind-Solar Hybrid 250 MW',
    raw_company_name: 'Adani Green Energy Twenty Four Ltd',
    matched_company_legal_name: 'Adani Green Energy Limited',
    matched_company_id: 'comp-2',
    technology: 'hybrid',
    capacity_mw: 250.0,
    state: 'Gujarat',
    district: 'Kutch',
    expected_cod: '2026-12-15',
    confidence_score: 0.91,
    review_status: 'pending_review',
    source_name: 'CEA Monthly Renewable Generation Reports',
    previewScore: {
      totalScore: 88,
      band: 'high',
      breakdown: { capacity_mw: 15, project_confirmed: 15, industry_relevance: 15, geography: 10, service_need: 15, contact_availability: 10, number_of_projects: 8, engagement_90d: 0 }
    }
  },
  {
    discovered_project_id: 'sample-dp-3',
    raw_project_name: 'Rewa Ultra Mega Solar Extension 120 MW',
    raw_company_name: 'Mahindra Susten Solar Private Limited',
    matched_company_legal_name: 'Mahindra Susten Pvt Ltd',
    matched_company_id: 'comp-3',
    technology: 'solar',
    capacity_mw: 120.0,
    state: 'Madhya Pradesh',
    district: 'Rewa',
    expected_cod: '2026-09-30',
    confidence_score: 0.94,
    review_status: 'pending_review',
    source_name: 'MNRE Official Tenders & Approvals',
    previewScore: {
      totalScore: 74,
      band: 'medium',
      breakdown: { capacity_mw: 15, project_confirmed: 10, industry_relevance: 15, geography: 10, service_need: 8, contact_availability: 6, number_of_projects: 5, engagement_90d: 5 }
    }
  },
  {
    discovered_project_id: 'sample-dp-4',
    raw_project_name: 'Tuticorin Offshore Wind Pilot Project 75 MW',
    raw_company_name: 'Suzlon Energy Limited',
    matched_company_legal_name: 'Suzlon Energy Ltd',
    matched_company_id: 'comp-4',
    technology: 'wind',
    capacity_mw: 75.0,
    state: 'Tamil Nadu',
    district: 'Thoothukudi',
    expected_cod: '2027-06-30',
    confidence_score: 0.88,
    review_status: 'pending_review',
    source_name: 'Renewable Energy Industry RSS News Feeds',
    previewScore: {
      totalScore: 68,
      band: 'medium',
      breakdown: { capacity_mw: 10, project_confirmed: 10, industry_relevance: 15, geography: 10, service_need: 8, contact_availability: 6, number_of_projects: 5, engagement_90d: 4 }
    }
  }
];

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

      if (data && data.data && data.data.length > 0) {
        setProjects(data.data);
      } else {
        // Fallback to sample projects so user sees active UI demo
        const filtered = SAMPLE_DISCOVERED.filter((p) => {
          if (statusFilter !== 'all' && p.review_status !== statusFilter) return false;
          if (techFilter && p.technology !== techFilter) return false;
          if (search) {
            const s = search.toLowerCase();
            return (
              p.raw_project_name.toLowerCase().includes(s) ||
              (p.raw_company_name && p.raw_company_name.toLowerCase().includes(s)) ||
              (p.state && p.state.toLowerCase().includes(s))
            );
          }
          return true;
        });
        setProjects(filtered);
      }
    } catch (err) {
      console.warn('Backend offline, using sample projects demonstration.');
      setProjects(SAMPLE_DISCOVERED);
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
          <h3>No Discovered Projects Pending</h3>
          <p>Run a collection job or upload a tender notice PDF/CSV to ingest candidate projects.</p>
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
