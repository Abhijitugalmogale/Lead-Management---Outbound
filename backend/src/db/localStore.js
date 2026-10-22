const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calculateLeadScore } = require('../services/scoring.service');

const STORE_PATH = path.resolve(__dirname, '../../data/outbound_store.json');

const INITIAL_SOURCES = [
  {
    data_source_id: 'src-1',
    name: 'SECI Renewable Auction & Allocation Portals',
    source_type: 'official_api',
    terms_note: 'Solar Energy Corporation of India utility-scale auction notices and PPA awards',
    is_permitted: true,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    data_source_id: 'src-2',
    name: 'CEA Monthly Renewable Generation & Status Reports',
    source_type: 'official_file',
    terms_note: 'Central Electricity Authority monthly monitoring PDFs and CSV downloads',
    is_permitted: true,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 36).toISOString()
  },
  {
    data_source_id: 'src-3',
    name: 'MNRE Official Renewable Portals & Tenders',
    source_type: 'official_api',
    terms_note: 'Ministry of New and Renewable Energy official tenders and policy allocations',
    is_permitted: true,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    data_source_id: 'src-4',
    name: 'Mercom India Renewable Energy Intelligence',
    source_type: 'news_feed',
    terms_note: 'Mercom India live RSS feed for solar, wind, storage, and utility tenders',
    is_permitted: true,
    is_active: true,
    source_url: 'https://mercomindia.com/feed',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    data_source_id: 'src-5',
    name: 'PV Magazine India Utility & Solar Feed',
    source_type: 'news_feed',
    terms_note: 'PV Magazine India daily utility-scale solar and storage project pipeline',
    is_permitted: true,
    is_active: true,
    source_url: 'https://www.pv-magazine-india.com/feed/',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    data_source_id: 'src-6',
    name: 'The Economic Times - Energy Renewable',
    source_type: 'news_feed',
    terms_note: 'ET Energy World live tracking of renewable infrastructure announcements',
    is_permitted: true,
    is_active: true,
    source_url: 'https://energy.economictimes.indiatimes.com/rss/renewable',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    data_source_id: 'src-7',
    name: 'Manual & Verified Tender Document Uploads',
    source_type: 'manual_research',
    terms_note: 'Internal research spreadsheets and verified state nodal agency filings (PDF/CSV)',
    is_permitted: true,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

const INITIAL_COMPANIES = [
  { company_id: 'comp-adani', legal_name: 'Adani Green Energy Limited', normalized_name: 'adani green energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-tata', legal_name: 'Tata Power Renewable Energy Limited', normalized_name: 'tata power renewable energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-ntpc', legal_name: 'NTPC Renewable Energy Limited', normalized_name: 'ntpc renewable energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-renew', legal_name: 'ReNew Power Private Limited', normalized_name: 'renew power', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-azure', legal_name: 'Azure Power India Private Limited', normalized_name: 'azure power india', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-avaada', legal_name: 'Avaada Energy Private Limited', normalized_name: 'avaada energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-acme', legal_name: 'ACME Solar Holdings Private Limited', normalized_name: 'acme solar holdings', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-hero', legal_name: 'Hero Future Energies Private Limited', normalized_name: 'hero future energies', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-suzlon', legal_name: 'Suzlon Energy Limited', normalized_name: 'suzlon energy', primary_role: 'o&m', status: 'active' },
  { company_id: 'comp-jsw', legal_name: 'JSW Neo Energy Limited', normalized_name: 'jsw neo energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-torrent', legal_name: 'Torrent Power Limited', normalized_name: 'torrent power', primary_role: 'operator', status: 'active' },
  { company_id: 'comp-sjvn', legal_name: 'SJVN Green Energy Limited', normalized_name: 'sjvn green energy', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-cleanmax', legal_name: 'CleanMax Solar', normalized_name: 'cleanmax solar', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-ampin', legal_name: 'AmpIn Energy Transition', normalized_name: 'ampin energy transition', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-serentica', legal_name: 'Serentica Renewables', normalized_name: 'serentica renewables', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-ayana', legal_name: 'Ayana Renewable Power', normalized_name: 'ayana renewable power', primary_role: 'developer', status: 'active' },
  { company_id: 'comp-waaree', legal_name: 'Waaree Energies Limited', normalized_name: 'waaree energies', primary_role: 'epc', status: 'active' },
  { company_id: 'comp-gensol', legal_name: 'Gensol Engineering Limited', normalized_name: 'gensol engineering', primary_role: 'epc', status: 'active' },
  { company_id: 'comp-navitas', legal_name: 'Navitas Solar', normalized_name: 'navitas solar', primary_role: 'epc', status: 'active' },
  { company_id: 'comp-wattpower', legal_name: 'WattPower Inverter Systems', normalized_name: 'wattpower inverter systems', primary_role: 'epc', status: 'active' }
];

class LocalStore {
  constructor() {
    this.data = {
      sources: INITIAL_SOURCES,
      companies: INITIAL_COMPANIES,
      discovered_projects: [],
      job_runs: [],
      leads: [],
      audit_logs: []
    };
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          sources: parsed.sources && parsed.sources.length > 0 ? parsed.sources : INITIAL_SOURCES,
          companies: parsed.companies && parsed.companies.length > 0 ? parsed.companies : INITIAL_COMPANIES,
          discovered_projects: parsed.discovered_projects || [],
          job_runs: parsed.job_runs || [],
          leads: parsed.leads || [],
          audit_logs: parsed.audit_logs || []
        };
      } else {
        this.save();
      }
    } catch (e) {
      console.warn('LocalStore init warning:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('LocalStore save error:', e.message);
    }
  }

  // --- Sources ---
  getSources() {
    return this.data.sources.map((s) => {
      const runs = this.data.job_runs.filter((r) => r.data_source_id === s.data_source_id);
      return {
        ...s,
        total_runs: runs.length,
        last_run_at: runs.length > 0 ? runs[0].started_at : null
      };
    });
  }

  getSourceById(id) {
    return this.data.sources.find((s) => s.data_source_id === id);
  }

  createSource({ name, source_type, terms_note, is_permitted = true, source_url }) {
    const id = `src-${Date.now()}`;
    const newSource = {
      data_source_id: id,
      name: name.trim(),
      source_type: source_type.toLowerCase(),
      terms_note: terms_note || null,
      source_url: source_url || null,
      is_permitted: Boolean(is_permitted),
      is_active: true,
      created_at: new Date().toISOString()
    };
    this.data.sources.push(newSource);
    this.save();
    return newSource;
  }

  // --- Companies ---
  getCompanies() {
    return this.data.companies;
  }

  // --- Discovered Projects ---
  getDiscoveredProjects({ review_status = 'pending_review', technology, state, search, min_capacity, limit = 50, offset = 0 } = {}) {
    let list = [...this.data.discovered_projects];

    if (review_status && review_status !== 'all' && review_status !== 'undefined') {
      list = list.filter((p) => (p.review_status || '').toLowerCase() === review_status.toLowerCase());
    }

    if (technology && technology !== 'undefined' && technology !== 'all') {
      list = list.filter((p) => (p.technology || '').toLowerCase() === technology.toLowerCase());
    }

    if (state && state !== 'undefined') {
      const s = state.toLowerCase().trim();
      list = list.filter((p) => p.state && p.state.toLowerCase().includes(s));
    }

    if (min_capacity && min_capacity !== 'undefined') {
      const min = parseFloat(min_capacity);
      if (!isNaN(min)) {
        list = list.filter((p) => p.capacity_mw && p.capacity_mw >= min);
      }
    }

    if (search && search !== 'undefined' && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => {
        return (
          (p.raw_project_name && p.raw_project_name.toLowerCase().includes(q)) ||
          (p.raw_company_name && p.raw_company_name.toLowerCase().includes(q)) ||
          (p.matched_company_legal_name && p.matched_company_legal_name.toLowerCase().includes(q)) ||
          (p.state && p.state.toLowerCase().includes(q))
        );
      });
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = list.length;
    const paginated = list.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

    return { data: paginated, total };
  }

  getDiscoveredProjectById(id) {
    return this.data.discovered_projects.find((p) => p.discovered_project_id === id);
  }

  createDiscoveredProject(projectData) {
    const id = projectData.discovered_project_id || `dp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate A5 Score
    const previewScore = calculateLeadScore({
      companyRole: projectData.matched_company_role || 'developer',
      projectSourceType: projectData.source_type || 'news_feed',
      largestCapacityMw: projectData.capacity_mw || 0,
      hasProject: Boolean(projectData.capacity_mw || projectData.raw_project_name),
      projectCount: 1,
      geographyScore: projectData.state ? 10 : 0
    });

    const newProject = {
      discovered_project_id: id,
      job_run_id: projectData.job_run_id || null,
      data_source_id: projectData.data_source_id || null,
      source_name: projectData.source_name || 'Automated Renewable Ingestion',
      source_url: projectData.source_url || null,
      raw_project_name: projectData.raw_project_name || 'Discovered RE Project',
      normalized_project_name: projectData.normalized_project_name || '',
      raw_company_name: projectData.raw_company_name || null,
      normalized_company_name: projectData.normalized_company_name || null,
      matched_company_id: projectData.matched_company_id || null,
      matched_company_legal_name: projectData.matched_company_legal_name || projectData.raw_company_name || null,
      technology: projectData.technology || 'solar',
      capacity_mw: projectData.capacity_mw || null,
      state: projectData.state || null,
      district: projectData.district || null,
      expected_cod: projectData.expected_cod || null,
      confidence_score: projectData.confidence_score || 0.85,
      review_status: projectData.review_status || 'pending_review',
      review_notes: projectData.review_notes || null,
      reviewed_by: projectData.reviewed_by || null,
      reviewed_at: projectData.reviewed_at || null,
      previewScore,
      raw_payload: projectData.raw_payload || {},
      created_at: projectData.created_at || new Date().toISOString()
    };

    // Prevent duplicate by fingerprint or identical title
    const exists = this.data.discovered_projects.some(
      (p) => p.raw_project_name.toLowerCase() === newProject.raw_project_name.toLowerCase()
    );

    if (!exists) {
      this.data.discovered_projects.unshift(newProject);
      this.save();
    }

    return newProject;
  }

  updateDiscoveredProject(id, updates = {}) {
    const proj = this.getDiscoveredProjectById(id);
    if (!proj) return null;

    Object.assign(proj, updates, { reviewed_at: new Date().toISOString() });

    this.data.audit_logs.unshift({
      log_id: `aud-${Date.now()}`,
      entity_type: 'discovered_project',
      entity_id: id,
      action: updates.review_status ? `status_${updates.review_status}` : 'update',
      details: updates,
      created_at: new Date().toISOString()
    });

    this.save();
    return proj;
  }

  convertToLead(projectId, userId = null) {
    const proj = this.getDiscoveredProjectById(projectId);
    if (!proj) throw new Error('Discovered project not found');

    const year = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    const leadCode = `LD-${year}-${rand}`;

    const newLead = {
      lead_id: `lead-${Date.now()}`,
      lead_code: leadCode,
      company_name: proj.matched_company_legal_name || proj.raw_company_name || 'Discovered Renewable Developer',
      project_name: proj.raw_project_name,
      technology: proj.technology,
      capacity_mw: proj.capacity_mw,
      state: proj.state,
      lead_status: 'discovered',
      lead_score: proj.previewScore?.totalScore || 75,
      score_band: proj.previewScore?.band || 'medium',
      created_by: userId,
      created_at: new Date().toISOString()
    };

    this.data.leads.unshift(newLead);
    proj.review_status = 'converted_to_lead';
    proj.converted_lead_id = newLead.lead_id;

    this.data.audit_logs.unshift({
      log_id: `aud-${Date.now()}`,
      entity_type: 'lead',
      entity_id: newLead.lead_id,
      action: 'converted_from_discovered_project',
      details: { discovered_project_id: projectId, lead_code: leadCode },
      created_at: new Date().toISOString()
    });

    this.save();
    return newLead;
  }

  // --- Collection Runs ---
  getCollectionRuns({ status, limit = 50, offset = 0 } = {}) {
    let list = [...this.data.job_runs];

    if (status) {
      list = list.filter((r) => (r.status || '').toLowerCase() === status.toLowerCase());
    }

    list.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

    const total = list.length;
    const paginated = list.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

    return { runs: paginated, total };
  }

  createJobRun(jobData) {
    const id = jobData.job_run_id || `run-${Date.now()}`;
    const newRun = {
      job_run_id: id,
      data_source_id: jobData.data_source_id || null,
      source_name: jobData.source_name || 'Renewable Data Ingestion',
      source_type: jobData.source_type || 'news_feed',
      status: jobData.status || 'running',
      started_at: jobData.started_at || new Date().toISOString(),
      ended_at: jobData.ended_at || null,
      records_read: jobData.records_read || 0,
      records_created: jobData.records_created || 0,
      records_updated: jobData.records_updated || 0,
      records_skipped: jobData.records_skipped || 0,
      records_rejected: jobData.records_rejected || 0,
      sent_for_review: jobData.sent_for_review || 0,
      errors: jobData.errors || []
    };

    this.data.job_runs.unshift(newRun);
    this.save();
    return newRun;
  }

  updateJobRun(id, updates = {}) {
    const run = this.data.job_runs.find((r) => r.job_run_id === id);
    if (!run) return null;

    Object.assign(run, updates);
    this.save();
    return run;
  }
}

const localStore = new LocalStore();
module.exports = localStore;
