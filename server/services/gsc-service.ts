import { storage } from "../storage";
import type { GscCredentials, GscQueryStats, GscUrlInspection } from "@shared/schema";

const GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GscTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface GscSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
}

interface GscUrlInspectionResult {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string;
      coverageState?: string;
      robotsTxtState?: string;
      indexingState?: string;
      lastCrawlTime?: string;
      pageFetchState?: string;
      googleCanonical?: string;
      userCanonical?: string;
      sitemap?: string[];
      referringUrls?: string[];
      crawledAs?: string;
    };
    mobileUsabilityResult?: {
      verdict?: string;
      issues?: Array<{ issueType: string; severity: string; message: string }>;
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: Array<{ richResultType: string; items: unknown[] }>;
    };
  };
}

interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

// List all sites the authenticated user has access to in GSC
export async function listAvailableSites(projectId: string): Promise<{
  sites: GscSiteEntry[];
  error?: string;
}> {
  const accessToken = await getValidAccessToken(projectId);
  if (!accessToken) {
    return { sites: [], error: "No valid access token" };
  }

  try {
    const response = await fetch(`${GSC_API_BASE}/sites`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GSC] Sites list API error:", response.status, errorText);
      return { sites: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    console.log("[GSC] Available sites:", JSON.stringify(data, null, 2));
    
    const sites: GscSiteEntry[] = (data.siteEntry || []).map((entry: { siteUrl: string; permissionLevel: string }) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
    }));
    
    return { sites };
  } catch (error) {
    console.error("[GSC] Error listing sites:", error);
    return { sites: [], error: String(error) };
  }
}

async function refreshAccessToken(credentials: GscCredentials): Promise<string | null> {
  if (!credentials.refreshToken) {
    console.error("[GSC] No refresh token available");
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[GSC] Missing Google OAuth credentials");
    return null;
  }

  try {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[GSC] Failed to refresh token:", errorData);
      return null;
    }

    const data: GscTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await storage.updateGscCredentials(credentials.projectId, {
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
    });

    console.log("[GSC] Token refreshed successfully");
    return data.access_token;
  } catch (error) {
    console.error("[GSC] Error refreshing token:", error);
    return null;
  }
}

async function getValidAccessToken(projectId: string): Promise<string | null> {
  const credentials = await storage.getGscCredentials(projectId);
  if (!credentials) {
    console.error("[GSC] No credentials found for project:", projectId);
    return null;
  }

  if (!credentials.isConnected) {
    console.log("[GSC] GSC integration is disabled for project:", projectId);
    return null;
  }

  const now = new Date();
  const expiresAt = credentials.tokenExpiresAt;
  
  if (expiresAt && expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return credentials.accessToken;
  }

  return refreshAccessToken(credentials);
}

interface FetchSearchAnalyticsResult {
  rows: GscSearchAnalyticsRow[];
  error?: string;
}

export async function fetchSearchAnalytics(
  projectId: string,
  options: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
    startRow?: number;
  }
): Promise<FetchSearchAnalyticsResult> {
  const credentials = await storage.getGscCredentials(projectId);
  if (!credentials?.siteUrl) {
    console.error("[GSC] No site URL configured for project:", projectId);
    return { rows: [], error: "No site URL configured" };
  }

  const accessToken = await getValidAccessToken(projectId);
  if (!accessToken) {
    return { rows: [], error: "No valid access token - please re-authorize GSC" };
  }

  try {
    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(credentials.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: options.startDate,
          endDate: options.endDate,
          dimensions: options.dimensions || ["query", "page", "date"],
          rowLimit: options.rowLimit || 1000,
          startRow: options.startRow || 0,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GSC] Search Analytics API error:", response.status, errorText);
      
      // Parse error message if possible
      try {
        const errorJson = JSON.parse(errorText);
        const message = errorJson.error?.message || `API error: ${response.status}`;
        
        // Store the error message
        await storage.updateGscCredentials(projectId, { syncErrorMessage: message });
        
        return { rows: [], error: message };
      } catch {
        const error = `API error: ${response.status}`;
        await storage.updateGscCredentials(projectId, { syncErrorMessage: error });
        return { rows: [], error };
      }
    }

    // Clear any previous error on success
    await storage.updateGscCredentials(projectId, { syncErrorMessage: null });

    const data: GscSearchAnalyticsResponse = await response.json();
    console.log(`[GSC] API returned ${data.rows?.length || 0} rows`);
    return { rows: data.rows || [] };
  } catch (error) {
    console.error("[GSC] Error fetching search analytics:", error);
    const errorMessage = `Connection error: ${error}`;
    await storage.updateGscCredentials(projectId, { syncErrorMessage: errorMessage });
    return { rows: [], error: errorMessage };
  }
}

export async function inspectUrl(
  projectId: string,
  url: string
): Promise<GscUrlInspectionResult | null> {
  const credentials = await storage.getGscCredentials(projectId);
  if (!credentials?.siteUrl) {
    console.error("[GSC] No site URL configured for project:", projectId);
    return null;
  }

  const accessToken = await getValidAccessToken(projectId);
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspectionUrl: url,
          siteUrl: credentials.siteUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[GSC] URL Inspection API error:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[GSC] Error inspecting URL:", error);
    return null;
  }
}

export async function syncSearchAnalytics(
  projectId: string,
  daysBack: number = 28
): Promise<{ synced: number; errors: number; apiError?: string }> {
  console.log(`[GSC] Starting search analytics sync for project ${projectId}`);

  // GSC data has a 2-3 day delay, so end date should be 3 days ago
  const today = new Date();
  const endDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  console.log(`[GSC] Fetching data from ${formatDate(startDate)} to ${formatDate(endDate)}`);

  const result = await fetchSearchAnalytics(projectId, {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ["query", "page", "date"],
    rowLimit: 5000,
  });

  console.log(`[GSC] Received ${result.rows.length} rows from API`);

  if (result.error) {
    console.log(`[GSC] API error: ${result.error}`);
    return { synced: 0, errors: 0, apiError: result.error };
  }

  if (result.rows.length === 0) {
    console.log("[GSC] No data to sync - this could mean the site has no GSC data for this period");
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const row of result.rows) {
    const [query, page, date] = row.keys;
    try {
      await storage.upsertGscQueryStats({
        projectId,
        query,
        page,
        date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: String(row.ctr),
        position: String(row.position),
      });
      synced++;
    } catch (error) {
      console.error("[GSC] Error upserting query stats:", error);
      errors++;
    }
  }

  console.log(`[GSC] Sync completed: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

export async function inspectAndSaveUrl(
  projectId: string,
  url: string
): Promise<GscUrlInspection | null> {
  const result = await inspectUrl(projectId, url);
  if (!result?.inspectionResult?.indexStatusResult) {
    return null;
  }

  const status = result.inspectionResult.indexStatusResult;
  const mobileResult = result.inspectionResult.mobileUsabilityResult;
  const richResult = result.inspectionResult.richResultsResult;

  try {
    return await storage.upsertGscUrlInspection({
      projectId,
      url,
      indexingStatus: status.indexingState || "UNKNOWN",
      coverageState: status.coverageState || "UNKNOWN",
      indexingState: status.indexingState || null,
      lastCrawlTime: status.lastCrawlTime ? new Date(status.lastCrawlTime) : null,
      pageFetchState: status.pageFetchState || null,
      robotsTxtState: status.robotsTxtState || null,
      googleCanonical: status.googleCanonical || null,
      userCanonical: status.userCanonical || null,
      mobileUsability: mobileResult?.verdict || null,
      richResultsStatus: richResult?.verdict || null,
      lastInspectedAt: new Date(),
    });
  } catch (error) {
    console.error("[GSC] Error saving URL inspection result:", error);
    return null;
  }
}

export async function getGscSummary(projectId: string, daysBack: number = 28): Promise<{
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; position: number }>;
}> {
  // GSC data has 2-3 day delay, so adjust dates accordingly
  const today = new Date();
  const endDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const stats = await storage.getGscQueryStats(projectId, {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  });

  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPosition = 0;
  const queryMap = new Map<string, { clicks: number; impressions: number; position: number; count: number }>();
  const pageMap = new Map<string, { clicks: number; impressions: number; position: number; count: number }>();

  for (const stat of stats) {
    totalClicks += stat.clicks || 0;
    totalImpressions += stat.impressions || 0;
    weightedPosition += (stat.impressions || 0) * Number(stat.position || 0);

    const queryEntry = queryMap.get(stat.query) || { clicks: 0, impressions: 0, position: 0, count: 0 };
    queryEntry.clicks += stat.clicks || 0;
    queryEntry.impressions += stat.impressions || 0;
    queryEntry.position += Number(stat.position || 0);
    queryEntry.count++;
    queryMap.set(stat.query, queryEntry);

    if (stat.page) {
      const pageEntry = pageMap.get(stat.page) || { clicks: 0, impressions: 0, position: 0, count: 0 };
      pageEntry.clicks += stat.clicks || 0;
      pageEntry.impressions += stat.impressions || 0;
      pageEntry.position += Number(stat.position || 0);
      pageEntry.count++;
      pageMap.set(stat.page, pageEntry);
    }
  }

  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      position: data.count > 0 ? data.position / data.count : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const topPages = Array.from(pageMap.entries())
    .map(([page, data]) => ({
      page,
      clicks: data.clicks,
      impressions: data.impressions,
      position: data.count > 0 ? data.position / data.count : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return {
    totalClicks,
    totalImpressions,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgPosition: totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
    topQueries,
    topPages,
  };
}

export function getGscAuthUrl(redirectUri: string, state: string): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[GSC] Missing GOOGLE_CLIENT_ID environment variable");
    return null;
  }

  const scopes = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/webmasters",
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGscAuthCallback(
  code: string,
  redirectUri: string,
  projectId: string,
  siteUrl: string
): Promise<GscCredentials | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[GSC] Missing Google OAuth credentials");
    return null;
  }

  try {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[GSC] Token exchange failed:", errorData);
      return null;
    }

    const data: GscTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    const existing = await storage.getGscCredentials(projectId);
    if (existing) {
      const updated = await storage.updateGscCredentials(projectId, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || existing.refreshToken,
        tokenExpiresAt: expiresAt,
        siteUrl,
        isConnected: true,
      });
      return updated || null;
    }

    return await storage.createGscCredentials({
      projectId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      tokenExpiresAt: expiresAt,
      siteUrl,
      isConnected: true,
    });
  } catch (error) {
    console.error("[GSC] Error exchanging auth code:", error);
    return null;
  }
}
