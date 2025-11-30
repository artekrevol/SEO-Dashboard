# Live SEO Command Center

## Overview
The Live SEO Command Center is a production-ready dashboard designed for TekRevol to provide comprehensive SEO analytics, keyword tracking, competitor analysis, and actionable recommendations. Its purpose is to transform into a full "SEO Operating System" with historical ranking, automated crawls, per-project strategies, and advanced scoring.

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
- **Competitor Pressure Index**: Tracks competitive threat levels.
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
    - `keyword_competitor_metrics`: Per-keyword competitor data.
    - `settings_priority_rules`, `settings_quick_wins`, `settings_falling_stars`: Configurable project settings.
    - `import_logs`: Audit trail for data imports.
    - `crawl_schedules`: Manages page crawl configurations.
- **Security**: File path validation, allowed import directories, and Zod schema-based input validation for all API endpoints.

## External Dependencies
- **DataForSEO**: Used for live data fetching, including SERP rankings, search volume, keyword difficulty, and search intent classification.
    - API Endpoints Used: `/serp/google/organic/live/advanced`, `/keywords_data/google_ads/search_volume/live`, `/dataforseo_labs/google/bulk_keyword_difficulty/live`, `/dataforseo_labs/google/search_intent/live`.
- **PostgreSQL (Neon)**: Relational database for all project data.
- **node-cron**: For scheduling background jobs.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: UI component library.
- **TanStack Query**: Data fetching and caching.
- **Recharts**: Charting library.
- **shadcn/ui**: Component library for UI elements.