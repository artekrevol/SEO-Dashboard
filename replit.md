# Live SEO Command Center

## Overview
The Live SEO Command Center is a production-ready dashboard designed for TekRevol to provide comprehensive SEO analytics, keyword tracking, competitor analysis, and actionable recommendations. Its purpose is to transform into a full "SEO Operating System" with historical ranking, automated crawls, per-project strategies, and advanced scoring.

## Transformation Project Plan
**See:** `docs/SEO_TRANSFORMATION_PROJECT_PLAN.md` for the complete 6-phase transformation roadmap.

### Current Phase: PHASE 4 - Technical SEO Suite ✅ COMPLETED
Focus: Site audit functionality using DataForSEO OnPage API

**Completed Features:**
- **Tech Crawls Database Table**: Stores crawl configuration (target domain, max pages, crawl depth), status tracking, and DataForSEO task ID (`onpageTaskId`)
- **Page Audits Table**: Stores per-URL technical metrics including OnPage score (0-100), status code, indexability, title/description analysis, heading counts, content metrics, performance data (LCP, CLS, TBT, FID), and link counts
- **Page Issues Table**: Normalized issue list with severity (critical/warning/info), category (indexability, content, links, performance, HTML, images, security), occurrence count, and resolution guidance
- **DataForSEO OnPage API Integration**: 6 API methods - `createOnPageTask`, `getOnPageTaskStatus`, `getOnPagePages`, `getOnPagePagesByResource`, `getOnPageErrors`, `getOnPageSummary`
- **OnPage Sync Pipeline**: Background job that polls for task completion, fetches page data, and auto-generates SEO recommendations from critical/error issues
- **Auto-Recommendation Generation**: Critical OnPage issues automatically create actionable recommendations with severity, type, and specific URL/issue details
- **Site Audit Page**: Full-featured UI with crawl status cards, start crawl dialog (max pages configuration), tabbed interface for Pages/Issues views, and severity filtering
- **PageAuditDrawer**: Per-URL technical analysis showing OnPage score with color-coded indicator, meta analysis, content metrics, performance breakdown (Core Web Vitals), link counts, and individual issues list
- **Pages Table Integration**: Tech risk scores now derived from OnPage audit data when available (100 - OnPage score), clickable to open PageAuditDrawer with issue count display
- **Navigation**: Site Audit added to Analytics section in sidebar with Globe icon

### Completed: PHASE 2 - Link Building Tracker ✅
Focus: Backlink management workflow (highest ROI: saves 110 hrs/month)

**Features:**
- **Backlinks Database Table**: Stores referring domain, URL, anchor text, link type (dofollow/nofollow), domain authority, first/last seen dates, lost status, and spam score
- **Spam Score Detection**: Bulk spam score lookup via DataForSEO `/v3/backlinks/bulk_spam_score/live` endpoint with color-coded indicators (Safe ≤30%, Review 31-60%, Toxic >60%)
- **Backlink Detail Drawer**: Sheet component showing backlink overview (total, live, lost, new counts), top anchor texts, link type breakdown, spam distribution, and individual backlink details with filtering
- **Backlinks Crawl Type**: Added to scheduled crawls system with weekly auto-verification (Sundays at 11:00 AM)
- **Pages Integration**: Clickable backlinks count in Pages table opens drawer with filtered results for that page
- **DataForSEO Backlinks API Integration**: Live discovery of new backlinks using `/backlinks/backlinks/live` endpoint
- **Link Status Tracking**: Automatic detection of lost backlinks during crawls
- **Manual Crawl Trigger**: POST `/api/backlinks/crawl` endpoint for on-demand backlink fetching
- **Competitor Backlinks Table**: Stores competitor backlink data with opportunity scoring (DA-weighted + link type bonus - spam penalty)
- **CompetitorBacklinksDrawer**: Full-featured drawer with filter-aware derived stats, opportunity toggle ("All Links" / "Opportunities"), top opportunities list, link type breakdown, and spam distribution
- **Competitor Integration**: Backlinks count column added to Competitors table with drawer integration for gap analysis
- **Backlink Gap Analysis**: Compares competitor backlinks against project backlinks to identify domains linking to competitors but not to you. Priority scoring: DA≥40 + ≥2 competitors linking + spam≤30% = high priority. GET `/api/competitor-backlinks/gap-analysis` endpoint returns gaps sorted by priority with summary metrics
- **Gap-to-Outreach Promotion**: One-click promotion of gap opportunities to SEO Recommendations. POST `/api/recommendations/promote-gap` creates "backlink_outreach" type recommendations with domain, DA, spam score, and competitor data stored in sourceSignals field. UI shows "Added" confirmation and prevents duplicate promotions within session

### Completed: PHASE 1 - Foundation ✅
- **CSV/XLSX Export**: Reusable ExportButton component with export-utils.ts for all data tables
- **Historical Rankings Page**: Position trend charts, distribution breakdown, daily stats aggregation
- **Per-Keyword Position History**: Interactive modal with charts showing position changes over time
- **Settings Page**: Configurable thresholds for Quick Wins and Falling Stars detection

### Project Summary:
- **Team Size:** 7 SEO team members managing 4 brands
- **Total Estimated Savings:** ~643 hrs/month, ~$118K/year
- **Total Development Time:** ~348 hours across 6 phases (16 weeks)

## User Preferences
I prefer detailed explanations. Ask before making major changes. I want iterative development. I prefer simple language. I like functional programming.

## System Architecture

### UI/UX Decisions
The frontend is built with React + TypeScript, Vite, Tailwind CSS, Radix UI, and shadcn/ui components. It uses Inter for UI text and JetBrains Mono for code/URLs. The color scheme is a professional dashboard with a blue primary accent, and it supports a dark mode.

### Technical Implementations
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, Recharts.
- **Backend**: Node.js + Express + TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Scheduling**: node-cron with CST timezone support for automated jobs.
- **Data Ingestion**: Handles bulk CSV/XLSX imports for locations, keywords, rankings, and projects.
- **Priority Classification**: Keywords are automatically tiered into P1 (High), P2 (Medium), and P3 (Low) based on intent and current ranking.
- **Automated Crawl Schedules**: Predefined schedules for keyword rankings (3x weekly), page metrics (4x weekly), and competitor analysis (2x weekly).

### Feature Specifications
- **SEO Health Score**: Aggregated 0-100 score based on various SEO factors.
- **Opportunity Scoring**: Identifies high-potential keywords.
- **Technical Risk Analysis**: Monitors indexability, schema, Core Web Vitals, and duplicate content.
- **Competitor Pressure Index**: Volume-weighted threat score measuring competitive pressure. Formula: For keywords where competitors rank in top 20, calculates positionScore = (21 - competitorPos) / 20, gapFactor based on our ranking position (or 1.0 if not ranking), and aggregates threatScore = volume × positionScore × gapFactor. Final index is normalized to 0-100 scale.
- **Actionable Recommendations**: Task-like items with severity and status tracking.
- **Historical Trend Analysis**: SEO health chart with date range selection, linear regression forecasting, period comparison, and moving averages.
- **Advanced Keyword Filtering**: Comprehensive filtering options including position, opportunity, SERP features, and clusters.
- **Operational Boards**:
    - **Quick Wins Board**: Identifies keywords in positions 6-20 with high opportunity scores for proactive growth.
    - **Falling Stars Board**: Alerts for keywords with ranking drops ≥5 positions for defensive SEO.
- **Executive Narrative Generator**: AI-powered summaries of project performance.
- **Per-Project Settings**: Configurable thresholds for Quick Wins and Falling Stars boards.
- **Page Analytics**: Aggregated keyword performance metrics per tracked page, including average position, best position, keywords in Top 3/Top 10, and total keywords targeting each URL. Uses the latest available ranking data for each keyword with normalized URL matching.

### System Design Choices
- **Database Schema**:
    - `projects`: Tracks SEO projects/domains.
    - `keywords`: Stores tracked keywords with detailed attributes.
    - `locations`: Geographic locations data.
    - `rankings_history`: Historical ranking data including SERP features.
    - `seo_health_snapshots`: Daily SEO health aggregates.
    - `keyword_metrics`, `page_metrics`, `competitor_metrics`: Various performance metrics.
    - `seo_recommendations`: Actionable tasks.
    - `keyword_competitor_metrics`: Per-keyword competitor data with `ourPosition` field for gap calculations.
    - `settings_priority_rules`, `settings_quick_wins`, `settings_falling_stars`: Configurable project settings.
    - `import_logs`: Audit trail for data imports.
    - `crawl_schedules`: Manages page crawl configurations.
    - `backlinks`: Tracks referring domains, URLs, anchor text, link type (dofollow/nofollow), domain/page authority, first/last seen dates, and lost status for backlink management workflow.
    - `tech_crawls`: Stores technical SEO crawl configurations (target domain, max pages, crawl depth), status tracking, and DataForSEO OnPage task ID.
    - `page_audits`: Per-URL technical audit results including OnPage score (0-100), status code, indexability, meta analysis, heading/content metrics, Core Web Vitals (LCP, CLS, TBT, FID), and link counts.
    - `page_issues`: Normalized issue list with severity (critical/warning/info), category, occurrence count, and resolution guidance.
- **Security**: File path validation, allowed import directories, and Zod schema-based input validation for all API endpoints.

## External Dependencies
- **DataForSEO**: Used for live data fetching, including SERP rankings, search volume, keyword difficulty, search intent classification, backlinks, and technical SEO audits.
    - SERP & Keywords: `/serp/google/organic/live/advanced`, `/keywords_data/google_ads/search_volume/live`, `/dataforseo_labs/google/bulk_keyword_difficulty/live`, `/dataforseo_labs/google/search_intent/live`
    - Backlinks: `/backlinks/backlinks/live`, `/backlinks/bulk_spam_score/live`
    - OnPage (Technical SEO): `/on_page/task_post`, `/on_page/summary/{task_id}`, `/on_page/pages/{task_id}`, `/on_page/pages_by_resource/{task_id}`, `/on_page/non_indexable/{task_id}`, `/on_page/errors/{task_id}`
- **PostgreSQL (Neon)**: Relational database for all project data.
- **node-cron**: For scheduling background jobs.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: UI component library.
- **TanStack Query**: Data fetching and caching.
- **Recharts**: Charting library.
- **shadcn/ui**: Component library for UI elements.