import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";

interface IntentClassificationResult {
  intent: SearchIntent;
  confidence: number;
}

export async function classifySearchIntent(question: string): Promise<IntentClassificationResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a search intent classifier. Classify the given search query into one of these categories:
- informational: User seeks knowledge, answers, or information (e.g., "what is", "how to", "why does")
- commercial: User is researching products/services before purchase (e.g., "best", "reviews", "comparison", "vs")
- transactional: User intends to complete a purchase or action (e.g., "buy", "price", "order", "download", "sign up")
- navigational: User seeks a specific website or page (e.g., brand names, specific URLs)

Respond with JSON: { "intent": "one of the four categories", "confidence": 0.0 to 1.0 }`
      },
      {
        role: "user",
        content: question
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 100,
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  
  const validIntents: SearchIntent[] = ["informational", "commercial", "transactional", "navigational"];
  const intent = validIntents.includes(result.intent) ? result.intent : "informational";
  const confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
  
  return { intent, confidence };
}

export async function classifyBatchIntents(questions: string[]): Promise<IntentClassificationResult[]> {
  // Process all questions in a single API call for efficiency
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a search intent classifier. For each query, classify into one of these categories:
- informational: User seeks knowledge/answers (e.g., "what is", "how to")
- commercial: User is researching before purchase (e.g., "best", "reviews", "vs")
- transactional: User intends to complete purchase/action (e.g., "buy", "price", "download")
- navigational: User seeks specific website/page (e.g., brand names)

Respond with JSON: { "results": [{ "intent": "category", "confidence": 0.0-1.0 }, ...] }
Return exactly ${questions.length} results in the same order as inputs.`
      },
      {
        role: "user",
        content: JSON.stringify(questions)
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{"results":[]}');
  const batchResults = Array.isArray(parsed) ? parsed : (parsed.results || []);
  
  const validIntents: SearchIntent[] = ["informational", "commercial", "transactional", "navigational"];
  const results: IntentClassificationResult[] = [];
  
  for (let j = 0; j < questions.length; j++) {
    const r = batchResults[j] || {};
    results.push({
      intent: validIntents.includes(r.intent) ? r.intent : "informational",
      confidence: Math.max(0, Math.min(1, r.confidence || 0.5)),
    });
  }
  
  return results;
}

// Competitor Citation Pattern Analysis
export interface CompetitorCitationInsights {
  summary: string;
  questionThemes: Array<{
    theme: string;
    count: number;
    examples: string[];
    intent: string;
  }>;
  contentGaps: Array<{
    topic: string;
    competitorAdvantage: string;
    suggestedAction: string;
    priority: "high" | "medium" | "low";
  }>;
  topCompetitorStrategies: Array<{
    competitor: string;
    citationCount: number;
    dominantTopics: string[];
    contentType: string;
  }>;
  recommendations: Array<{
    action: string;
    rationale: string;
    expectedImpact: string;
  }>;
  analyzedAt: string;
}

interface CitationData {
  question: string;
  competitor: string;
  platform: string;
  citedUrl?: string;
  citedPageTitle?: string;
  volume?: number;
  intent?: string;
}

export async function analyzeCompetitorCitations(
  citations: CitationData[],
  brandDomain: string
): Promise<CompetitorCitationInsights> {
  // Prepare summary data for the AI
  const competitorStats = new Map<string, { count: number; questions: string[] }>();
  const intentBreakdown = { informational: 0, commercial: 0, transactional: 0, navigational: 0, unknown: 0 };
  
  for (const c of citations) {
    const comp = c.competitor || 'unknown';
    if (!competitorStats.has(comp)) {
      competitorStats.set(comp, { count: 0, questions: [] });
    }
    const stats = competitorStats.get(comp)!;
    stats.count++;
    if (stats.questions.length < 10) {
      stats.questions.push(c.question || '');
    }
    
    if (c.intent && c.intent in intentBreakdown) {
      intentBreakdown[c.intent as keyof typeof intentBreakdown]++;
    } else {
      intentBreakdown.unknown++;
    }
  }

  // Prepare competitor summary
  const competitorSummary = Array.from(competitorStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, data]) => ({
      competitor: name,
      citationCount: data.count,
      sampleQuestions: data.questions.slice(0, 5)
    }));

  // Sample questions for theme analysis (up to 100)
  const sampleQuestions = citations
    .filter(c => c.question)
    .slice(0, 100)
    .map(c => ({
      question: c.question,
      competitor: c.competitor,
      intent: c.intent || 'unknown'
    }));

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are an expert SEO strategist analyzing competitor AI citations for "${brandDomain}".

TASK: Analyze the provided competitor citation data and generate actionable insights.

REQUIRED OUTPUT (you MUST populate ALL arrays with at least 2-3 items each):

1. **summary**: Write a compelling 2-3 sentence executive summary highlighting key competitive threats and opportunities.

2. **questionThemes** (REQUIRED: 3-5 items): Group similar questions into themes. Look at the sample questions and identify patterns like "pricing questions", "comparison queries", "how-to guides", etc.

3. **contentGaps** (REQUIRED: 3-4 items): Identify topics where competitors are being cited that the brand should target. Consider what content is missing based on the questions competitors answer.

4. **topCompetitorStrategies** (REQUIRED: 2-3 items): For top competitors by citation count, infer their content strategy. What types of content are they creating that gets cited?

5. **recommendations** (REQUIRED: 3-4 items): Provide specific, actionable steps the SEO team should take. Be concrete - "Create a comparison guide for X" not "Improve content".

IMPORTANT: Even with limited data, generate meaningful insights by inferring patterns. Never return empty arrays.

Respond with JSON:
{
  "summary": "Executive summary (2-3 sentences)",
  "questionThemes": [{"theme": "string", "count": number, "examples": ["string"], "intent": "informational|commercial|transactional|navigational"}],
  "contentGaps": [{"topic": "string", "competitorAdvantage": "string", "suggestedAction": "string", "priority": "high|medium|low"}],
  "topCompetitorStrategies": [{"competitor": "domain.com", "citationCount": number, "dominantTopics": ["string"], "contentType": "string"}],
  "recommendations": [{"action": "string", "rationale": "string", "expectedImpact": "string"}]
}`
      },
      {
        role: "user",
        content: JSON.stringify({
          totalCitations: citations.length,
          intentBreakdown,
          topCompetitors: competitorSummary,
          sampleQuestions
        })
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  // Extract top competitors for fallback generation
  const topCompetitors = competitorSummary.slice(0, 3);

  // Validate and provide fallbacks if AI returned empty arrays
  let questionThemes = result.questionThemes || [];
  let contentGaps = result.contentGaps || [];
  let topCompetitorStrategies = result.topCompetitorStrategies || [];
  let recommendations = result.recommendations || [];

  // Generate fallback insights if arrays are empty
  if (questionThemes.length === 0 && sampleQuestions.length > 0) {
    questionThemes = [{
      theme: "General product/service queries",
      count: Math.floor(citations.length * 0.4),
      examples: sampleQuestions.slice(0, 2).map(q => q.question).filter(Boolean),
      intent: "informational"
    }];
  }

  if (contentGaps.length === 0 && topCompetitors.length > 0) {
    contentGaps = [{
      topic: "AI visibility optimization",
      competitorAdvantage: `Competitors like ${topCompetitors[0]?.competitor || 'others'} have more comprehensive content`,
      suggestedAction: "Create in-depth guides and comparison content targeting common user questions",
      priority: "high" as const
    }];
  }

  if (topCompetitorStrategies.length === 0 && topCompetitors.length > 0) {
    topCompetitorStrategies = topCompetitors.map(c => ({
      competitor: c.competitor,
      citationCount: c.citationCount,
      dominantTopics: ["Industry expertise", "Comprehensive guides"],
      contentType: "Educational content"
    }));
  }

  if (recommendations.length === 0) {
    recommendations = [{
      action: "Create comprehensive FAQ content targeting common user questions",
      rationale: "AI systems favor detailed, authoritative content that directly answers user queries",
      expectedImpact: "Increased visibility in AI-generated responses"
    }];
  }

  const summary = result.summary && result.summary !== "Analysis complete." 
    ? result.summary 
    : `Analysis of ${citations.length} competitor citations across ${competitorStats.size} domains. ${topCompetitors.length > 0 ? `Top competitor: ${topCompetitors[0]?.competitor} with ${topCompetitors[0]?.citationCount} citations.` : ''} Focus on creating authoritative content to improve AI visibility.`;

  return {
    summary,
    questionThemes,
    contentGaps,
    topCompetitorStrategies,
    recommendations,
    analyzedAt: new Date().toISOString()
  };
}
