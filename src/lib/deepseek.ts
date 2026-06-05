import type { SlidePresentation, ChatMessage } from '@/types/slide';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const BASE_URL = 'https://opencode.ai/zen/go/v1';
const CHAT_ENDPOINT = `${BASE_URL}/chat/completions`;

/** API key resolved from env or fallback demo key */
function getApiKey(): string {
  // Vite / Next.js public env
  if (typeof process !== 'undefined' && process.env?.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }
  // Next.js server-side env
  if (typeof process !== 'undefined' && process.env?.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }
  // Fallback (development / demo)
  return 'FlfRhXJ6dRu3VXmv1KLniJop0YVFBamZ';
}

/* ------------------------------------------------------------------ */
/*  System Prompts                                                     */
/* ------------------------------------------------------------------ */

/**
 * System prompt used when the AI is asked to style / beautify a slide
 * presentation. The AI should return a JSON object conforming to the
 * SlidePresentation interface.
 */
export const SYSTEM_PROMPT_STYLE = `You are a professional presentation designer. Your task is to improve the visual design of a slide presentation while preserving ALL content and structural integrity.

Rules:
1. Return ONLY valid JSON — no markdown fences, no commentary, no extra text.
2. The JSON must strictly conform to the SlidePresentation type shown below.
3. Do NOT change any text content, image sources, or element positions (x, y).
4. Improve the theme (colors, fonts) and element styling (font sizes, alignment, padding, opacity, borders) for maximum visual appeal and readability.
5. Keep the overall layout structure intact — do not add or remove slides or elements.

SlidePresentation type:
{
  id: string;
  title: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    fontTitle: string;
    fontBody: string;
    borderRadius: number;
  };
  slides: Array<{
    id: string;
    index: number;
    background: { type: "color" | "gradient" | "image"; value: string };
    elements: Array<{
      id: string;
      type: "text" | "image" | "shape";
      x: number; y: number; width: number; height: number;
      rotation: number; zIndex: number; opacity: number;
      // text-specific
      content?: string; fontSize?: number; fontFamily?: string;
      fontWeight?: "normal" | "bold"; fontStyle?: "normal" | "italic";
      color?: string; textAlign?: "left" | "center" | "right";
      lineHeight?: number; backgroundColor?: string; padding?: number;
      // image-specific
      src?: string; alt?: string; objectFit?: "cover" | "contain" | "fill";
      borderRadius?: number; source?: "generated" | "stock" | "uploaded";
      attribution?: string;
      // shape-specific
      shape?: "rectangle" | "circle" | "triangle" | "line";
      fill?: string; stroke?: string; strokeWidth?: number;
    }>;
    speakerNotes?: string;
  }>;
}`;

/**
 * System prompt used when the AI processes a user chat request to edit
 * the presentation. The AI should respond with a natural-language
 * message and optionally an array of SlideChange operations.
 */
export const SYSTEM_PROMPT_CHAT = `You are an AI assistant helping users edit their slide presentations through natural language.

Your capabilities:
- Update text content on slides
- Change colors, fonts, sizes, alignment
- Add, remove, or reorder elements
- Modify backgrounds and theme
- Add speaker notes

You MUST respond with a JSON object containing two fields:
{
  "message": "Your natural language response to the user",
  "changes": [
    {
      "slideIndex": number,
      "elementId": string | null,  // null = slide-level change
      "field": string,             // the property to change
      "value": unknown             // the new value
    }
  ]
}

Rules:
1. Return ONLY the JSON object — no markdown fences, no extra text.
2. If no changes are needed, set "changes" to an empty array.
3. "message" should be conversational and explain what was done.
4. Use proper types — strings for string fields, numbers for numeric fields, etc.
5. For elementId, provide the exact element ID from the slide data.`;

/* ------------------------------------------------------------------ */
/*  API Client                                                         */
/* ------------------------------------------------------------------ */

export interface DeepSeekOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Generic chat-completion call to the DeepSeek-compatible API.
 * Returns the parsed response JSON.
 */
export async function callDeepSeek(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: DeepSeekOptions = {},
): Promise<string> {
  const {
    model = 'deepseek-chat',
    temperature = 0.7,
    maxTokens = 4096,
    signal,
  } = options;

  const response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `DeepSeek API error: ${response.status} ${response.statusText}${
        body ? ` — ${body}` : ''
      }`,
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/* ------------------------------------------------------------------ */
/*  High-level helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Send a presentation to the AI for styling/beautification.
 * Returns the updated SlidePresentation JSON.
 */
export async function stylePresentation(
  presentation: SlidePresentation,
  options: Omit<DeepSeekOptions, 'model'> = {},
): Promise<SlidePresentation> {
  const raw = await callDeepSeek(
    [
      { role: 'system', content: SYSTEM_PROMPT_STYLE },
      {
        role: 'user',
        content: `Please improve the visual design of this presentation:\n\n${JSON.stringify(presentation, null, 2)}`,
      },
    ],
    { ...options, temperature: 0.3 },
  );

  // Strip any markdown fences the model might add despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*|```\s*$/gi, '').trim();
  return JSON.parse(cleaned) as SlidePresentation;
}

/**
 * Send a user chat message along with the current presentation context
 * to get AI-suggested edits.
 * Returns the assistant's response message and any SlideChanges.
 */
export async function processChat(
  presentation: SlidePresentation,
  slideIndex: number,
  userMessage: string,
  chatHistory: ChatMessage[] = [],
  options: Omit<DeepSeekOptions, 'model'> = {},
): Promise<{ message: string; changes: import('@/types/slide').SlideChange[] }> {
  const currentSlide = presentation.slides[slideIndex];

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT_CHAT },
    {
      role: 'user',
      content: `Here is the current presentation JSON:\n\n${JSON.stringify(presentation, null, 2)}\n\nThe user is currently viewing slide index ${slideIndex}. Here is that slide in detail:\n\n${JSON.stringify(currentSlide, null, 2)}\n\nUser message: ${userMessage}`,
    },
  ];

  // Inject recent chat history for conversational context
  const recentHistory = chatHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  const raw = await callDeepSeek(messages, {
    ...options,
    temperature: 0.5,
  });

  const cleaned = raw.replace(/^```(?:json)?\s*|```\s*$/gi, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    message: parsed.message ?? '',
    changes: parsed.changes ?? [],
  };
}

export default {
  callDeepSeek,
  stylePresentation,
  processChat,
  SYSTEM_PROMPT_STYLE,
  SYSTEM_PROMPT_CHAT,
};
