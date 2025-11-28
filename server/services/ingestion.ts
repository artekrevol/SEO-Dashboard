import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db';
import { 
  locations, 
  keywords, 
  projects, 
  rankingsHistory,
  settingsPriorityRules,
  importLogs,
  type InsertLocation,
  type InsertKeyword,
  type InsertRankingsHistory,
  type InsertSettingsPriorityRules,
  type SettingsPriorityRules
} from '@shared/schema';
import { eq, and, sql, asc } from 'drizzle-orm';

const ALLOWED_IMPORT_DIRS = [
  path.resolve(process.cwd(), 'attached_assets'),
  path.resolve(process.cwd(), 'imports'),
  path.resolve(process.cwd(), 'data'),
];

function isPathContained(allowedDir: string, targetPath: string): boolean {
  const relative = path.relative(allowedDir, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateFilePath(filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  const realPath = fs.existsSync(resolvedPath) ? fs.realpathSync(resolvedPath) : resolvedPath;
  
  const isAllowed = ALLOWED_IMPORT_DIRS.some(dir => {
    const realDir = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
    return isPathContained(realDir, realPath);
  });
  
  if (!isAllowed) {
    throw new Error(`File path not allowed. Files must be within: ${ALLOWED_IMPORT_DIRS.map(d => path.basename(d)).join(', ')}`);
  }
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }
  
  return resolvedPath;
}

interface LocationRow {
  location_id: string;
  location_name: string;
  dataforseo_location_code: number | string;
  language_code: string;
}

interface KeywordRow {
  keyword_id: string;
  keyword: string;
  Country: string;
  difficulty: number | string;
  search_volume: number | string;
  intent: string;
  project_id: string | number;
  loc_id: string;
}

interface RankingRow {
  keyword: string;
  date: string;
  position: number | string;
  url?: string;
  device?: string;
  location?: string;
}

function parseIntent(intentString: string): string {
  if (!intentString) return 'mixed';
  
  const intents = intentString.toLowerCase().split(',').map(i => i.trim());
  
  if (intents.includes('transactional')) return 'transactional';
  if (intents.includes('commercial')) return 'commercial';
  if (intents.includes('informational')) return 'informational';
  if (intents.includes('navigational')) return 'navigational';
  
  return 'mixed';
}

function computeCluster(intent: string, locationName: string): string {
  const intentLabel = intent.charAt(0).toUpperCase() + intent.slice(1);
  return `${intentLabel} · ${locationName}`;
}

async function getPriorityRulesFromDb(): Promise<SettingsPriorityRules[]> {
  return await db.select().from(settingsPriorityRules).orderBy(asc(settingsPriorityRules.priority));
}

function computePriorityWithRules(
  intent: string, 
  position: number | null, 
  rules: SettingsPriorityRules[]
): string {
  if (rules.length === 0) {
    const commercialIntents = ['commercial', 'transactional'];
    if (commercialIntents.includes(intent) && position !== null && position <= 10) {
      return 'P1';
    }
    if (position !== null && position <= 20 && ['commercial', 'transactional', 'informational', 'mixed'].includes(intent)) {
      return 'P2';
    }
    return 'P3';
  }

  for (const rule of rules) {
    if (!rule.isActive) continue;
    
    const intentMatches = rule.intents.length === 0 || rule.intents.includes(intent);
    
    const positionMatches = 
      rule.maxPosition === null || 
      position === null ||
      position <= rule.maxPosition;
    
    if (intentMatches && positionMatches) {
      return rule.priority;
    }
  }
  
  return 'P3';
}

function isCorePage(targetUrl: string | null): boolean {
  if (!targetUrl) return false;
  
  const corePatterns = [
    '/services/',
    '/solutions/',
    '/products/',
    '/pricing',
    '/about',
    '/contact',
  ];
  
  return corePatterns.some(pattern => targetUrl.includes(pattern));
}

export async function importLocations(filePath: string): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  
  try {
    const validatedPath = validateFilePath(filePath);
    const content = fs.readFileSync(validatedPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        const row: LocationRow = {
          location_id: values[headers.indexOf('location_id')],
          location_name: values[headers.indexOf('location_name')],
          dataforseo_location_code: values[headers.indexOf('dataforseo_location_code')],
          language_code: values[headers.indexOf('language_code')],
        };
        
        if (!row.location_id || !row.location_name) continue;
        
        const existing = await db.select().from(locations).where(eq(locations.id, row.location_id));
        
        const locationData: InsertLocation = {
          id: row.location_id,
          name: row.location_name,
          dataforseoLocationCode: parseInt(String(row.dataforseo_location_code)),
          languageCode: row.language_code,
          isActive: true,
        };
        
        if (existing.length > 0) {
          await db.update(locations)
            .set({ 
              name: locationData.name,
              dataforseoLocationCode: locationData.dataforseoLocationCode,
              languageCode: locationData.languageCode,
              updatedAt: new Date(),
            })
            .where(eq(locations.id, row.location_id));
          updated++;
        } else {
          await db.insert(locations).values(locationData);
          inserted++;
        }
      } catch (err) {
        errors.push(`Row ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Ingestion] Locations: ${inserted} inserted, ${updated} updated`);
  } catch (err) {
    errors.push(`File error: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  return { inserted, updated, errors };
}

export async function importKeywords(filePath: string, projectId: string): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  
  try {
    const validatedPath = validateFilePath(filePath);
    const content = fs.readFileSync(validatedPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const allLocations = await db.select().from(locations);
    const locationMap = new Map(allLocations.map(l => [l.id, l]));
    
    const priorityRules = await getPriorityRulesFromDb();
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        const row: KeywordRow = {
          keyword_id: values[headers.indexOf('keyword_id')],
          keyword: values[headers.indexOf('keyword')],
          Country: values[headers.indexOf('Country')],
          difficulty: values[headers.indexOf('difficulty')],
          search_volume: values[headers.indexOf('search_volume')],
          intent: values[headers.indexOf('intent')],
          project_id: values[headers.indexOf('project_id')],
          loc_id: values[headers.indexOf('loc_id')],
        };
        
        if (!row.keyword) continue;
        
        const location = locationMap.get(row.loc_id);
        const intentHint = parseIntent(row.intent);
        const cluster = computeCluster(intentHint, location?.name || row.Country);
        const difficulty = parseFloat(String(row.difficulty)) || null;
        const searchVolume = parseInt(String(row.search_volume)) || null;
        const priority = computePriorityWithRules(intentHint, null, priorityRules);
        
        const existing = await db.select().from(keywords)
          .where(and(
            eq(keywords.projectId, projectId),
            eq(keywords.keyword, row.keyword),
            eq(keywords.locationId, row.loc_id)
          ));
        
        const keywordData: InsertKeyword = {
          projectId,
          keyword: row.keyword,
          locationId: row.loc_id,
          languageCode: location?.languageCode || 'en-US',
          intentHint,
          cluster,
          trackDaily: true,
          priority,
          isCorePage: false,
          isActive: true,
          difficulty: difficulty ? String(difficulty) : null,
          searchVolume,
        };
        
        if (existing.length > 0) {
          await db.update(keywords)
            .set({ 
              intentHint,
              cluster,
              difficulty: difficulty ? String(difficulty) : null,
              searchVolume,
              priority,
              updatedAt: new Date(),
            })
            .where(eq(keywords.id, existing[0].id));
          updated++;
        } else {
          await db.insert(keywords).values(keywordData);
          inserted++;
        }
      } catch (err) {
        errors.push(`Row ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Ingestion] Keywords: ${inserted} inserted, ${updated} updated`);
  } catch (err) {
    errors.push(`File error: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  return { inserted, updated, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export async function importRankingsFromXlsx(filePath: string): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  
  try {
    const validatedPath = validateFilePath(filePath);
    const workbook = XLSX.readFile(validatedPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as RankingRow[];
    
    const allKeywords = await db.select().from(keywords);
    const keywordMap = new Map(allKeywords.map(k => [k.keyword.toLowerCase(), k]));
    
    for (const row of data) {
      try {
        if (!row.keyword || !row.date) continue;
        
        const keyword = keywordMap.get(row.keyword.toLowerCase());
        if (!keyword) {
          errors.push(`Keyword not found: ${row.keyword}`);
          continue;
        }
        
        const rankingData: InsertRankingsHistory = {
          keywordId: keyword.id,
          date: row.date,
          position: parseInt(String(row.position)) || null,
          url: row.url || null,
          device: row.device || 'desktop',
          locationId: keyword.locationId,
        };
        
        await db.insert(rankingsHistory).values(rankingData).onConflictDoNothing();
        inserted++;
        
        if (row.url && !keyword.targetUrl) {
          await db.update(keywords)
            .set({ targetUrl: row.url, isCorePage: isCorePage(row.url), updatedAt: new Date() })
            .where(eq(keywords.id, keyword.id));
        }
      } catch (err) {
        errors.push(`Row: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Ingestion] Rankings: ${inserted} inserted`);
  } catch (err) {
    errors.push(`File error: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  return { inserted, errors };
}

export async function importProjectsFromXlsx(filePath: string): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  
  try {
    const validatedPath = validateFilePath(filePath);
    const workbook = XLSX.readFile(validatedPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as { name: string; domain: string }[];
    
    for (const row of data) {
      try {
        if (!row.name || !row.domain) continue;
        
        const existing = await db.select().from(projects).where(eq(projects.domain, row.domain));
        
        if (existing.length > 0) {
          await db.update(projects)
            .set({ name: row.name, updatedAt: new Date() })
            .where(eq(projects.id, existing[0].id));
          updated++;
        } else {
          await db.insert(projects).values({
            name: row.name,
            domain: row.domain,
            isActive: true,
          });
          inserted++;
        }
      } catch (err) {
        errors.push(`Row: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Ingestion] Projects: ${inserted} inserted, ${updated} updated`);
  } catch (err) {
    errors.push(`File error: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  return { inserted, updated, errors };
}

export async function initializeDefaultPriorityRules(): Promise<void> {
  const existingRules = await db.select().from(settingsPriorityRules);
  
  if (existingRules.length > 0) {
    console.log('[Ingestion] Priority rules already exist, skipping initialization');
    return;
  }
  
  const defaultRules = [
    {
      name: 'P1 - High Priority',
      priority: 'P1',
      intents: ['commercial', 'transactional'] as string[],
      maxPosition: 10,
      minClicks: 0,
      isDefault: true,
      isActive: true,
    },
    {
      name: 'P2 - Medium Priority',
      priority: 'P2',
      intents: ['commercial', 'transactional', 'informational', 'mixed'] as string[],
      maxPosition: 20,
      minClicks: null,
      isDefault: true,
      isActive: true,
    },
    {
      name: 'P3 - Low Priority',
      priority: 'P3',
      intents: [] as string[],
      maxPosition: null,
      minClicks: null,
      isDefault: true,
      isActive: true,
    },
  ];
  
  for (const rule of defaultRules) {
    await db.insert(settingsPriorityRules).values(rule);
  }
  console.log('[Ingestion] Default priority rules initialized');
}

export async function runFullImport(
  locationsPath: string,
  keywordsPath: string,
  projectId: string,
  rankingsPath?: string
): Promise<{ 
  locations: { inserted: number; updated: number; errors: string[] };
  keywords: { inserted: number; updated: number; errors: string[] };
  rankings?: { inserted: number; errors: string[] };
}> {
  console.log('[Ingestion] Starting full import...');
  
  await initializeDefaultPriorityRules();
  
  const locationsResult = await importLocations(locationsPath);
  const keywordsResult = await importKeywords(keywordsPath, projectId);
  
  let rankingsResult;
  if (rankingsPath && fs.existsSync(rankingsPath)) {
    rankingsResult = await importRankingsFromXlsx(rankingsPath);
  }
  
  console.log('[Ingestion] Full import completed');
  
  return {
    locations: locationsResult,
    keywords: keywordsResult,
    rankings: rankingsResult,
  };
}

export async function bulkUpdateKeywords(
  keywordIds: number[],
  updates: Partial<{
    trackDaily: boolean;
    priority: string;
    cluster: string;
    isActive: boolean;
    isCorePage: boolean;
  }>
): Promise<number> {
  if (keywordIds.length === 0) return 0;
  
  const updateData: any = { ...updates, updatedAt: new Date() };
  
  await db.update(keywords)
    .set(updateData)
    .where(sql`${keywords.id} = ANY(${keywordIds})`);
  
  console.log(`[Ingestion] Bulk updated ${keywordIds.length} keywords`);
  return keywordIds.length;
}

export async function deactivateKeywords(keywordIds: number[]): Promise<number> {
  return bulkUpdateKeywords(keywordIds, { isActive: false });
}

export async function activateKeywords(keywordIds: number[]): Promise<number> {
  return bulkUpdateKeywords(keywordIds, { isActive: true });
}
