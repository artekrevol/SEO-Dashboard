# Live SEO Command Center

## Overview
A production-ready Live SEO Dashboard for TekRevol, built as an internal SEO Command Center. The application provides comprehensive SEO analytics, keyword tracking, competitor analysis, and actionable recommendations.

## Current State
- **Status**: MVP Complete
- **Last Updated**: November 28, 2025

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, Recharts
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **UI Components**: shadcn/ui component library

## Project Architecture

### Database Schema
- `projects` - SEO projects/domains being tracked
- `keywords` - Keywords tracked for each project
- `seo_health_snapshots` - Daily SEO health aggregates per project
- `keyword_metrics` - Per-keyword metrics over time (position, volume, difficulty, intent, opportunity score)
- `page_metrics` - Per-URL metrics (backlinks, technical health, content gaps)
- `seo_recommendations` - Actionable SEO tasks with severity and status
- `competitor_metrics` - Competitor analysis with pressure index

### API Endpoints
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project (seeds demo data)
- `GET /api/dashboard/overview` - Executive dashboard overview
- `GET /api/dashboard/keywords` - Keyword performance data
- `GET /api/dashboard/pages` - Page analytics
- `GET /api/dashboard/recommendations` - SEO recommendations
- `PATCH /api/dashboard/recommendations/:id` - Update recommendation status
- `GET /api/dashboard/competitors` - Competitor analysis

### Frontend Pages
- `/` - Main dashboard with KPI cards, health chart, top opportunities
- `/keywords` - Keyword analytics with position distribution and intent charts
- `/pages` - Page-level metrics with risk analysis
- `/recommendations` - Actionable SEO tasks with filtering
- `/competitors` - Competitive pressure analysis with visualization

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

## Design System
- **Fonts**: Inter (UI), JetBrains Mono (code/URLs)
- **Color Scheme**: Professional dashboard with blue primary accent
- **Dark Mode**: Supported via theme toggle
- **Components**: shadcn/ui with custom elevation system

## Future Enhancements (Next Phase)
- DataForSEO API integration for live data
- Weekly opportunity/gap analysis cron job
- Authority and technical risk monitoring
- Custom report generation
