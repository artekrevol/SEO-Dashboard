# Live SEO Command Center

## Overview
The Live SEO Command Center is a production-ready dashboard designed for TekRevol to provide comprehensive SEO analytics, keyword tracking, competitor analysis, and actionable recommendations. Its purpose is to transform into a full "SEO Operating System" with historical ranking, automated crawls, per-project strategies, and advanced scoring. This platform aims to significantly reduce manual SEO efforts, saving approximately 643 hours per month for a 7-member SEO team managing 4 brands, translating to an estimated annual saving of $118,000.

## User Preferences
I prefer detailed explanations. Ask before making major changes. I want iterative development. I prefer simple language. I like functional programming.

## System Architecture

### UI/UX Decisions
The frontend is built with React + TypeScript, Vite, Tailwind CSS, Radix UI, and shadcn/ui components. It uses Inter for UI text and JetBrains Mono for code/URLs, featuring a professional dashboard aesthetic with a blue primary accent and dark mode support.

### Technical Implementations
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, Recharts.
- **Backend**: Node.js + Express + TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Scheduling**: `node-cron` with CST timezone for automated jobs.
- **Data Ingestion**: Supports bulk CSV/XLSX imports for various SEO data.
- **Priority Classification**: Automatic keyword tiering (P1, P2, P3) based on intent and ranking.
- **Automated Crawls**: Scheduled crawls for keyword rankings (3x weekly), page metrics (4x weekly), and competitor analysis (2x weekly), including weekly backlink verification.
- **DataForSEO Dual-Method Strategy**: Uses Standard Method ($0.0006/task) for batch crawls (3.3x cost savings), Live Method ($0.002/task) for single keyword lookups.
- **Stale Crawl Recovery**: Server startup automatically cancels orphaned crawls that were running before a restart, preventing stuck crawl states from blocking new crawls.
- **Pages Health Scoring**: Calculates `techRiskScore`, `contentGapScore`, and `authorityGapScore` based on various SEO factors.
- **Cannibalization Detection**: Algorithm to identify keywords ranking for multiple pages within the same project, with a resolution workflow.
- **Email Scheduled Reports**: System for generating and emailing scheduled SEO reports with customizable content and recipients.
- **Google Search Console Integration**: OAuth2 flow, search analytics sync, and URL inspection capabilities.

### Feature Specifications
- **SEO Health Score**: Aggregated 0-100 score reflecting overall SEO performance.
- **Opportunity Scoring**: Identifies high-potential keywords.
- **Technical Risk Analysis**: Monitors indexability, schema, Core Web Vitals, and duplicate content.
- **Competitor Pressure Index**: Volume-weighted threat score measuring competitive intensity.
- **Actionable Recommendations**: Task-like items for SEO improvements with severity and status tracking.
- **Historical Trend Analysis**: Charts with linear regression forecasting and period comparison.
- **Advanced Keyword Filtering**: Comprehensive filtering by position, opportunity, SERP features, and clusters.
- **Operational Boards**:
    - **Quick Wins Board**: Identifies keywords for proactive growth (positions 6-20 with high opportunity).
    - **Falling Stars Board**: Alerts for significant ranking drops (≥5 positions).
- **Executive Narrative Generator**: AI-powered summaries of project performance.
- **Per-Project Settings**: Configurable thresholds for operational boards.
- **Page Analytics**: Aggregated keyword performance metrics per URL.
- **Cannibalization Detection**: Identifies and manages keyword cannibalization conflicts.
- **Scheduled Reports**: Automated email delivery of SEO performance reports.
- **Google Search Console Data**: Displays performance overview and URL inspection results.
- **Site Audit**: Technical SEO crawling and issue identification with crawl scope options (Tracked Pages Only vs Full Site Crawl), automatic progress polling, and auto-generation of recommendations from critical issues.
- **Link Building Tracker**: Manages backlinks, detects spam scores, identifies lost links, and performs competitor backlink gap analysis with opportunity scoring and promotion to recommendations.
- **Task Execution Logs**: System-wide logging for background tasks (crawls, syncs, reports) with filtering by category, level, and search. Provides diagnostic visibility into system operations with error tracking, execution summaries, and auto-refresh. Accessible via System > System Logs in sidebar.
- **Target URL Editing**: Ability to manually set or edit target URLs for keywords directly from the Keywords table or Data Management page. Pencil icon buttons open an edit dialog for updating keyword target URLs.
- **Version Control / Release Notes**: System for tracking app releases and publishing changelog entries. Supports version numbers, release types (feature, bugfix, improvement, breaking, security), and detailed release notes. Accessible via System > Version Control in sidebar.

### System Design Choices
- **Database Schema**: Comprehensive schema including `projects`, `keywords`, `locations`, `rankings_history`, `seo_health_snapshots`, `seo_recommendations`, `crawl_schedules`, `backlinks`, `tech_crawls`, `page_audits`, `page_issues`, `scheduled_reports`, `report_runs`, `gsc_credentials`, `gsc_query_stats`, `gsc_url_inspection`, `cannibalization_conflicts`, `task_execution_logs`, and `app_versions`.
- **Security**: File path validation, allowed import directories, and Zod schema-based input validation for all API endpoints.

## External Dependencies
- **DataForSEO**: For live SERP rankings, search volume, keyword difficulty, search intent, backlink data, and technical SEO audits (OnPage API).
- **PostgreSQL (Neon)**: Main relational database.
- **node-cron**: For scheduling background tasks.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: UI component library.
- **TanStack Query**: Data fetching and caching.
- **Recharts**: Charting library.
- **shadcn/ui**: Component library.
- **Resend API**: For sending scheduled email reports.
- **Google Search Console API**: For integrating GSC data.