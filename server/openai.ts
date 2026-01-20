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
