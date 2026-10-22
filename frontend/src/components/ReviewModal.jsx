import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Zap, Building, MapPin, Calendar, ExternalLink, ShieldCheck } from 'lucide-react';

export const ReviewModal = ({ project, onClose, onReview }) => {
  const [role, setRole] = useState('developer');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!project) return null;

  const handleAction = async (status) => {
    setIsSubmitting(true);
    try {
      await onReview(project.discovered_project_id, {
        review_status: status,
        review_notes: notes,
        role,
        company_id: project.matched_company_id || undefined,
      });
      onClose();
    } catch (err) {
      alert(`Error updating project: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const score = project.previewScore || { totalScore: 65, band: 'medium', breakdown: {} };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Outbound Discovery Inspection</div>
            <h2 className="modal-title">{project.raw_project_name}</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-grid">
          {/* Left Column: Project Details */}
          <div className="modal-section">
            <h3 className="section-title">Discovered Project Attributes</h3>

            <div className="attr-grid">
              <div className="attr-card">
                <span className="attr-label">Technology</span>
                <span className={`badge badge-${project.technology || 'solar'}`}>
                  {project.technology || 'Solar'}
                </span>
              </div>

              <div className="attr-card">
                <span className="attr-label">Capacity (MW)</span>
                <span className="attr-val-highlight">
                  {project.capacity_mw ? `${project.capacity_mw} MW` : 'Unknown'}
                </span>
              </div>

              <div className="attr-card">
                <span className="attr-label">Location / State</span>
                <div className="attr-val">
                  <MapPin size={15} className="attr-icon" />
                  <span>{project.state || 'India'}</span>
                  {project.district && <span className="attr-muted">({project.district})</span>}
                </div>
              </div>

              <div className="attr-card">
                <span className="attr-label">Target COD</span>
                <div className="attr-val">
                  <Calendar size={15} className="attr-icon" />
                  <span>{project.expected_cod ? new Date(project.expected_cod).toLocaleDateString() : 'Not Specified'}</span>
                </div>
              </div>
            </div>

            <div className="company-match-card">
              <div className="match-header">
                <Building size={18} className="match-icon" />
                <span className="match-title">Company Identification & Matching</span>
                <span className="confidence-pill">
                  {Math.round((project.confidence_score || 0.85) * 100)}% Match
                </span>
              </div>

              <div className="match-body">
                <div>
                  <div className="match-label">Extracted Entity:</div>
                  <div className="match-val-raw">{project.raw_company_name || 'No company parsed in notice'}</div>
                </div>

                {project.matched_company_legal_name && (
                  <div>
                    <div className="match-label">Matched Registered Company:</div>
                    <div className="match-val-matched">
                      <ShieldCheck size={16} className="text-emerald" />
                      <span>{project.matched_company_legal_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {project.source_url && (
              <div className="source-link-row">
                <ExternalLink size={14} />
                <a href={project.source_url} target="_blank" rel="noreferrer">
                  View Original Source Notice
                </a>
              </div>
            )}
          </div>

          {/* Right Column: Scoring & Review Controls */}
          <div className="modal-section modal-section-scoring">
            <h3 className="section-title">100-Point Lead Score Preview</h3>

            <div className="score-hero-box">
              <div className="score-hero-num">{score.totalScore}</div>
              <div className="score-hero-details">
                <div className="score-hero-max">/ 100 Points</div>
                <div className={`badge badge-${score.band} score-hero-band`}>
                  {score.band.toUpperCase()} PRIORITY
                </div>
              </div>
            </div>

            <div className="score-breakdown-list">
              <div className="score-item">
                <span>Project Capacity MW</span>
                <span className="score-mark">+{score.breakdown?.capacity_mw ?? 15} pts</span>
              </div>
              <div className="score-item">
                <span>Renewable Project Confirmed</span>
                <span className="score-mark">+{score.breakdown?.project_confirmed ?? 15} pts</span>
              </div>
              <div className="score-item">
                <span>Industry Relevance (Role)</span>
                <span className="score-mark">+{score.breakdown?.industry_relevance ?? 15} pts</span>
              </div>
              <div className="score-item">
                <span>Geography (Target Market)</span>
                <span className="score-mark">+{score.breakdown?.geography ?? 10} pts</span>
              </div>
              <div className="score-item">
                <span>Service Need (F&S / QCA)</span>
                <span className="score-mark">+{score.breakdown?.service_need ?? 8} pts</span>
              </div>
            </div>

            <div className="review-inputs">
              <label className="input-label">Assign Company Role:</label>
              <select className="custom-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="developer">Developer</option>
                <option value="owner">Owner / Asset Holder</option>
                <option value="operator">Operator</option>
                <option value="spv">Special Purpose Vehicle (SPV)</option>
                <option value="epc">EPC Contractor</option>
              </select>

              <label className="input-label" style={{ marginTop: '12px' }}>Analyst Verification Notes:</label>
              <textarea
                className="custom-textarea"
                rows="2"
                placeholder="e.g., Verified against CEA monthly register and state portal."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-danger"
                disabled={isSubmitting}
                onClick={() => handleAction('rejected')}
              >
                Reject Notice
              </button>
              <button
                className="btn btn-primary btn-glow"
                disabled={isSubmitting}
                onClick={() => handleAction('approved')}
              >
                <CheckCircle size={17} />
                <span>Approve & Convert to Lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
