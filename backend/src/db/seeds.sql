-- ==============================================================================
-- Vedanjay Power - Initial Seed Data
-- ==============================================================================

-- 1. Insert Default Marketing Sources
INSERT INTO marketing_source (code, name, is_active) VALUES
    ('outbound_discovery', 'Outbound Research & Discovery', TRUE),
    ('website', 'Direct Website Inbound Form', TRUE),
    ('google_ads', 'Google Search & Display Campaigns', TRUE),
    ('linkedin', 'LinkedIn Sponsored Content / Lead Gen', TRUE),
    ('meta', 'Meta (Facebook / Instagram) Renewable Ads', TRUE),
    ('referral', 'Industry & Partner Referrals', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Default Scoring Rule Version (v1)
INSERT INTO scoring_rule_version (rule_version, rules, status, created_at) VALUES
(
    'v1',
    '{
        "max_score": 100,
        "bands": {
            "high": {"min": 80, "max": 100},
            "medium": {"min": 60, "max": 79},
            "nurture": {"min": 0, "max": 59}
        },
        "factors": {
            "industry_relevance": {
                "max": 15,
                "weights": {
                    "owner": 15,
                    "developer": 15,
                    "operator": 15,
                    "spv": 15,
                    "epc": 8,
                    "om": 8,
                    "trader": 8,
                    "consultant": 8,
                    "other": 0
                }
            },
            "project_confirmed": {
                "max": 15,
                "weights": {
                    "official_licensed": 15,
                    "news_secondary": 10,
                    "none": 0
                }
            },
            "capacity_mw": {
                "max": 15,
                "weights": {
                    "gte_100": 15,
                    "25_to_99": 10,
                    "5_to_24": 5,
                    "lt_5": 0
                }
            },
            "number_of_projects": {
                "max": 10,
                "weights": {
                    "gte_5": 10,
                    "2_to_4": 8,
                    "1": 5,
                    "0": 0
                }
            },
            "service_need": {
                "max": 15,
                "weights": {
                    "confirmed_by_company": 15,
                    "two_or_more_possible": 12,
                    "one_possible": 8,
                    "none": 0
                }
            },
            "contact_availability": {
                "max": 10,
                "weights": {
                    "verified_decision_maker": 10,
                    "identified_contact": 6,
                    "none": 0
                }
            },
            "geography": {
                "max": 10,
                "weights": {
                    "target_country_india": 10,
                    "under_evaluation": 4,
                    "other": 0
                }
            },
            "engagement_90d": {
                "max": 10,
                "weights": {
                    "meeting_request": 10,
                    "enquiry": 8,
                    "reply": 6,
                    "none": 0
                }
            }
        }
    }'::jsonb,
    'active',
    CURRENT_TIMESTAMP
)
ON CONFLICT (rule_version) DO NOTHING;

-- 3. Insert Initial Default Admin User
-- Password is 'Password@123' (bcrypt hash with 10 salt rounds)
INSERT INTO app_user (full_name, email, password_hash, role, is_active) VALUES
    ('Vedanjay System Admin', 'admin@vedanjaypower.com', '$2a$10$wT8KzQ/v1hQOEvc5v13.0uN1x2J8xM9YqN6n0Rk7i8sZ6J6D8p4g2', 'admin', TRUE),
    ('Sales Manager', 'sales.manager@vedanjaypower.com', '$2a$10$wT8KzQ/v1hQOEvc5v13.0uN1x2J8xM9YqN6n0Rk7i8sZ6J6D8p4g2', 'sales_manager', TRUE),
    ('Lead Salesperson', 'salesperson@vedanjaypower.com', '$2a$10$wT8KzQ/v1hQOEvc5v13.0uN1x2J8xM9YqN6n0Rk7i8sZ6J6D8p4g2', 'salesperson', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 4. Insert Default Outbound Data Sources (5.1.2)
INSERT INTO data_source (name, source_type, terms_note, is_permitted, is_active) VALUES
    ('MNRE Official Renewable Portals & Tenders', 'official_api', 'Official public energy portal data', TRUE, TRUE),
    ('CEA Monthly Renewable Generation & Status Reports', 'official_file', 'Monthly public RE monitoring PDFs/CSVs', TRUE, TRUE),
    ('SECI Renewable Auction & Allocation Portals', 'official_api', 'Public utility tender award notices', TRUE, TRUE),
    ('Renewable Energy Industry RSS News Feeds', 'news_feed', 'Permitted public RSS/Atom feeds', TRUE, TRUE),
    ('Manual & Verified Industry Document Uploads', 'manual_research', 'Internal research uploads and analyst spreadsheets', TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;
