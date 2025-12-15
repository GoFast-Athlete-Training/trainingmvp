import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export interface RequiredUserInputs {
  planStartDate: Date | string; // Training start day
  preferredDays: number[]; // Preferred days of week (1=Monday, 7=Sunday)
  totalWeeks: number; // Total weeks (calculated from race date - plan start date)
  [key: string]: any; // Other inputs as specified by MustHaves
}

/**
 * Normalize preferredDays array to human-readable string
 * [1,3,5] → "Monday, Wednesday, Friday"
 */
function normalizePreferredDays(days: number[]): string {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days
    .map((day) => dayNames[day - 1])
    .filter(Boolean)
    .join(", ");
}

/**
 * Normalize date to formatted string
 */
function normalizeDate(date: Date | string): string {
  if (typeof date === "string") {
    return date;
  }
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Assemble prompt string from database components
 * 
 * This is HARDCODED by the coder (me) - the structure/formatting is fixed.
 * Content comes from the database models.
 * 
 * Order: AI Role → Instructions → Must Haves → Rule Set → Return Format Schema → Return Format Example
 */
function assemblePromptFromComponents(components: {
  aiRole: { content: string } | null;
  instructions: Array<{ title: string; content: string }>;
  mustHaves: { fields: any } | null;
  ruleSet: {
    topics: Array<{
      name: string;
      rules: Array<{ text: string }>;
    }>;
  } | null;
  returnFormat: { schema: any; example: any } | null;
}): string {
  const parts: string[] = [];

  // 1. AI Role content
  if (components.aiRole?.content) {
    parts.push(components.aiRole.content);
  }

  // 2. Prompt Instructions (from DB - PromptInstruction table)
  // Hardcoded structure wraps DB content
  // Note: Instructions should contain {totalWeeks} placeholder for interpolation
  if (components.instructions && components.instructions.length > 0) {
    parts.push("## Instructions");
    components.instructions.forEach((instruction) => {
      if (instruction.title) {
        parts.push(`### ${instruction.title}`);
      }
      if (instruction.content) {
        parts.push(instruction.content); // Will be interpolated with {totalWeeks} later
      }
    });
  }

  // 3. Must Haves (from DB - MustHaves.fields)
  // Hardcoded structure wraps DB content
  if (components.mustHaves?.fields) {
    parts.push("## Required Fields");
    const fields = components.mustHaves.fields;
    if (typeof fields === "string") {
      parts.push(fields);
    } else if (typeof fields === "object") {
      parts.push(JSON.stringify(fields, null, 2));
    }
  }

  // 4. Rule Set (from DB - RuleSet → RuleSetTopic → RuleSetItem)
  // Hardcoded structure wraps DB content
  if (components.ruleSet?.topics) {
    parts.push("## Training Rules");
    components.ruleSet.topics.forEach((topic) => {
      parts.push(`### ${topic.name}`);
      topic.rules.forEach((rule) => {
        parts.push(`- ${rule.text}`);
      });
    });
  }

  // 5. Return Format schema (from DB - ReturnJsonFormat.schema)
  // Hardcoded structure wraps DB content
  if (components.returnFormat?.schema) {
    parts.push("## Return Format Schema");
    const schema = components.returnFormat.schema;
    if (typeof schema === "string") {
      parts.push(schema);
    } else if (typeof schema === "object") {
      parts.push(JSON.stringify(schema, null, 2));
    }
  }

  // 6. Return Format example (from DB - ReturnJsonFormat.example)
  // Hardcoded structure wraps DB content
  if (components.returnFormat?.example) {
    parts.push("## Example Output");
    const example = components.returnFormat.example;
    if (typeof example === "string") {
      parts.push(example);
    } else if (typeof example === "object") {
      parts.push(JSON.stringify(example, null, 2));
    }
  }

  // Concatenate all parts with double newlines
  return parts.join("\n\n");
}

/**
 * Training Plan Generation Service
 * 
 * Responsibilities:
 * 1. Load prompt and all related components from database
 * 2. Assemble prompt string using hardcoded structure (written by coder)
 * 3. Normalize user inputs (dates, arrays to strings)
 * 4. Interpolate normalized inputs into prompt (simple string replacement)
 * 5. Call OpenAI once
 * 6. Return raw JSON response
 * 
 * The prompt structure is FROZEN - written by the coder, not discovered at runtime.
 * Content comes from DB, formatting comes from this code.
 */
export async function generatePlanFromPrompt(
  promptId: string,
  userInputs: RequiredUserInputs
): Promise<string> {
  // 1. Load prompt and all related components from database
  const prompt = await prisma.trainingGenPrompt.findUnique({
    where: { id: promptId },
    include: {
      aiRole: true,
      ruleSet: {
        include: {
          topics: {
            include: {
              rules: {
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      mustHaves: true,
      returnFormat: true,
      instructions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!prompt) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  // 2. Assemble prompt string using hardcoded structure
  // This structure is written by the coder (me), content comes from DB
  let promptText = assemblePromptFromComponents({
    aiRole: prompt.aiRole,
    instructions: prompt.instructions,
    mustHaves: prompt.mustHaves,
    ruleSet: prompt.ruleSet,
    returnFormat: prompt.returnFormat,
  });

  // 3. Normalize user inputs
  const normalizedInputs: Record<string, string> = {
    planStartDate: normalizeDate(userInputs.planStartDate),
    preferredDays: normalizePreferredDays(userInputs.preferredDays),
    totalWeeks: String(userInputs.totalWeeks), // Pass totalWeeks as string for interpolation
  };

  // Add any other inputs from userInputs (for Must Haves fields)
  Object.keys(userInputs).forEach((key) => {
    if (key !== "planStartDate" && key !== "preferredDays") {
      const value = userInputs[key];
      if (value !== undefined && value !== null) {
        // Normalize based on type
        if (value instanceof Date) {
          normalizedInputs[key] = normalizeDate(value);
        } else if (Array.isArray(value)) {
          // If it's an array of numbers (like preferredDays), normalize it
          if (value.length > 0 && typeof value[0] === "number") {
            normalizedInputs[key] = normalizePreferredDays(value);
          } else {
            normalizedInputs[key] = JSON.stringify(value);
          }
        } else {
          normalizedInputs[key] = String(value);
        }
      }
    }
  });

  // 4. Interpolate normalized inputs into prompt
  // Simple string replacement: {key} → value
  // This replaces {totalWeeks}, {planStartDate}, {preferredDays}, etc. in the prompt
  Object.keys(normalizedInputs).forEach((key) => {
    const placeholder = `{${key}}`;
    const value = normalizedInputs[key];
    promptText = promptText.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  });
  
  console.log('📋 PLAN GENERATION: Interpolated inputs:', {
    totalWeeks: normalizedInputs.totalWeeks,
    planStartDate: normalizedInputs.planStartDate,
    preferredDays: normalizedInputs.preferredDays,
  });

  // OpenAI requires the word "json" in the prompt when using response_format: { type: "json_object" }
  // Ensure it's present (usually it's in the Return Format Schema section, but add it if missing)
  if (!promptText.toLowerCase().includes('json')) {
    promptText += '\n\nPlease return your response as valid JSON.';
  }

  // 5. Call OpenAI once
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: promptText,
      },
    ],
    temperature: 0.7,
    max_tokens: 8000, // Increased for longer plans (18+ weeks)
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Log response length for debugging
  console.log('📋 PLAN GENERATION: AI response length:', content.length, 'characters');
  
  // 6. Return raw JSON response
  return content;
}
