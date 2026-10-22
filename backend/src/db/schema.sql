-- ==============================================================================
-- Vedanjay Power - Outbound & Inbound Lead Management Database Schema
-- Reference: Vedanjay_Power_Data_Architecture_Database_Design.pdf
-- ==============================================================================

-- Enable UUID extension if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. App Users (5.1.1)
CREATE TABLE IF NOT EXISTS app_user (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN (
        'admin', 'management', 'sales_manager', 'salesperson', 'marketing', 'technical', 'research_analyst'
    )),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Data Sources (5.1.2)
CREATE TABLE IF NOT EXISTS data_source (
    data_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) UNIQUE NOT NULL,
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN (
        'official_api', 'official_file', 'licensed', 'news_feed', 'manual_research', 'website_form', 'ad_platform'
    )),
    terms_note TEXT,
    is_permitted BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Job Runs (5.1.3)
CREATE TABLE IF NOT EXISTS job_run (
    job_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(30) NOT NULL CHECK (job_type IN (
        'source_collection', 'rescoring', 'reminders', 'alerts', 'weekly_report', 'data_quality', 'ai_extraction'
    )),
    data_source_id UUID REFERENCES data_source(data_source_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN (
        'running', 'succeeded', 'partial', 'failed', 'stuck'
    )),
    attempts INT NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    records_read INT NOT NULL DEFAULT 0 CHECK (records_read >= 0),
    records_created INT NOT NULL DEFAULT 0 CHECK (records_created >= 0),
    records_updated INT NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
    records_skipped INT NOT NULL DEFAULT 0 CHECK (records_skipped >= 0),
    records_rejected INT NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
    sent_for_review INT NOT NULL DEFAULT 0 CHECK (sent_for_review >= 0),
    errors JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 4. Source Items (5.1.4)
CREATE TABLE IF NOT EXISTS source_item (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_source(data_source_id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL,
    job_run_id UUID REFERENCES job_run(job_run_id) ON DELETE SET NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, fingerprint)
);

-- 5. Company (5.2.1)
CREATE TABLE IF NOT EXISTS company (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    website_domain VARCHAR(150),
    parent_company_id UUID REFERENCES company(company_id) ON DELETE SET NULL,
    state VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    cin VARCHAR(50),
    pan VARCHAR(30),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_normalized_name ON company(normalized_name);
CREATE INDEX IF NOT EXISTS idx_company_domain ON company(website_domain);

-- 6. Renewable Project (5.2.2)
CREATE TABLE IF NOT EXISTS renewable_project (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(255) NOT NULL,
    technology VARCHAR(30) NOT NULL CHECK (technology IN ('solar', 'wind', 'hybrid', 'storage')),
    capacity_mw NUMERIC(10, 2) CHECK (capacity_mw >= 0),
    substation VARCHAR(150),
    state VARCHAR(100),
    district VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    stage VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (stage IN ('planned', 'under_construction', 'commissioned', 'operational')),
    expected_cod DATE,
    actual_cod DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_tech ON renewable_project(technology);
CREATE INDEX IF NOT EXISTS idx_project_capacity ON renewable_project(capacity_mw);

-- 7. Project Company Role (5.2.3)
CREATE TABLE IF NOT EXISTS project_company_role (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES renewable_project(project_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('owner', 'developer', 'operator', 'spv', 'epc', 'om')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, company_id, role)
);

-- 8. Contact (5.2.4)
CREATE TABLE IF NOT EXISTS contact (
    contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150),
    department VARCHAR(100),
    seniority VARCHAR(30) CHECK (seniority IN ('c_level', 'director', 'vp', 'manager', 'lead', 'staff')),
    email VARCHAR(150),
    phone VARCHAR(50),
    linkedin_url VARCHAR(255),
    is_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_consent BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_company ON contact(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email);

-- 9. Marketing Source (5.3.1)
CREATE TABLE IF NOT EXISTS marketing_source (
    source_id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Campaign (5.3.2)
CREATE TABLE IF NOT EXISTS campaign (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INT NOT NULL REFERENCES marketing_source(source_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    tracking_code VARCHAR(80) UNIQUE NOT NULL,
    utm_source VARCHAR(80),
    utm_medium VARCHAR(80),
    utm_campaign VARCHAR(80),
    budget NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Scoring Rule Version (5.4.1)
CREATE TABLE IF NOT EXISTS scoring_rule_version (
    rule_version VARCHAR(20) PRIMARY KEY,
    rules JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
    approved_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Lead (5.4.2)
CREATE TABLE IF NOT EXISTS lead (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(30) UNIQUE NOT NULL,
    company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
    origin VARCHAR(20) NOT NULL CHECK (origin IN ('outbound', 'inbound')),
    first_source_id INT REFERENCES marketing_source(source_id) ON DELETE SET NULL,
    stage VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (stage IN (
        'new', 'verified', 'qualified', 'contacted', 'responded', 'meeting', 'demo', 'proposal', 'negotiation', 'won', 'lost'
    )),
    assigned_to UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    next_follow_up_date DATE,
    loss_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_stage ON lead(stage);
CREATE INDEX IF NOT EXISTS idx_lead_company ON lead(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_assigned_to ON lead(assigned_to);

-- 13. Lead Project Link (5.4.3)
CREATE TABLE IF NOT EXISTS lead_project (
    lead_id UUID NOT NULL REFERENCES lead(lead_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES renewable_project(project_id) ON DELETE CASCADE,
    PRIMARY KEY (lead_id, project_id)
);

-- 14. Lead Contact Link (5.4.4)
CREATE TABLE IF NOT EXISTS lead_contact (
    lead_id UUID NOT NULL REFERENCES lead(lead_id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contact(contact_id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (lead_id, contact_id)
);

-- 15. Lead Service Need (5.4.5)
CREATE TABLE IF NOT EXISTS lead_service_need (
    need_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(lead_id) ON DELETE CASCADE,
    service_code VARCHAR(30) NOT NULL CHECK (service_code IN (
        'fs', 'qca', 'telemetry', 'open_access', 'liaisoning', 'other'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'possible' CHECK (status IN ('possible', 'confirmed')),
    recorded_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, service_code)
);

-- 16. Lead Score (5.4.6)
CREATE TABLE IF NOT EXISTS lead_score (
    score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(lead_id) ON DELETE CASCADE,
    rule_version VARCHAR(20) NOT NULL REFERENCES scoring_rule_version(rule_version),
    total_score INT NOT NULL CHECK (total_score BETWEEN 0 AND 100),
    band VARCHAR(20) NOT NULL CHECK (band IN ('high', 'medium', 'nurture')),
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_score_current ON lead_score(lead_id, is_current);
CREATE INDEX IF NOT EXISTS idx_lead_score_band ON lead_score(band);

-- 17. CRM Activity (5.4.7)
CREATE TABLE IF NOT EXISTS crm_activity (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(lead_id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contact(contact_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN (
        'call', 'meeting', 'email', 'note', 'stage_change', 'proposal_sent'
    )),
    subject VARCHAR(200) NOT NULL,
    description TEXT,
    follow_up_due DATE,
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_lead ON crm_activity(lead_id);

-- 18. Website & Marketing Enquiry (5.3.3)
CREATE TABLE IF NOT EXISTS enquiry (
    enquiry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    channel VARCHAR(30) NOT NULL DEFAULT 'website' CHECK (channel IN ('website', 'google_ads', 'linkedin', 'meta')),
    campaign_id UUID REFERENCES campaign(campaign_id) ON DELETE SET NULL,
    source_id INT REFERENCES marketing_source(source_id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    capacity_mw NUMERIC(10, 2),
    technology VARCHAR(30),
    services_interested TEXT,
    message TEXT,
    utm_source VARCHAR(80),
    utm_medium VARCHAR(80),
    utm_campaign VARCHAR(80),
    utm_content VARCHAR(80),
    utm_term VARCHAR(80),
    lead_id UUID REFERENCES lead(lead_id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rejected'))
);

-- 19. Customer (5.5.2)
CREATE TABLE IF NOT EXISTS customer (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE NOT NULL REFERENCES company(company_id) ON DELETE RESTRICT,
    customer_since DATE NOT NULL DEFAULT CURRENT_DATE,
    account_manager_id UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'churned', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. Deal (5.5.3)
CREATE TABLE IF NOT EXISTS deal (
    deal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
    lead_id UUID UNIQUE NOT NULL REFERENCES lead(lead_id) ON DELETE RESTRICT,
    deal_value NUMERIC(14, 2) DEFAULT 0.00,
    won_on DATE NOT NULL DEFAULT CURRENT_DATE,
    contract_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. Notification (5.5.4)
CREATE TABLE IF NOT EXISTS notification (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    lead_id UUID REFERENCES lead(lead_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. Audit Log (5.5.5)
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. AI Suggestion (5.5.1)
CREATE TABLE IF NOT EXISTS ai_suggestion (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_run_id UUID REFERENCES job_run(job_run_id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_source(data_source_id) ON DELETE SET NULL,
    source_ref TEXT,
    entity_type VARCHAR(50) NOT NULL,
    suggested_data JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'edited', 'rejected')),
    reviewed_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. Discovered Project (Outbound Lead Discovery & Review Queue)
CREATE TABLE IF NOT EXISTS discovered_project (
    discovered_project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_run_id UUID REFERENCES job_run(job_run_id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_source(data_source_id) ON DELETE SET NULL,
    raw_project_name VARCHAR(255) NOT NULL,
    normalized_project_name VARCHAR(255),
    raw_company_name VARCHAR(255),
    normalized_company_name VARCHAR(255),
    matched_company_id UUID REFERENCES company(company_id) ON DELETE SET NULL,
    technology VARCHAR(30) DEFAULT 'solar' CHECK (technology IN ('solar', 'wind', 'hybrid', 'storage', 'biomass', 'other')),
    capacity_mw NUMERIC(10, 2),
    state VARCHAR(100),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    expected_cod DATE,
    source_url TEXT,
    document_url TEXT,
    confidence_score NUMERIC(5, 2) DEFAULT 0.85,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'merged')),
    reviewed_by UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    renewable_project_id UUID REFERENCES renewable_project(project_id) ON DELETE SET NULL,
    lead_id UUID REFERENCES lead(lead_id) ON DELETE SET NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discovered_proj_status ON discovered_project(review_status);
CREATE INDEX IF NOT EXISTS idx_discovered_proj_source ON discovered_project(data_source_id);
CREATE INDEX IF NOT EXISTS idx_discovered_proj_matched_comp ON discovered_project(matched_company_id);
