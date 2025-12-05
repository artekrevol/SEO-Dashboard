import { storage } from "../storage";
import type { ScheduledReport, Project } from "@shared/schema";

export interface ReportData {
  projectName: string;
  projectDomain: string;
  generatedAt: Date;
  reportType: string;
  dateRange: { from: Date; to: Date };
  executiveSummary?: {
    seoHealthScore: number;
    scoreChange: number;
    top3Keywords: number;
    top10Keywords: number;
    totalKeywords: number;
    avgPosition: number;
    positionChange: number;
  };
  keywordHighlights?: {
    topGainers: Array<{ keyword: string; change: number; newPosition: number }>;
    topLosers: Array<{ keyword: string; change: number; newPosition: number }>;
    newRankings: Array<{ keyword: string; position: number }>;
    lostRankings: Array<{ keyword: string; lastPosition: number }>;
  };
  recommendations?: Array<{
    title: string;
    severity: string;
    type: string;
    status: string;
  }>;
  competitorAnalysis?: Array<{
    domain: string;
    sharedKeywords: number;
    aboveUs: number;
    pressureIndex: number;
  }>;
  technicalHealth?: {
    avgOnpageScore: number;
    indexablePages: number;
    criticalIssues: number;
    warningIssues: number;
  };
  trends?: Array<{
    date: string;
    seoHealthScore: number;
    avgPosition: number;
    top10Keywords: number;
  }>;
}

export async function generateReportData(
  projectId: string,
  reportType: string,
  options: {
    includeExecutiveSummary?: boolean;
    includeTrends?: boolean;
    includeRecommendations?: boolean;
    includeCompetitors?: boolean;
    daysBack?: number;
  } = {}
): Promise<ReportData | null> {
  const project = await storage.getProject(projectId);
  if (!project) return null;

  const daysBack = options.daysBack || (reportType === "monthly_report" ? 30 : 7);
  const now = new Date();
  const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const reportData: ReportData = {
    projectName: project.name,
    projectDomain: project.domain,
    generatedAt: now,
    reportType,
    dateRange: { from: fromDate, to: now },
  };

  if (options.includeExecutiveSummary !== false) {
    const latestSnapshot = await storage.getLatestSeoHealthSnapshot(projectId);
    const snapshots = await storage.getSeoHealthSnapshots(projectId, daysBack);
    const oldSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 1] : null;

    reportData.executiveSummary = {
      seoHealthScore: Number(latestSnapshot?.seoHealthScore || 0),
      scoreChange: oldSnapshot 
        ? Number(latestSnapshot?.seoHealthScore || 0) - Number(oldSnapshot.seoHealthScore)
        : 0,
      top3Keywords: latestSnapshot?.top3Keywords || 0,
      top10Keywords: latestSnapshot?.top10Keywords || 0,
      totalKeywords: latestSnapshot?.totalKeywords || 0,
      avgPosition: Number(latestSnapshot?.avgPosition || 0),
      positionChange: oldSnapshot
        ? Number(oldSnapshot.avgPosition) - Number(latestSnapshot?.avgPosition || 0)
        : 0,
    };
  }

  if (options.includeRecommendations !== false) {
    const recommendations = await storage.getSeoRecommendations(projectId, { status: "open" });
    reportData.recommendations = recommendations.slice(0, 10).map((r) => ({
      title: r.title,
      severity: r.severity,
      type: r.type,
      status: r.status,
    }));
  }

  if (options.includeCompetitors !== false) {
    const competitors = await storage.getCompetitorMetrics(projectId);
    const uniqueCompetitors = new Map<string, typeof competitors[0]>();
    competitors.forEach((c) => {
      if (!uniqueCompetitors.has(c.competitorDomain)) {
        uniqueCompetitors.set(c.competitorDomain, c);
      }
    });

    reportData.competitorAnalysis = Array.from(uniqueCompetitors.values())
      .slice(0, 5)
      .map((c) => ({
        domain: c.competitorDomain,
        sharedKeywords: c.sharedKeywords || 0,
        aboveUs: c.aboveUsKeywords || 0,
        pressureIndex: Number(c.pressureIndex || 0),
      }));
  }

  if (options.includeTrends !== false) {
    const snapshots = await storage.getSeoHealthSnapshots(projectId, daysBack);
    reportData.trends = snapshots.map((s) => ({
      date: s.date,
      seoHealthScore: Number(s.seoHealthScore || 0),
      avgPosition: Number(s.avgPosition || 0),
      top10Keywords: s.top10Keywords || 0,
    }));
  }

  return reportData;
}

export function formatReportAsHtml(data: ReportData): string {
  const formatDate = (date: Date) => 
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "#dc2626";
      case "medium": return "#f59e0b";
      default: return "#3b82f6";
    }
  };

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { color: white; border: none; margin: 0; }
    .header p { margin: 5px 0; opacity: 0.9; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .metric-card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
    .metric-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .metric-change { font-size: 14px; margin-top: 5px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .table th { background: #f9fafb; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.projectName} SEO Report</h1>
    <p>${data.projectDomain}</p>
    <p>${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}</p>
  </div>`;

  if (data.executiveSummary) {
    const s = data.executiveSummary;
    html += `
  <h2>Executive Summary</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-value">${s.seoHealthScore.toFixed(0)}</div>
      <div class="metric-label">SEO Health Score</div>
      <div class="metric-change ${s.scoreChange >= 0 ? 'positive' : 'negative'}">
        ${s.scoreChange >= 0 ? '+' : ''}${s.scoreChange.toFixed(1)} pts
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.avgPosition.toFixed(1)}</div>
      <div class="metric-label">Avg Position</div>
      <div class="metric-change ${s.positionChange >= 0 ? 'positive' : 'negative'}">
        ${s.positionChange >= 0 ? '+' : ''}${s.positionChange.toFixed(1)} pos
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.top3Keywords}</div>
      <div class="metric-label">Top 3 Keywords</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.top10Keywords}</div>
      <div class="metric-label">Top 10 Keywords</div>
    </div>
  </div>`;
  }

  if (data.recommendations && data.recommendations.length > 0) {
    html += `
  <h2>Open Recommendations</h2>
  <table class="table">
    <tr>
      <th>Recommendation</th>
      <th>Type</th>
      <th>Severity</th>
    </tr>`;
    for (const rec of data.recommendations) {
      html += `
    <tr>
      <td>${rec.title}</td>
      <td>${rec.type.replace(/_/g, ' ')}</td>
      <td><span class="badge" style="background: ${getSeverityColor(rec.severity)}20; color: ${getSeverityColor(rec.severity)}">${rec.severity}</span></td>
    </tr>`;
    }
    html += `</table>`;
  }

  if (data.competitorAnalysis && data.competitorAnalysis.length > 0) {
    html += `
  <h2>Competitor Analysis</h2>
  <table class="table">
    <tr>
      <th>Competitor</th>
      <th>Shared Keywords</th>
      <th>Outranking Us</th>
      <th>Pressure Index</th>
    </tr>`;
    for (const comp of data.competitorAnalysis) {
      html += `
    <tr>
      <td>${comp.domain}</td>
      <td>${comp.sharedKeywords}</td>
      <td>${comp.aboveUs}</td>
      <td>${comp.pressureIndex.toFixed(1)}</td>
    </tr>`;
    }
    html += `</table>`;
  }

  html += `
  <div class="footer">
    <p>Generated by SEO Command Center on ${formatDate(data.generatedAt)}</p>
    <p>This is an automated report. Please do not reply to this email.</p>
  </div>
</body>
</html>`;

  return html;
}

export function formatReportAsText(data: ReportData): string {
  const formatDate = (date: Date) => 
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  let text = `
${data.projectName} SEO Report
${"=".repeat(data.projectName.length + 11)}

Domain: ${data.projectDomain}
Period: ${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}
`;

  if (data.executiveSummary) {
    const s = data.executiveSummary;
    text += `

EXECUTIVE SUMMARY
-----------------
SEO Health Score: ${s.seoHealthScore.toFixed(0)} (${s.scoreChange >= 0 ? '+' : ''}${s.scoreChange.toFixed(1)})
Average Position: ${s.avgPosition.toFixed(1)} (${s.positionChange >= 0 ? '+' : ''}${s.positionChange.toFixed(1)})
Top 3 Keywords: ${s.top3Keywords}
Top 10 Keywords: ${s.top10Keywords}
Total Keywords: ${s.totalKeywords}
`;
  }

  if (data.recommendations && data.recommendations.length > 0) {
    text += `

OPEN RECOMMENDATIONS
--------------------
`;
    data.recommendations.forEach((rec, i) => {
      text += `${i + 1}. [${rec.severity.toUpperCase()}] ${rec.title}\n`;
    });
  }

  if (data.competitorAnalysis && data.competitorAnalysis.length > 0) {
    text += `

COMPETITOR ANALYSIS
-------------------
`;
    data.competitorAnalysis.forEach((comp) => {
      text += `${comp.domain}: ${comp.sharedKeywords} shared keywords, ${comp.aboveUs} outranking us\n`;
    });
  }

  text += `

---
Generated by SEO Command Center on ${formatDate(data.generatedAt)}
`;

  return text;
}
