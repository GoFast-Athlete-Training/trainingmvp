import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedTrainingInputs {
  raceName: string | null;
  raceDate: string | null;
  raceDistance: string | null;
  goalTime: string | null;
  baseline5k: string | null;
  weeklyMileage: string | null;
  preferredRunDays: number[] | null;
}

/**
 * Extract training inputs from conversational onboarding input
 * Uses OpenAI to parse natural language into structured JSON
 */
export async function extractTrainingInputs(
  conversation: string
): Promise<ExtractedTrainingInputs> {
  const prompt = `You are a training plan assistant. Extract training information from the following conversation.

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "raceName": "",
  "raceDate": "",
  "raceDistance": "",
  "goalTime": "",
  "baseline5k": "",
  "weeklyMileage": "",
  "preferredRunDays": []
}

Rules:
- raceName: Name of the race (e.g., "Boston Marathon", "Chicago 5K")
- raceDate: Date in YYYY-MM-DD format
- raceDistance: One of "5k", "10k", "10m", "half", "marathon"
- goalTime: Finish time in HH:MM:SS or MM:SS format
- baseline5k: Current 5K time in MM:SS format per mile (e.g., "8:30")
- weeklyMileage: Current weekly mileage as a number string (e.g., "25")
- preferredRunDays: Array of day indices (0=Monday, 6=Sunday). If not specified, return empty array.

If a field is missing or unclear, return null for that field.

Conversation:
${conversation}

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a training plan assistant. Extract structured data from conversations. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response (remove markdown code blocks if present)
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as ExtractedTrainingInputs;

    return parsed;
  } catch (error) {
    console.error('Error extracting training inputs:', error);
    throw new Error('Failed to extract training inputs from conversation');
  }
}

