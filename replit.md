# Live SEO Command Center

## Overview
A production-ready Live SEO Dashboard for TekRevol, built as an internal SEO Command Center. The application provides comprehensive SEO analytics, keyword tracking, competitor analysis, and actionable recommendations.

## Current State
- **Status**: Phase 3A Complete (Schema & Storage for SEO Operating System)
- **Last Updated**: November 30, 2025
- **Live Data**: 445 keywords, 12 pages, 20 competitors, 14 recommendations, 32 health snapshots
- **Phase 3 Goal**: Transform into full "SEO Operating System" with true historical ranking engine, automated crawl schedules, per-project strategy rules, audit logging, advanced scoring, and keyword-level competitor mapping

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, Recharts
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **UI Components**: shadcn/ui component library
- **Scheduling**: node-cron with CST timezone support

## Project Architecture

### Database Schema
- `projects` - SEO projects/domains being tracked (with isActive flag)
- `keywords` - Keywords tracked for each project (with location_id, language_code, priority, trackDaily, isActive, isCorePage)
- `locations` - Geographic locations with DataForSEO location codes
- `rankings_history` - Historical ranking data per keyword per day (with projectId, serpFeatures JSONB for SERP intelligence)
- `seo_health_snapshots` - Daily SEO health aggregates per project
- `keyword_metrics` - Per-keyword metrics over time (position, volume, difficulty, intent, opportunity score)
- `page_metrics` - Per-URL metrics (backlinks, technical health, content gaps)
- `seo_recommendations` - Actionable SEO tasks with severity, status, and impact tracking (baseline_snapshot, result_snapshot, impact_score, impact_summary)
- `competitor_metrics` - Competitor analysis with pressure index (domain-level)
- `keyword_competitor_metrics` - **NEW** Per-keyword competitor data (competitor_domain, latest_position, avg_position, visibility_score, serp_features, is_direct_competitor, click_share_estimate)
- `settings_priority_rules` - P1/P2/P3 priority classification rules
- `import_logs` - Data import audit trail (with projectId, userIdentifier, meta JSONB for enhanced tracking)
- `crawl_schedules` - Page crawl schedules with type, frequency, config, last_run_status for executable batch processing
- `settings_quick_wins` - Per-project configurable thresholds for Quick Wins board (enabled, min_intent_score, min_cpc)
- `settings_falling_stars` - Per-project configurable thresholds for Falling Stars board (enabled flag)

### API Endpoints

#### Dashboard
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project (seeds demo data)
- `GET /api/dashboard/overview` - Executive dashboard overview
- `GET /api/dashboard/keywords` - Keyword performance data
- `GET /api/dashboard/pages` - Page analytics
- `GET /api/dashboard/recommendations` - SEO recommendations
- `PATCH /api/dashboard/recommendations/:id` - Update recommendation status
- `GET /api/dashboard/competitors` - Competitor analysis

#### Data Management
- `GET /api/data/locations` - List all locations
- `GET /api/data/priority-rules` - List priority classification rules
- `POST /api/data/priority-rules/init` - Initialize default P1/P2/P3 rules
- `POST /api/data/import/locations` - Import locations from CSV
- `POST /api/data/import/keywords` - Import keywords from CSV
- `POST /api/data/import/rankings` - Import rankings from XLSX
- `POST /api/data/import/projects` - Import projects from XLSX
- `POST /api/data/import/full` - Run full import (locations + keywords + optional rankings)
- `PATCH /api/data/keywords/bulk` - Bulk update keywords (priority, cluster, isActive, etc.)

#### Jobs
- `GET /api/system/status` - Check DataForSEO configuration status
- `POST /api/jobs/snapshot` - Manually trigger daily SEO snapshot
- `POST /api/jobs/keywords` - Manually trigger keyword metrics update
- `POST /api/jobs/competitors` - Manually trigger competitor analysis
- `POST /api/jobs/recommendations` - Manually trigger recommendation generation

#### Scheduled Crawls
- `GET /api/crawl-schedules` - List all crawl schedules for a project
- `POST /api/crawl-schedules` - Create new crawl schedule (URL, time, days of week)
- `PATCH /api/crawl-schedules/:id` - Update existing crawl schedule
- `DELETE /api/crawl-schedules/:id` - Delete crawl schedule

**Predefined Schedules (auto-created per project):**
- `https://{domain}/keywords/rankings` - 9:00 AM (Mon, Wed, Fri)
- `https://{domain}/pages/metrics` - 10:00 AM (Sun, Tue, Thu, Sat)
- `https://{domain}/competitors/analysis` - 2:00 PM (Wed, Fri)

#### Operational Boards (Phase 2)
- `GET /api/quick-wins?projectId=...` - Keywords positioned 6-20 with high opportunity scores
- `GET /api/falling-stars?projectId=...` - Keywords with ranking drops ≥5 positions
- `GET /api/rankings-history/:keywordId` - Historical position data per keyword

### Frontend Pages (9 Pages)
- `/` - Main dashboard with KPI cards, health chart, top opportunities
- `/keywords` - Keyword analytics with position distribution and intent charts
- `/pages` - Page-level metrics with risk analysis
- `/recommendations` - Actionable SEO tasks with filtering
- `/competitors` - Competitive pressure analysis with visualization
- `/data-management` - Bulk keyword operations (delete, activate/deactivate, filter by intent)
- `/scheduled-crawls` - Page crawl schedule management with time and day selectors (includes 3 predefined crawls)
- `/quick-wins` - **Operational Board**: High-opportunity keywords positioned 6-20, sorted by opportunity score
- `/falling-stars` - **Operational Board**: Keywords with ranking drops ≥5 positions, for defensive SEO

## Data Feed & Control Layer

### Import System
The ingestion service (`server/services/ingestion.ts`) handles bulk data imports:
- **Locations**: CSV import with DataForSEO location codes
- **Keywords**: CSV import with automatic priority assignment (P1/P2/P3)
- **Rankings**: XLSX import for historical ranking data
- **Projects**: XLSX import for project metadata

### Priority Classification
Keywords are automatically classified into priority tiers:
- **P1 (High)**: Commercial/transactional intent + Position ≤ 10
- **P2 (Medium)**: Any intent + Position ≤ 20
- **P3 (Low)**: All other keywords

### Scheduling
Jobs are scheduled via node-cron with CST timezone (America/Chicago):
- **Daily 5PM CST**: SEO snapshot aggregation
- **Weekend Heavy Jobs**: Reserved for intensive data collection

## Key Features
1. **SEO Health Score** - Aggregated 0-100 score based on rankings, authority, technical health, and content
2. **Opportunity Scoring** - Identifies high-potential keywords based on volume, position, and difficulty
3. **Technical Risk Analysis** - Monitors indexability, schema, CWV, and duplicate content
4. **Competitor Pressure Index** - Tracks competitive threat level per domain
5. **Actionable Recommendations** - Task-like items with severity levels and status tracking
6. **Historical Trend Analysis** - SEO health chart with:
   - Date range selector (7D, 14D, 30D, 90D, All) anchored to latest data point
   - Linear regression forecasting with toggle control
   - Period comparison (first half vs second half of selected range)
   - 3-day moving average smoothing line
   - Trend badge with percentage change indicator
7. **Advanced Keyword Filtering** - Position brackets, opportunity ranges, SERP features, clusters, active filter chips, and preset buttons
8. **Data Import Pipeline** - Bulk CSV/XLSX import for locations, keywords, and rankings
9. **Priority-Based Scheduling** - P1/P2/P3 keyword classification for scheduled job prioritization
10. **Automated Crawl Schedules** - 3 predefined batch processing crawls per project:
    - Keyword rankings tracking (3x weekly)
    - Page metrics collection (4x weekly)
    - Competitor analysis updates (2x weekly)
11. **Quick Wins Board** (Phase 2) - Proactive SEO growth opportunities:
    - Keywords in positions 6-20 with commercial/transactional intent
    - Sorted by opportunity score (volume × position proximity × low difficulty)
    - Filters: location, cluster, intent
12. **Falling Stars Board** (Phase 2) - Defensive SEO alerts:
    - Keywords that dropped ≥5 positions from top 10
    - Highlights core page keywords for immediate action
    - Tracks position delta over 7-day window

## Development

### Running the Project
```bash
npm run dev
```
This starts both the Express backend and Vite frontend on port 5000.

### Database Commands
```bash
npm run db:push   # Push schema changes to database
```

### Import Data Files
The following files are available for import in `attached_assets/`:
- `locations_1764365369944.csv` - 23 geographic locations
- `Keywords_1764365369944.csv` - 436 keywords
- `projects_1764365369944.xlsx` - Project definitions
- `ranking_1764365369944.xlsx` - Historical ranking data

## Design System
- **Fonts**: Inter (UI), JetBrains Mono (code/URLs)
- **Color Scheme**: Professional dashboard with blue primary accent
- **Dark Mode**: Supported via theme toggle
- **Components**: shadcn/ui with custom elevation system

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `DATAFORSEO_API_LOGIN` - DataForSEO API login (required for live data) ✓ Configured
- `DATAFORSEO_API_PASSWORD` - DataForSEO API password (required for live data) ✓ Configured

## Security Features
- **File Path Validation**: Import endpoints use containment checks (path.relative) and symlink resolution (fs.realpathSync) to prevent directory traversal attacks
- **Allowed Import Directories**: attached_assets, imports, data
- **Input Validation**: All API endpoints validate request bodies using Zod schemas

## DataForSEO Integration Status
- **API Connectivity**: ✓ Configured and connected
- **Keyword Metrics Job**: ✓ Updates difficulty (1-93), intent (commercial/navigational/informational/transactional), SERP rankings
- **Competitor Analysis Job**: ✓ Analyzes top 10 competitors with avg positions
- **SEO Health Snapshot**: ✓ Calculates aggregated health scores (0-100)
- **Scheduled Jobs**: ✓ Daily 5PM CST snapshot, weekend heavy jobs

### API Endpoints Used
- `/serp/google/organic/live/advanced` - SERP rankings
- `/keywords_data/google_ads/search_volume/live` - Search volume
- `/dataforseo_labs/google/bulk_keyword_difficulty/live` - Keyword difficulty
- `/dataforseo_labs/google/search_intent/live` - Search intent classification

## Completed Features Since MVP
- ✅ Data Management page with bulk keyword operations
- ✅ Scheduled Crawls system for batch page processing at specific times
- ✅ All 445 keywords now visible in Data Management (left join query)
- ✅ Full CRUD operations for crawl schedules
- ✅ Sidebar navigation with all 9 main pages
- ✅ Predefined crawl schedules (3 auto-created per project):
  - Keyword Rankings Update (Mon/Wed/Fri 9:00 AM)
  - Pages Metrics (Sun/Tue/Thu/Sat 10:00 AM)
  - Competitors Analysis (Wed/Fri 2:00 PM)
- ✅ **Phase 2: Quick Wins Board** - Operational workboard for proactive growth
- ✅ **Phase 2: Falling Stars Board** - Operational workboard for defensive SEO
- ✅ **Phase 2: Rankings History API** - Historical position tracking per keyword
- ✅ **Phase 2: Configurable Settings Tables** - Thresholds for both boards
- ✅ **Phase 3A: Schema & Storage** - SEO Operating System foundation:
  - `keyword_competitor_metrics` table for per-keyword competitor tracking
  - Enhanced `rankings_history` with projectId and serpFeatures JSONB
  - Extended `crawl_schedules` with type, frequency, config, last_run_status
  - Per-project settings for Quick Wins and Falling Stars boards
  - Enhanced `import_logs` with projectId, userIdentifier, meta JSONB
  - Recommendation impact tracking with baseline/result snapshots

## Next Steps (Phase 3B-D)
- **Phase 3B: Jobs & Services** - Daily rankings sync, keyword competitor mapping job, crawl scheduler runner, SEO scoring v2, recommendation impact tracker, executive narrative generator
- **Phase 3C: API Layer** - Keyword competitor endpoints, per-project settings CRUD, recommendation impact API, enhanced crawl schedule endpoints
- **Phase 3D: Frontend** - Keyword/competitor views, settings pages, impact visualization, crawl dashboard enhancements
