import { db } from "../db";
import { projects, locations, keywords, pageMetrics, rankingsHistory } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import fs from "fs";
import path from "path";

const PROJECT_ID = "3fa04ca3-7ac8-4b58-afca-a2aa1363ca03";

export async function seedProductionDatabase(): Promise<boolean> {
  try {
    const [projectCount] = await db.select({ count: count() }).from(projects);
    
    if (projectCount.count > 0) {
      console.log("[seed] Database already has data, skipping seed");
      return false;
    }

    console.log("[seed] Production database is empty, seeding with TekRevol project data...");

    await db.insert(projects).values({
      id: PROJECT_ID,
      name: "Tekrevol",
      domain: "Tekrevol.com",
      isActive: true,
    });
    console.log("[seed] Created TekRevol project");

    const seedDataPath = path.join(process.cwd(), "server", "seed-data");

    const locationsData = JSON.parse(fs.readFileSync(path.join(seedDataPath, "locations.json"), "utf-8"));
    if (locationsData && locationsData.length > 0) {
      for (const loc of locationsData) {
        await db.insert(locations).values({
          id: loc.id,
          name: loc.name,
          dataforseoLocationCode: loc.dataforseo_location_code,
          languageCode: loc.language_code,
          isActive: loc.is_active,
        }).onConflictDoNothing();
      }
      console.log(`[seed] Inserted ${locationsData.length} locations`);
    }

    const keywordsData = JSON.parse(fs.readFileSync(path.join(seedDataPath, "keywords.json"), "utf-8"));
    if (keywordsData && keywordsData.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < keywordsData.length; i += batchSize) {
        const batch = keywordsData.slice(i, i + batchSize);
        const values = batch.map((kw: any) => ({
          keyword: kw.keyword,
          projectId: kw.project_id,
          locationId: kw.location_id,
          cluster: kw.cluster,
          searchVolume: kw.search_volume,
          difficulty: kw.difficulty?.toString(),
          intentHint: kw.intent_hint,
          priority: kw.priority || "P3",
          targetUrl: kw.target_url,
          isCorePage: kw.is_core_page || false,
          isActive: kw.is_active !== false,
          trackDaily: kw.track_daily !== false,
          languageCode: kw.language_code || "en-US",
        }));
        await db.insert(keywords).values(values);
      }
      console.log(`[seed] Inserted ${keywordsData.length} keywords`);
    }

    const pagesData = JSON.parse(fs.readFileSync(path.join(seedDataPath, "pages.json"), "utf-8"));
    if (pagesData && pagesData.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      for (const page of pagesData) {
        await db.insert(pageMetrics).values({
          url: page.url,
          projectId: page.project_id,
          date: today,
          isIndexable: true,
          coreWebVitalsOk: true,
        }).onConflictDoNothing();
      }
      console.log(`[seed] Inserted ${pagesData.length} page metrics`);
    }

    const rankingsData = JSON.parse(fs.readFileSync(path.join(seedDataPath, "rankings.json"), "utf-8"));
    if (rankingsData && rankingsData.length > 0) {
      const keywordIdMap = new Map<number, number>();
      const allKeywords = await db.select({ id: keywords.id, keyword: keywords.keyword }).from(keywords);
      const keywordsByName = new Map(allKeywords.map(k => [k.keyword, k.id]));
      
      const oldKeywordsData = JSON.parse(fs.readFileSync(path.join(seedDataPath, "keywords.json"), "utf-8"));
      for (const oldKw of oldKeywordsData) {
        const newId = keywordsByName.get(oldKw.keyword);
        if (newId) {
          keywordIdMap.set(oldKw.id, newId);
        }
      }

      const today = new Date().toISOString().split("T")[0];
      let insertedCount = 0;
      for (const rank of rankingsData) {
        const newKeywordId = keywordIdMap.get(rank.keyword_id);
        if (newKeywordId && rank.position > 0) {
          try {
            await db.insert(rankingsHistory).values({
              keywordId: newKeywordId,
              projectId: rank.project_id,
              date: today,
              position: rank.position,
              url: rank.url,
              serpFeatures: rank.serp_features || [],
            });
            insertedCount++;
          } catch (e) {
          }
        }
      }
      console.log(`[seed] Inserted ${insertedCount} ranking records`);
    }

    console.log("[seed] Production database seeded successfully!");
    return true;
  } catch (error) {
    console.error("[seed] Error seeding production database:", error);
    return false;
  }
}
