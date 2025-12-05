import { storage } from "../storage";
import type { ScheduledReport, ReportRun } from "@shared/schema";
import { generateReportData, formatReportAsHtml, formatReportAsText } from "./report-generator";

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log("[Email] RESEND_API_KEY not configured - logging email instead");
    console.log("[Email] Would send to:", options.to.join(", "));
    console.log("[Email] Subject:", options.subject);
    console.log("[Email] Preview:", options.text?.substring(0, 200) || "HTML only");
    return { 
      success: true, 
      messageId: `mock-${Date.now()}`,
      error: "Email not sent - RESEND_API_KEY not configured" 
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SEO Command Center <noreply@seocmd.com>",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Email] Resend API error:", errorData);
      return { success: false, error: errorData.message || "Failed to send email" };
    }

    const data = await response.json();
    console.log("[Email] Sent successfully:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function calculateNextScheduledTime(report: ScheduledReport): Date {
  const now = new Date();
  const [hours, minutes] = (report.timeOfDay || "09:00").split(":").map(Number);
  
  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  switch (report.frequency) {
    case "daily":
      break;
    case "weekly":
      const targetDay = report.dayOfWeek ?? 1;
      while (nextRun.getDay() !== targetDay || nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case "biweekly":
      const biweeklyDay = report.dayOfWeek ?? 1;
      while (nextRun.getDay() !== biweeklyDay || nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case "monthly":
      nextRun.setDate(report.dayOfMonth || 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }

  return nextRun;
}

export async function executeScheduledReport(reportId: number): Promise<ReportRun | null> {
  const report = await storage.getScheduledReport(reportId);
  if (!report) {
    console.error(`[Report] Scheduled report ${reportId} not found`);
    return null;
  }

  console.log(`[Report] Executing scheduled report: ${report.name}`);

  const run = await storage.createReportRun({
    scheduledReportId: report.id,
    projectId: report.projectId,
    reportType: report.reportType,
    status: "generating",
    triggerType: "scheduled",
    recipients: report.recipients,
  });

  try {
    await storage.updateReportRun(run.id, { status: "generating" });

    const reportData = await generateReportData(report.projectId, report.reportType, {
      includeExecutiveSummary: report.includeExecutiveSummary ?? true,
      includeTrends: report.includeTrends ?? true,
      includeRecommendations: report.includeRecommendations ?? true,
      includeCompetitors: report.includeCompetitors ?? false,
      daysBack: report.frequency === "monthly" ? 30 : report.frequency === "biweekly" ? 14 : 7,
    });

    if (!reportData) {
      await storage.updateReportRun(run.id, { 
        status: "failed", 
        errorMessage: "Failed to generate report data",
        completedAt: new Date(),
      });
      return run;
    }

    await storage.updateReportRun(run.id, { 
      status: "sending",
      reportData: reportData as unknown as Record<string, unknown>,
    });

    const html = formatReportAsHtml(reportData);
    const text = formatReportAsText(reportData);

    const project = await storage.getProject(report.projectId);
    const subject = `${report.name} - ${project?.name || "SEO Report"}`;

    const emailResult = await sendEmail({
      to: report.recipients as string[],
      subject,
      html,
      text,
    });

    if (emailResult.success) {
      await storage.updateReportRun(run.id, {
        status: "completed",
        emailsSent: report.recipients.length,
        completedAt: new Date(),
      });

      const nextScheduled = calculateNextScheduledTime(report);
      await storage.updateScheduledReport(report.id, {
        lastSentAt: new Date(),
        nextScheduledAt: nextScheduled,
      });

      console.log(`[Report] Successfully sent report to ${report.recipients.length} recipients`);
    } else {
      await storage.updateReportRun(run.id, {
        status: "failed",
        errorMessage: emailResult.error,
        completedAt: new Date(),
      });
    }

    return await storage.getReportRun(run.id) || run;
  } catch (error) {
    console.error("[Report] Error executing report:", error);
    await storage.updateReportRun(run.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
    });
    return run;
  }
}

export async function executeManualReport(
  projectId: string,
  reportType: string,
  recipients: string[],
  options: {
    includeExecutiveSummary?: boolean;
    includeTrends?: boolean;
    includeRecommendations?: boolean;
    includeCompetitors?: boolean;
  } = {}
): Promise<ReportRun> {
  console.log(`[Report] Generating manual report for project ${projectId}`);

  const run = await storage.createReportRun({
    projectId,
    reportType,
    status: "generating",
    triggerType: "manual",
    recipients,
  });

  try {
    const reportData = await generateReportData(projectId, reportType, options);

    if (!reportData) {
      await storage.updateReportRun(run.id, { 
        status: "failed", 
        errorMessage: "Failed to generate report data",
        completedAt: new Date(),
      });
      return run;
    }

    await storage.updateReportRun(run.id, { 
      status: "sending",
      reportData: reportData as unknown as Record<string, unknown>,
    });

    const html = formatReportAsHtml(reportData);
    const text = formatReportAsText(reportData);

    const project = await storage.getProject(projectId);
    const reportTypeName = reportType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const subject = `${reportTypeName} - ${project?.name || "SEO Report"}`;

    const emailResult = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
    });

    if (emailResult.success) {
      await storage.updateReportRun(run.id, {
        status: "completed",
        emailsSent: recipients.length,
        completedAt: new Date(),
      });
      console.log(`[Report] Successfully sent manual report to ${recipients.length} recipients`);
    } else {
      await storage.updateReportRun(run.id, {
        status: "failed",
        errorMessage: emailResult.error,
        completedAt: new Date(),
      });
    }

    return await storage.getReportRun(run.id) || run;
  } catch (error) {
    console.error("[Report] Error executing manual report:", error);
    await storage.updateReportRun(run.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date(),
    });
    return run;
  }
}

export async function checkAndExecuteDueReports(): Promise<void> {
  const dueReports = await storage.getDueScheduledReports();
  
  if (dueReports.length === 0) {
    return;
  }

  console.log(`[Report] Found ${dueReports.length} due reports to execute`);
  
  for (const report of dueReports) {
    try {
      await executeScheduledReport(report.id);
    } catch (error) {
      console.error(`[Report] Error executing report ${report.id}:`, error);
    }
  }
}
