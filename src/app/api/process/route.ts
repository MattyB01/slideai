import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const DESIGN_PRINCIPLES = `Professional Presentation Design Principles — based on analysis of 10 professionally designed PPTX decks.

## Color Strategy
- Per-slide color variance creates emotional impact. NEVER use a single background for every slide.
- Use 3-4 saturated colors for bold/high-impact, 4+ for playful, dual-tone for premium, single tint for subtle professional.
- White backgrounds with strategic dark framing for corporate clean.
- Always ensure WCAG AA contrast (4.5:1 minimum) between text and background.

## Background Rules
- Solid colors preferred — gradients are rare in professional decks.
- Full-bleed images (70%+ coverage) = immersive storytelling.
- Moderate images (30-50%) = balanced premium feel.
- No background should obscure text readability.

## Layout & Spacing
- Titles at 3-7% from top = bold/confident. 12-19% = balanced. 22%+ = narrative-led.
- 5-10 elements/slide for clean/impactful. 10-40 for detailed content.
- Keep consistent margins — nothing at the very edge.
- NEVER cut off or overlay content. Text must not overlap other elements. All elements must be fully within slide bounds.

## Typography
- Presentation mode: 28-32pt body, 40-54pt titles.
- Reading mode: 14-18pt body, 28-36pt titles.
- Use Google Fonts: Inter, Roboto, Open Sans, Lora, Poppins, DM Sans, Instrument Serif.
- Maximum 2 font families per deck. Bold/semibold for headings, normal for body.

## Shape Usage (Style Signature)
- ≤20 shapes = Luxury/Elegant. 20-120 = Corporate. >600 = Template/structured.
- Rectangles: universal — frames, backgrounds, bars, borders.
- Triangles: use sparingly as design signature (mountains, arrows, direction).
- Circles: rare — for tech diagrams, decorative bubbles.

## Image Strategy
- Full-bleed (70%+): immersive, text with semi-transparent overlay.
- Moderate (30-50%): premium, sits alongside content.
- Small (<15%): supporting role.
- Zero images: fully illustrative/vector approach with colored shapes.

## Style Archetypes — Pick One:
1. Corporate Clean: White + dark gray + centered text. For reviews/status.
2. Luxury Elegant: Deep teal + cream, minimal shapes, premium breathing room. For pitches/brand decks.
3. Bold Dramatic: Saturated colors, high titles, impact through scale. For launches/marketing.
4. Playful Colorful: 4+ colors, zero images, fully illustrative/vector. For events/youth.
5. Tech Futuristic: Diagrams, icons, structured visual explanations. For tech/roadmaps.
6. Minimal Professional: Single tint background, ~7 elements, breathing room. For proposals/startups.`;

const SYSTEM_PROMPT = `You are a professional presentation designer. You will receive a JSON representation of a PowerPoint presentation. Your job is to improve its visual design.

${DESIGN_PRINCIPLES}

Rules:
1. Return ONLY valid JSON — no markdown fences, no commentary.
2. The JSON must match the SlidePresentation schema exactly.
3. Do NOT remove or truncate any text content — preserve ALL existing text.
4. Do NOT change element positions (x, y) significantly — maintain the original layout structure.
5. Propose a complete visual theme (colors, fonts, background style).
6. VARY background colors between slides — do NOT make every slide the same color.
7. Ensure nothing is cut off — all elements must be fully within slide bounds (x + width ≤ 100%, y + height ≤ 100%).
8. Ensure WCAG AA contrast ratios minimum 4.5:1.
9. Add a background (color) to every slide.
10. Where images would improve the slide, set src to "__STOCK__:{keywords}" for the AI to search.
11. Match the overall design archetype to the presentation's subject matter.
12. Return the full updated JSON object.`;

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
