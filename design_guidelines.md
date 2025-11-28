# Live SEO Command Center - Design Guidelines

## Design Approach: Data-First Dashboard System

**Selected Approach:** Enterprise Dashboard Pattern inspired by Linear, Vercel Analytics, and Carbon Design System  
**Rationale:** Data-heavy internal tool requiring clarity, efficiency, and professional credibility over visual storytelling

**Core Principles:**
1. Information density without clutter
2. Scannable metric hierarchies  
3. Clear actionable pathways
4. Consistent data presentation patterns

---

## Typography System

**Font Stack:**
- Primary: Inter (Google Fonts) - numbers, metrics, UI
- Secondary: JetBrains Mono - code, URLs, technical identifiers

**Type Scale:**
- Metric Display: text-4xl (36px) / font-bold - primary KPIs
- Section Headers: text-xl (20px) / font-semibold  
- Panel Titles: text-lg (18px) / font-medium
- Data Labels: text-sm (14px) / font-medium - table headers, chart labels
- Body/Data: text-sm (14px) / font-normal - table cells, descriptions
- Captions/Meta: text-xs (12px) / font-normal - timestamps, secondary info

---

## Layout System

**Spacing Primitives:** Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6, p-8
- Section spacing: gap-6, gap-8
- Metric spacing: space-y-1, space-y-2
- Card spacing: p-6 standard

**Grid Structure:**
- Dashboard: 12-column grid (grid-cols-12)
- Overview cards: 3-4 columns (lg:grid-cols-4)
- Data panels: 2-column split for detail views (lg:grid-cols-2)
- Single column on mobile (grid-cols-1)

**Container Strategy:**
- Full-width dashboard with sidebar: Main content max-w-none
- Nested panels: Contained width with overflow handling

---

## Component Architecture

### Dashboard Shell
- **Sidebar Navigation** (w-64, fixed left)
  - Logo/brand (h-16)
  - Navigation groups with icons (Heroicons)
  - Active state indicators
  - User profile at bottom

- **Top Bar** (h-16, fixed top)
  - Project selector dropdown
  - Date range picker
  - Real-time status indicator
  - Quick actions menu

- **Main Content Area** (ml-64, pt-16)
  - Page header with breadcrumbs
  - Action buttons right-aligned
  - Content grid below

### KPI Cards (Overview Dashboard)
- Grid: 4 columns desktop (grid-cols-4), 2 tablet, 1 mobile
- Structure per card (p-6, rounded-lg, border):
  - Label (text-sm, text-muted)
  - Primary metric (text-4xl, font-bold)
  - Trend indicator (inline, text-sm with arrow icon)
  - Sparkline chart (h-12, subtle)
- Status indicators: Small badge (top-right) for health status

### Data Tables
- **Header row:** sticky top-0, font-medium, text-sm
- **Cell padding:** px-4 py-3
- **Zebra striping:** alternate row treatment
- **Sortable columns:** Arrow icons, hover states
- **Row actions:** Visible on hover, right-aligned icons
- **Pagination:** Bottom bar with page numbers, items per page selector

### Chart Panels
- **Container:** p-6, rounded-lg, border
- **Header:** Panel title + filter chips + timeframe selector
- **Chart area:** h-80 for primary charts, h-64 for secondary
- **Legend:** Bottom or right placement with interactive toggles
- **Tooltip:** Floating card with detailed breakdown

### Recommendation Cards
- **List layout:** space-y-4
- **Card structure (p-4, rounded-lg, border-l-4):**
  - Severity color-coded left border
  - Row 1: Icon + Title (font-semibold) + Status badge
  - Row 2: Description (text-sm)
  - Row 3: Meta info (text-xs) + Action buttons
- **Severity hierarchy:** Visual weight via border, not background fills
- **Action buttons:** Secondary style (text + icon)

### Filter & Search Bar
- **Layout:** flex items-center gap-4, sticky top-16
- **Search input:** Magnifying glass icon left, clear icon right
- **Filter chips:** Inline, removable with × icon
- **Advanced filters:** Dropdown panel (absolute positioning)

### Page-Level Metrics Panel
- **Split layout:** Left = URL metadata, Right = metrics grid
- **Metrics grid:** 2-3 columns of labeled number pairs
- **Risk scores:** Progress bar visualization (h-2, rounded-full)
- **Quick links:** Icon buttons for external tools (open in new tab)

---

## Data Visualization Patterns (Recharts)

**Color Independence:** Use stroke weights, patterns, labels for differentiation  
**Chart Types:**
- Line charts: Trend over time (SEO health score, position tracking)
- Area charts: Stacked metrics (keyword distribution by position)
- Bar charts: Comparative analysis (competitor pressure index)
- Scatter plots: Opportunity matrix (volume vs. difficulty)

**Chart Standards:**
- Grid lines: Subtle, horizontal only
- Axes: Clear labels, appropriate scales
- Data points: Visible on hover
- Reference lines: For benchmarks/targets

---

## Interaction Patterns

**Navigation:**
- Sidebar active states: Subtle left border accent
- Breadcrumbs: text-sm with / separators
- Tabs: Underline style, inline with content

**Loading States:**
- Skeleton screens for data tables (animate-pulse)
- Spinner for async actions
- Shimmer effect for chart loading

**Empty States:**
- Centered icon + text (text-center, py-12)
- Primary action button below message

**Modals/Dialogs (Radix):**
- Overlay: Semi-transparent backdrop
- Content: Centered, max-w-2xl, p-6
- Header: Close × top-right

---

## Accessibility Standards

- Focus rings: Visible on all interactive elements
- ARIA labels: All icon-only buttons
- Keyboard navigation: Tab order follows visual hierarchy
- Color contrast: WCAG AA minimum for all text
- Screen reader: Announce data updates and state changes

---

## Icons

**Library:** Heroicons (outline for navigation, solid for status indicators)  
**Usage:**
- Navigation: 20×20 (w-5 h-5)
- Inline indicators: 16×16 (w-4 h-4)  
- Action buttons: 20×20 (w-5 h-5)
- Data table icons: 16×16 (w-4 h-4)

---

## Responsive Strategy

**Breakpoints:**
- Mobile (<768px): Single column, collapsible sidebar, stacked metrics
- Tablet (768-1024px): 2-column grids, persistent sidebar
- Desktop (>1024px): Full multi-column layouts

**Mobile Adjustments:**
- Hide sidebar behind hamburger menu
- Stack KPI cards (grid-cols-1)
- Horizontal scroll for wide tables
- Simplified chart displays

---

This design system prioritizes **data clarity, professional credibility, and workflow efficiency** appropriate for an internal enterprise SEO tool. No hero images needed—this is a dashboard that opens directly to actionable data.