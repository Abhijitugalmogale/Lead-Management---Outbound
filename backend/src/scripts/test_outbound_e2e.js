/**
 * ==============================================================================
 * Vedanjay Power — Outbound Module Automated End-to-End Test Suite
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { calculateSimilarity, findMatchingCompanies } = require('../services/fuzzyMatching.service');
const { calculateLeadScore } = require('../services/scoring.service');
const { parseProjectCsv } = require('../services/ingestion/csvAdapter');
const { extractPdfData } = require('../services/ingestion/pdfExtractor');

const BACKEND_URL = 'http://localhost:5000/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${details ? `(${details})` : ''}`);
    results.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    results.push({ name: testName, status: 'FAIL', details });
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log(' VEDANJAY POWER — OUTBOUND MODULE E2E TEST RUNNER');
  console.log('===============================================================\n');

  let token = '';

  // -------------------------------------------------------------
  // TEST 1: Backend Health Check
  // -------------------------------------------------------------
  console.log('▶ [Test 1] Testing Backend Health & Diagnostic Endpoint...');
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    const data = await res.json();
    assert(res.status === 200, 'Health Endpoint Status 200');
    assert(data.status === 'ok', 'Health Response status == "ok"');
    assert(data.uptimeSeconds >= 0, 'Health Uptime reported', `${data.uptimeSeconds}s`);
  } catch (err) {
    assert(false, 'Health Endpoint Connection', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Authentication & Token Issuance
  // -------------------------------------------------------------
  console.log('\n▶ [Test 2] Testing Admin Authentication & JWT Generation...');
  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vedanjaypower.com', password: 'Password@123' }),
    });
    const data = await res.json();
    assert(res.status === 200, 'Login Status 200');
    assert(Boolean(data.token), 'JWT Token Issued');
    assert(data.user && data.user.role === 'admin', 'Admin Role Confirmed in Token');
    token = data.token;
  } catch (err) {
    assert(false, 'Admin Authentication', err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Outbound Data Sources Registry
  // -------------------------------------------------------------
  console.log('\n▶ [Test 3] Testing Outbound Sources Registry API...');
  try {
    const res = await fetch(`${BACKEND_URL}/sources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert(res.status === 200, 'Sources Endpoint Status 200');
    assert(Array.isArray(data.sources), 'Sources returns array');
  } catch (err) {
    assert(false, 'Outbound Sources Registry', err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: CSV Project Parser & Header Normalization
  // -------------------------------------------------------------
  console.log('\n▶ [Test 4] Testing CSV Ingestion & Entity Normalization...');
  const sampleCsvPath = path.resolve(__dirname, '../../scratch_sample_tenders.csv');
  try {
    // Generate a realistic renewable tender sample CSV
    const csvContent = 
`Project Name,Capacity (MW),Developer,State,District,Technology,Status,COD
Bhadla Phase V Solar Park,350,Azure Power India Pvt Ltd,Rajasthan,Jodhpur,Solar,Planned,2027-03-31
Khavda Hybrid Phase II,300,Adani Green Energy Ltd,Gujarat,Kutch,Hybrid,Planned,2026-11-30
Pavagada Solar Extension,150,Tata Power Renewable Energy,Karnataka,Tumkur,Solar,Planned,2026-08-15
`;
    fs.writeFileSync(sampleCsvPath, csvContent, 'utf-8');

    const parsedProjects = await parseProjectCsv(sampleCsvPath);
    assert(parsedProjects.length === 3, 'Parsed 3 Projects from CSV');
    assert(parsedProjects[0].capacity_mw === 350, 'Parsed 350 MW Capacity accurately');
    assert(parsedProjects[0].technology === 'solar', 'Mapped Solar Technology');
    assert(parsedProjects[1].technology === 'hybrid', 'Mapped Hybrid Technology');
    assert(parsedProjects[0].fingerprint.length === 64, 'Generated SHA-256 Fingerprint for deduplication');
  } catch (err) {
    assert(false, 'CSV Project Parser', err.message);
  } finally {
    if (fs.existsSync(sampleCsvPath)) fs.unlinkSync(sampleCsvPath);
  }

  // -------------------------------------------------------------
  // TEST 5: Python pdfplumber Multi-page Tender Table Extraction
  // -------------------------------------------------------------
  console.log('\n▶ [Test 5] Testing Python pdfplumber PDF Table Extractor...');
  const samplePdfPath = path.resolve(__dirname, '../../../documents/tech stack and version.pdf');
  try {
    const pdfData = await extractPdfData(samplePdfPath);
    assert(pdfData.success === true, 'pdfplumber Python Script Executed Successfully');
    assert(pdfData.page_count === 4, 'Extracted 4 Pages accurately', `Count: ${pdfData.page_count}`);
    assert(pdfData.tables && pdfData.tables.length > 0, 'Extracted Tables from Document', `Tables: ${pdfData.tables.length}`);
  } catch (err) {
    assert(false, 'pdfplumber PDF Extractor', err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Fuzzy Matching & Duplicate Developer Resolution
  // -------------------------------------------------------------
  console.log('\n▶ [Test 6] Testing Fuzzy Entity Resolution (Algorithm A2)...');
  try {
    const existingDevelopers = [
      { company_id: '1', legal_name: 'Azure Power India Private Limited', normalized_name: 'azure power india' },
      { company_id: '2', legal_name: 'Tata Power Renewable Energy Ltd', normalized_name: 'tata power renewable energy' },
      { company_id: '3', legal_name: 'Adani Green Energy Limited', normalized_name: 'adani green energy' },
    ];

    // Case 1: Suffix difference (Private Limited vs Pvt Ltd)
    const match1 = findMatchingCompanies('Azure Power India Pvt Ltd', existingDevelopers);
    assert(match1.length > 0 && match1[0].isExactMatch === true, 'Exact Normalized Company Match', 'Azure Power 1.0');

    // Case 2: Minor spelling variation
    const match2 = findMatchingCompanies('Tata Powers Renewable Energys', existingDevelopers);
    assert(match2.length > 0 && match2[0].similarity >= 0.85, 'Fuzzy Levenshtein Match >= 85%', `Sim: ${match2[0]?.similarity}`);

    // Case 3: Different company
    const match3 = findMatchingCompanies('Reliance Commercial Finance', existingDevelopers);
    assert(match3.length === 0, 'Unrelated Company Correctly Returns Zero Matches');
  } catch (err) {
    assert(false, 'Fuzzy Matching Service', err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Lead Qualification & 100-Point Scoring Engine
  // -------------------------------------------------------------
  console.log('\n▶ [Test 7] Testing 100-Point Scoring Engine (Algorithm A5)...');
  try {
    // Utility-scale 350 MW developer in India
    const highScore = calculateLeadScore({
      companyRole: 'developer',
      hasProject: true,
      projectSourceType: 'confirmed',
      largestCapacityMw: 350,
      projectCount: 4,
      hasConfirmedNeed: true,
      possibleNeedsCount: 2,
      hasVerifiedDecisionMaker: true,
      hasIdentifiedContact: true,
      country: 'India',
      latestEngagementType: 'meeting',
    });

    assert(highScore.totalScore >= 80, 'Score in High Priority Band (>= 80)', `Score: ${highScore.totalScore}`);
    assert(highScore.band === 'high', 'Assigned Band == "high"');
    assert(highScore.breakdown.capacity_mw === 15, 'Full 15 marks for >= 100 MW capacity');
    assert(highScore.breakdown.industry_relevance === 15, 'Full 15 marks for Developer role');

    // Small sub-5 MW plant with unverified contacts
    const lowScore = calculateLeadScore({
      companyRole: 'other',
      hasProject: true,
      largestCapacityMw: 3,
      projectCount: 1,
      hasConfirmedNeed: false,
      possibleNeedsCount: 1,
      hasVerifiedDecisionMaker: false,
      hasIdentifiedContact: false,
      country: 'India',
      latestEngagementType: 'none',
    });

    assert(lowScore.totalScore < 60, 'Score in Nurture Band (< 60)', `Score: ${lowScore.totalScore}`);
    assert(lowScore.band === 'nurture', 'Assigned Band == "nurture"');
  } catch (err) {
    assert(false, 'Scoring Engine Service', err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Discovered Projects Queue & Review Action
  // -------------------------------------------------------------
  console.log('\n▶ [Test 8] Testing Discovered Projects Review API...');
  try {
    const res = await fetch(`${BACKEND_URL}/discovered-projects?review_status=pending_review`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert(res.status === 200, 'Discovered Projects Status 200');
    assert(Array.isArray(data.data), 'Returns array of discovered projects');
  } catch (err) {
    assert(false, 'Discovered Projects API', err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Collection Run Monitor
  // -------------------------------------------------------------
  console.log('\n▶ [Test 9] Testing Collection Runs Endpoint...');
  try {
    const res = await fetch(`${BACKEND_URL}/collection-runs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert(res.status === 200, 'Collection Runs Status 200');
    assert(Array.isArray(data.runs), 'Returns collection runs history');
  } catch (err) {
    assert(false, 'Collection Runs Monitor', err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Frontend Vite Server Verification
  // -------------------------------------------------------------
  console.log('\n▶ [Test 10] Testing Frontend Vite Dev Server...');
  try {
    const res = await fetch(FRONTEND_URL);
    const html = await res.text();
    assert(res.status === 200, 'Frontend HTTP Status 200');
    assert(html.includes('Vedanjay Power | Outbound Lead Discovery & Intelligence'), 'Frontend Document Title Correct');
    assert(html.includes('<div id="root"></div>'), 'React Root Div Mounting Point Found');
  } catch (err) {
    assert(false, 'Frontend Dev Server', err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(` RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
