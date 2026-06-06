import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const SYSTEM_PROMPT = `You are a professional presentation designer. You will receive a JSON representation of a PowerPoint presentation. Your job is to improve its visual design.

Rules:
1. Return ONLY valid JSON — no markdown fences, no commentary.
2. The JSON must match the SlidePresentation schema.
3. Do NOT change any text content, image sources, or element positions.
4. Propose a complete visual theme (colors, fonts, background style).
5. Vary layouts between slides (avoid repetition).
6. Use Google Fonts only (Inter, Roboto, Open Sans, Lora, Merriweather, Poppins, DM Sans, Instrument Serif).
7. Ensure contrast ratios meet WCAG AA.
8. Add a background (color, gradient, or image) to every slide.
9. Where images would improve the slide, set src to "__STOCK__:{keywords}" for the AI to search.
10. Return the full updated JSON object.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presentation, themeContext } = body;

    if (!presentation) {
      return NextResponse.json({ error: 'No presentation provided' }, { status: 400 });
    }

    const userMessage = themeContext
      ? `Apply this theme context: ${themeContext}\n\nPresentation:\n${JSON.stringify(presentation)}`
      : JSON.stringify(presentation);

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 32000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return NextResponse.json(
        { error: `AI service error: ${errorText}` },
        { status: 502 }
      );
    }

    const data = await llmResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    // Try to parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
    }

    const styledPresentation = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ presentation: styledPresentation });
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
