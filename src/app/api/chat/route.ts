import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'FlfRhXJ6dRu3VXmv1KLniJop0YVFBamZ';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const SYSTEM_PROMPT = `You are an AI presentation editor. The user is viewing a slide. You have the full JSON of the presentation.

When the user requests a change, return ONLY a JSON object with this structure:
{
  "changes": [
    {
      "slideIndex": number,
      "elementId": string | null,
      "field": string,
      "value": any
    }
  ],
  "message": string
}

If the user asks for a new image, set value to "__GENERATE__:{prompt}" or "__STOCK__:{keywords}".
Only return JSON. No other text.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, slideIndex, presentation } = body;

    if (!message || !presentation) {
      return NextResponse.json({ error: 'Message and presentation required' }, { status: 400 });
    }

    const userContent = JSON.stringify({
      message,
      currentSlideIndex: slideIndex ?? 0,
      presentation,
    });

    const llmResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.5,
        max_tokens: 16000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return NextResponse.json({ error: `AI error: ${errorText}` }, { status: 502 });
    }

    const data = await llmResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
