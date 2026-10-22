# Vedanjay Power — Outbound Lead Discovery & Intelligence System

[![Node.js](https://img.shields.io/badge/Node.js-v22%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v5.3-blue.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-v19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v8-purple.svg)](https://vite.dev/)
[![pdfplumber](https://img.shields.io/badge/pdfplumber-v0.11-orange.svg)](https://pypi.org/project/pdfplumber/)
[![License](https://img.shields.io/badge/License-ISC-brightgreen.svg)]()

> Automated, project-first outbound customer acquisition system for renewable energy plants (Solar, Wind, Hybrid, Storage) selling forecasting, scheduling, QCA, and telemetry services.

---

## Architecture Overview

```
[ Data Sources ] ────► [ Ingestion Engines ] ────► [ Deduplication & Matching ] ────► [ Discovered Queue ] ────► [ Analyst Review & Scoring ]
- MNRE / CEA Files      - Python pdfplumber        - SHA-256 Fingerprints              - Status: Pending Review     - Algorithm A5 (100 pts)
- SECI Tenders          - Node.js csv-parser       - Levenshtein (>=82% match)         - Capacity MW & Tech         - Approved -> Outbound Lead
- Industry RSS Feeds    - Cheerio HTML Scraper     - SPV to Parent Group Link          - Scoring Preview            - CRM Pipeline
```

---

## Features

- **Document & Tender Ingestion**:
  - Python `pdfplumber` integration to extract multi-page tables from renewable energy tender PDFs.
  - Streaming CSV parser with header normalization for CEA/MNRE monthly project registers.
  - RSS feed reader with automated entity extraction for capacity (MW), state, and technology (`solar`, `wind`, `hybrid`, `storage`).
- **Entity Resolution & Deduplication**:
  - SHA-256 content fingerprinting to prevent repeat notices from re-importing.
  - Fuzzy matching engine using Levenshtein distance ($\ge 82\%$ threshold) with corporate suffix normalization (`Pvt Ltd`, `Limited`, `LLP`).
- **100-Point Lead Scoring Engine (Algorithm A5)**:
  - 8-factor evaluation model: *Capacity MW (15)*, *Project Confirmed (15)*, *Industry Relevance (15)*, *Geography (10)*, *Service Need (15)*, *Contact Availability (10)*, *Number of Projects (10)*, *Engagement (10)*.
  - Priority tiers: **High** ($\ge 80$), **Medium** ($60\text{--}79$), **Nurture** ($< 60$).
- **Modern Web Dashboard (React + Vite)**:
  - **Discovered Projects Review Queue**: Search, filter, inspect, and approve candidate projects.
  - **Document Uploader**: Drag-and-drop zone for PDF tender notices and CSV project tables.
  - **Collection Monitor**: Audit log of past jobs, duration, deduplicated counts, and run errors.
  - **Source Registry**: Central repository of permitted regulatory and industry sources.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/              # Environment & configuration loader
│   │   ├── controllers/         # REST API controllers
│   │   ├── db/                  # PostgreSQL schema (24 tables) & seed data
│   │   ├── middlewares/         # JWT authentication, RBAC, error handlers
│   │   ├── routes/              # Express API route declarations
│   │   ├── scripts/             # Python pdfplumber script & E2E test runner
│   │   ├── services/
│   │   │   ├── ingestion/       # pdfExtractor, csvAdapter, rssAdapter, htmlScraper
│   │   │   ├── collectionRunner.service.js
│   │   │   ├── fuzzyMatching.service.js
│   │   │   ├── scheduler.service.js
│   │   │   └── scoring.service.js
│   │   ├── app.js               # Express application initialization
│   │   └── server.js            # Server entry point & graceful shutdown
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Navbar, ReviewQueue, ReviewModal, DocumentUploader, etc.
│   │   ├── services/            # API client with automatic token injection
│   │   ├── App.jsx              # Main dashboard container
│   │   ├── App.css              # Dashboard layout & component styles
│   │   └── index.css            # Dark glassmorphic design system tokens
│   ├── vite.config.js           # Vite configuration with proxy to :5000
│   └── package.json
│
├── run.bat                      # Windows one-click launcher
└── package.json                 # Root script orchestrator
```

---

## Getting Started

### Prerequisites
- **Node.js**: v22+ or v24 LTS
- **Python**: 3.11+ (with `pdfplumber` installed)
- **PostgreSQL**: 18+ (optional in dev mode; built-in mock fallback enabled)

### Installation

1. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Install frontend dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

3. **Install Python PDF extraction dependency**:
   ```bash
   py -3.11 -m pip install pdfplumber
   ```

---

## Running the Application

### Option A: Windows One-Click Launcher
Double-click `run.bat` in the root folder.

### Option B: Manual Command Line
- **Backend Server** (Port 5000):
  ```bash
  cd backend
  node src/server.js
  ```
- **Frontend Dashboard** (Port 3000):
  ```bash
  cd frontend
  npm run dev
  ```

Open **`http://localhost:3000/`** in your browser.

---

## Running Tests

Execute the automated end-to-end test suite:
```bash
npm test
```
All 32 tests (health check, JWT auth, CSV parsing, PDF table extraction, fuzzy entity resolution, 100-point scoring, review queue, and frontend server) will run and report status.
