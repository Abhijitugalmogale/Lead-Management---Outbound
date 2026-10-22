/**
 * Lead Scoring Engine
 * Implements Algorithm A5 (Rule-Based Lead Scoring, Version v1)
 * Reference: Vedanjay_Power_Technical_Design_Algorithms.pdf Section 4.5
 */

/**
 * Calculates lead score based on 8 key business factors
 * @param {Object} data Input parameters containing company, projects, contacts, needs, engagement
 * @returns {Object} { totalScore, band, breakdown }
 */
const calculateLeadScore = (data = {}) => {
  const breakdown = {};

  // Factor 1: Industry Relevance (Max 15)
  // Owner, developer, operator or SPV: 15; Related (EPC, O&M, trader, consultant): 8; Other: 0
  const primaryRole = (data.companyRole || '').toLowerCase();
  if (['owner', 'developer', 'operator', 'spv'].includes(primaryRole)) {
    breakdown.industry_relevance = 15;
  } else if (['epc', 'om', 'o&m', 'trader', 'consultant'].includes(primaryRole)) {
    breakdown.industry_relevance = 8;
  } else {
    breakdown.industry_relevance = 0;
  }

  // Factor 2: Renewable Project Confirmed (Max 15)
  // Official/licensed source or confirmed by company: 15; News or secondary: 10; None: 0
  const projectSource = (data.projectSourceType || '').toLowerCase();
  if (['official_api', 'official_file', 'licensed', 'confirmed'].includes(projectSource)) {
    breakdown.project_confirmed = 15;
  } else if (['news_feed', 'secondary', 'manual_research'].includes(projectSource)) {
    breakdown.project_confirmed = 10;
  } else if (data.hasProject) {
    breakdown.project_confirmed = 10;
  } else {
    breakdown.project_confirmed = 0;
  }

  // Factor 3: Project Capacity MW (Max 15)
  // >= 100 MW: 15; 25-99.99 MW: 10; 5-24.99 MW: 5; < 5 MW: 0
  const capacity = parseFloat(data.largestCapacityMw || 0);
  if (capacity >= 100) {
    breakdown.capacity_mw = 15;
  } else if (capacity >= 25) {
    breakdown.capacity_mw = 10;
  } else if (capacity >= 5) {
    breakdown.capacity_mw = 5;
  } else {
    breakdown.capacity_mw = 0;
  }

  // Factor 4: Number of Projects (Max 10)
  // >= 5 projects: 10; 2-4: 8; 1: 5; 0: 0
  const projectCount = parseInt(data.projectCount || 0, 10);
  if (projectCount >= 5) {
    breakdown.number_of_projects = 10;
  } else if (projectCount >= 2) {
    breakdown.number_of_projects = 8;
  } else if (projectCount === 1) {
    breakdown.number_of_projects = 5;
  } else {
    breakdown.number_of_projects = 0;
  }

  // Factor 5: Possible Service Need (Max 15)
  // Need confirmed by company: 15; >= 2 possible needs: 12; 1 possible need: 8; None: 0
  const hasConfirmedNeed = Boolean(data.hasConfirmedNeed);
  const possibleNeedsCount = parseInt(data.possibleNeedsCount || 0, 10);
  if (hasConfirmedNeed) {
    breakdown.service_need = 15;
  } else if (possibleNeedsCount >= 2) {
    breakdown.service_need = 12;
  } else if (possibleNeedsCount === 1) {
    breakdown.service_need = 8;
  } else {
    breakdown.service_need = 0;
  }

  // Factor 6: Contact Availability (Max 10)
  // Verified decision-maker: 10; Any other identified contact: 6; None: 0
  if (data.hasVerifiedDecisionMaker) {
    breakdown.contact_availability = 10;
  } else if (data.hasIdentifiedContact) {
    breakdown.contact_availability = 6;
  } else {
    breakdown.contact_availability = 0;
  }

  // Factor 7: Geography (Max 10)
  // Target country India: 10; Under evaluation: 4; Other: 0
  const country = (data.country || 'India').trim().toLowerCase();
  if (country === 'india') {
    breakdown.geography = 10;
  } else if (['uae', 'oman', 'saudi arabia', 'philippines', 'vietnam'].includes(country)) {
    breakdown.geography = 4;
  } else {
    breakdown.geography = 0;
  }

  // Factor 8: Engagement in last 90 days (Max 10)
  // Meeting request: 10; Enquiry: 8; Reply: 6; None: 0
  const engagement = (data.latestEngagementType || '').toLowerCase();
  if (engagement === 'meeting' || engagement === 'meeting_request') {
    breakdown.engagement_90d = 10;
  } else if (engagement === 'enquiry' || engagement === 'inbound_form') {
    breakdown.engagement_90d = 8;
  } else if (engagement === 'reply' || engagement === 'call_answered') {
    breakdown.engagement_90d = 6;
  } else {
    breakdown.engagement_90d = 0;
  }

  // Calculate sum of all 8 factor scores
  const totalScore = Object.values(breakdown).reduce((acc, score) => acc + score, 0);

  // Determine scoring band
  let band = 'nurture';
  if (totalScore >= 80) {
    band = 'high';
  } else if (totalScore >= 60) {
    band = 'medium';
  }

  return {
    totalScore,
    band,
    breakdown,
    ruleVersion: 'v1',
  };
};

module.exports = {
  calculateLeadScore,
};
