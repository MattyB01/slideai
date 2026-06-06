import { NextRequest } from 'next/server';
import type { SlidePresentation } from '@/types/slide';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

interface ChangeEvent {
  type: 'change';
  slideIndex: number;
  elementId?: string | null;
  field: string;
  value: unknown;
}

interface ThemeEvent {
  type: 'theme';
  field: string;
  value: unknown;
}

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

## Image Strategy
- Full-bleed (70%+): immersive, text with semi-transparent overlay.
- Moderate (30-50%): premium, sits alongside content.
- Small (<15%): supporting role.

## Style Archetypes — Pick One:
1. Corporate Clean: White + dark gray + centered text.
2. Luxury Elegant: Deep teal + cream, minimal shapes.
3. Bold Dramatic: Saturated colors, high titles, impact through scale.
4. Playful Colorful: 4+ colors, zero images, fully illustrative.
5. Tech Futuristic: Diagrams, icons, structured visual explanations.
6. Minimal Professional: Single tint background, ~7 elements.`;

const SYSTEM_PROMPT = `You are a professional presentation designer. You will receive a JSON representation of a presentation. Your job is to improve its visual design.

${DESIGN_PRINCIPLES}

Rules:
1. Return ONLY valid JSON — no markdown fences, no commentary.
2. The JSON must match the SlidePresentation schema exactly.
3. Do NOT remove or truncate any text content — preserve ALL existing text.
4. Propose a complete visual theme (colors, fonts, background style).
5. VARY background colors between slides — do NOT make every slide the same color.
6. Change LAYOUT (x, y, width, height) to improve visual hierarchy.
7. Adjust font sizes: titles 40-54pt, body 28-32pt for presentation mode.
8. Use Google Fonts: Inter, Roboto, Open Sans, Lora, Poppins, DM Sans, Instrument Serif.
9. Ensure nothing is cut off — all elements must be fully within slide bounds (x + width ≤ 100, y + height ≤ 100).
10. Ensure WCAG AA contrast ratios minimum 4.5:1.
11. Add a background (color) to every slide.
12. Where images would improve the slide, set src to "__STOCK__:{keywords}".
13. Match the overall design archetype to the presentation's subject matter.
14. Keep the same slide IDs and element IDs — do not change them.
15. Return the full updated JSON object.`;

/**
 * Generate incremental changes by diffing old and new presentations.
 */
function generateChanges(
  oldPres: SlidePresentation,
  newPres: SlidePresentation,
): (ChangeEvent | ThemeEvent)[] {
  const changes: (ChangeEvent | ThemeEvent)[] = [];
  const oldSlides = oldPres.slides;
  const newSlides = newPres.slides;

  // Theme changes
  const oldTheme = oldPres.theme;
  const newTheme = newPres.theme;
  if (oldTheme.primaryColor !== newTheme.primaryColor) {
    changes.push({ type: 'theme', field: 'primaryColor', value: newTheme.primaryColor });
  }
  if (oldTheme.secondaryColor !== newTheme.secondaryColor) {
    changes.push({ type: 'theme', field: 'secondaryColor', value: newTheme.secondaryColor });
  }
  if (oldTheme.accentColor !== newTheme.accentColor) {
    changes.push({ type: 'theme', field: 'accentColor', value: newTheme.accentColor });
  }
  if (oldTheme.backgroundColor !== newTheme.backgroundColor) {
    changes.push({ type: 'theme', field: 'backgroundColor', value: newTheme.backgroundColor });
  }
  if (oldTheme.fontTitle !== newTheme.fontTitle) {
    changes.push({ type: 'theme', field: 'fontTitle', value: newTheme.fontTitle });
  }
  if (oldTheme.fontBody !== newTheme.fontBody) {
    changes.push({ type: 'theme', field: 'fontBody', value: newTheme.fontBody });
  }
  if (oldTheme.borderRadius !== newTheme.borderRadius) {
    changes.push({ type: 'theme', field: 'borderRadius', value: newTheme.borderRadius });
  }

  // Per-slide changes
  for (let si = 0; si < Math.max(oldSlides.length, newSlides.length); si++) {
    const oldSlide = oldSlides[si];
    const newSlide = newSlides[si];
    if (!oldSlide || !newSlide) continue;

    // Background
    if (JSON.stringify(oldSlide.background) !== JSON.stringify(newSlide.background)) {
      changes.push({
        type: 'change',
        slideIndex: si,
        elementId: null,
        field: 'background.value',
        value: newSlide.background.value,
      });
    }

    // Element changes (matched by element ID)
    const oldElements = oldSlide.elements;
    const newElements = newSlide.elements;
    const newElMap = new Map(newElements.map((el) => [el.id, el]));

    for (const oldEl of oldElements) {
      const newEl = newElMap.get(oldEl.id);
      if (!newEl) continue;

      // Compare element fields
      if (oldEl.x !== newEl.x) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'x', value: newEl.x });
      if (oldEl.y !== newEl.y) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'y', value: newEl.y });
      if (oldEl.width !== newEl.width) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'width', value: newEl.width });
      if (oldEl.height !== newEl.height) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'height', value: newEl.height });
      if (oldEl.rotation !== newEl.rotation) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'rotation', value: newEl.rotation });
      if (oldEl.opacity !== newEl.opacity) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'opacity', value: newEl.opacity });
      if (oldEl.zIndex !== newEl.zIndex) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'zIndex', value: newEl.zIndex });

      if (oldEl.type === 'text' && newEl.type === 'text') {
        if (oldEl.fontSize !== newEl.fontSize) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'fontSize', value: newEl.fontSize });
        if (oldEl.fontFamily !== newEl.fontFamily) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'fontFamily', value: newEl.fontFamily });
        if (oldEl.fontWeight !== newEl.fontWeight) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'fontWeight', value: newEl.fontWeight });
        if (oldEl.fontStyle !== newEl.fontStyle) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'fontStyle', value: newEl.fontStyle });
        if (oldEl.color !== newEl.color) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'color', value: newEl.color });
        if (oldEl.textAlign !== newEl.textAlign) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'textAlign', value: newEl.textAlign });
        if (oldEl.lineHeight !== newEl.lineHeight) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'lineHeight', value: newEl.lineHeight });
        if (oldEl.backgroundColor !== newEl.backgroundColor) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'backgroundColor', value: newEl.backgroundColor });
        if (oldEl.padding !== newEl.padding) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'padding', value: newEl.padding });
      }

      if (oldEl.type === 'image' && newEl.type === 'image') {
        if (oldEl.src !== newEl.src) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'src', value: newEl.src });
        if (oldEl.objectFit !== newEl.objectFit) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'objectFit', value: newEl.objectFit });
        if (oldEl.borderRadius !== newEl.borderRadius) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'borderRadius', value: newEl.borderRadius });
      }

      if (oldEl.type === 'shape' && newEl.type === 'shape') {
        if (oldEl.fill !== newEl.fill) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'fill', value: newEl.fill });
        if (oldEl.stroke !== newEl.stroke) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'stroke', value: newEl.stroke });
        if (oldEl.strokeWidth !== newEl.strokeWidth) changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field: 'strokeWidth', value: newEl.strokeWidth });
      }
    }
  }

  return changes;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presentation, themeContext } = body;

    if (!presentation) {
      return new Response(JSON.stringify({ error: 'No presentation provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const oldPresentation = JSON.parse(JSON.stringify(presentation)) as SlidePresentation;

    const userMessage = themeContext
      ? `Apply this theme context: ${themeContext}\n\nPresentation:\n${JSON.stringify(presentation)}`
      : JSON.stringify(presentation);

    // Call DeepSeek (non-streaming) to get the full restyled presentation
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
        max_tokens: 64000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return new Response(JSON.stringify({ error: `AI service error: ${errorText}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await llmResponse.json();
    const msg = data.choices?.[0]?.message;
    const content = msg?.content || msg?.reasoning_content || '';

    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'AI response was not valid JSON' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newPresentation = JSON.parse(jsonMatch[0]) as SlidePresentation;

    // Generate diff changes
    const changes = generateChanges(oldPresentation, newPresentation);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: unknown) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };

        let changeCount = 0;

        // Stream theme changes first
        for (const change of changes) {
          if (change.type === 'theme') {
            changeCount++;
            sendSSE(change);
          }
        }

        // Then stream slide changes in batches of 3
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          if (change.type === 'theme') continue; // already sent

          changeCount++;
          sendSSE(change);

          if ((i + 1) % 3 === 0) {
            sendSSE({ type: 'progress', changes: changeCount });
          }
        }

        sendSSE({ type: 'done', changes: changeCount });
        try { controller.close(); } catch {}
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Process error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
