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
  const batchSize = 10;
  const results: IntentClassificationResult[] = [];
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    
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

Respond with JSON array: [{ "intent": "category", "confidence": 0.0-1.0 }, ...]
Return exactly ${batch.length} results in the same order as inputs.`
        },
        {
          role: "user",
          content: JSON.stringify(batch)
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{"results":[]}');
    const batchResults = Array.isArray(parsed) ? parsed : (parsed.results || []);
    
    const validIntents: SearchIntent[] = ["informational", "commercial", "transactional", "navigational"];
    
    for (let j = 0; j < batch.length; j++) {
      const r = batchResults[j] || {};
      results.push({
        intent: validIntents.includes(r.intent) ? r.intent : "informational",
        confidence: Math.max(0, Math.min(1, r.confidence || 0.5)),
      });
    }
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
        content: `You are an SEO strategist analyzing competitor AI citations. Your brand domain is "${brandDomain}".

Analyze the competitor citation data to identify:
1. Common question themes/topics that trigger AI citations for competitors
2. Content gaps where competitors are cited but your brand is not
3. Competitor strategies that seem to work well
4. Actionable recommendations for improving AI visibility

Be specific and actionable. Focus on practical insights the SEO team can implement.

Respond with JSON matching this structure:
{
  "summary": "Executive summary of findings (2-3 sentences)",
  "questionThemes": [
    {
      "theme": "Theme name",
      "count": estimated_count,
      "examples": ["example question 1", "example question 2"],
      "intent": "informational|commercial|transactional|navigational"
    }
  ],
  "contentGaps": [
    {
      "topic": "Topic competitors dominate",
      "competitorAdvantage": "Why they're winning",
      "suggestedAction": "What to create/improve",
      "priority": "high|medium|low"
    }
  ],
  "topCompetitorStrategies": [
    {
      "competitor": "domain.com",
      "citationCount": number,
      "dominantTopics": ["topic1", "topic2"],
      "contentType": "Type of content they use"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "rationale": "Why this will help",
      "expectedImpact": "Expected result"
    }
  ]
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

  return {
    summary: result.summary || "Analysis complete.",
    questionThemes: result.questionThemes || [],
    contentGaps: result.contentGaps || [],
    topCompetitorStrategies: result.topCompetitorStrategies || [],
    recommendations: result.recommendations || [],
    analyzedAt: new Date().toISOString()
  };
}
