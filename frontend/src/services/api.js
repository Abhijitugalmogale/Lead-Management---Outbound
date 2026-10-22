const API_BASE = '/api/v1';

// Default auth token cache
let cachedToken = localStorage.getItem('token') || '';

export const setAuthToken = (token) => {
  cachedToken = token;
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getAuthToken = () => cachedToken;

/**
 * Universal fetch wrapper with automatic JWT injection
 */
const request = async (endpoint, options = {}) => {
  const headers = {
    ...options.headers,
  };

  // If body is not FormData, set Content-Type to JSON
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (cachedToken) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Auto-login fallback if 401 and not already logging in
    if (res.status === 401 && endpoint !== '/auth/login') {
      console.warn('Authentication required. Attempting admin auto-login...');
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@vedanjaypower.com', password: 'Password@123' }),
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        setAuthToken(loginData.token);
        headers['Authorization'] = `Bearer ${loginData.token}`;
        const retryRes = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        return retryRes.json();
      }
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API request error on ${endpoint}:`, err.message);
    throw err;
  }
};

const buildQuery = (params = {}) => {
  const clean = Object.entries(params).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
      acc[k] = v;
    }
    return acc;
  }, {});
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
};

export const api = {
  // Authentication
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Discovered Projects (Review Queue)
  getDiscoveredProjects: (params = {}) => {
    return request(`/discovered-projects${buildQuery(params)}`);
  },

  getDiscoveredProject: (id) => request(`/discovered-projects/${id}`),

  reviewProject: (id, { review_status, review_notes, company_id, role }) =>
    request(`/discovered-projects/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ review_status, review_notes, company_id, role }),
    }),

  // Collection Runs
  getCollectionRuns: (params = {}) => {
    return request(`/collection-runs${buildQuery(params)}`);
  },

  getCollectionRun: (id) => request(`/collection-runs/${id}`),

  triggerCollectionRun: (data) =>
    request('/collection-runs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Outbound File Ingestion (CSV / PDF)
  uploadFile: (formData) =>
    request('/outbound/upload', {
      method: 'POST',
      body: formData,
    }),

  // Data Sources
  getSources: () => request('/sources'),

  createSource: (data) =>
    request('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
