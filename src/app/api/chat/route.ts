import { NextRequest } from 'next/server';
import type { SlidePresentation } from '@/types/slide';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const SYSTEM_PROMPT_SLIDE = `You are an AI presentation editor. The user is viewing a slide. You have the full JSON of the presentation.

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

const SYSTEM_PROMPT_ALL = `You are an AI presentation editor. The user wants to modify the ENTIRE presentation.

When the user requests a change, return the COMPLETE updated SlidePresentation JSON.

Rules:
1. Return the FULL updated presentation JSON — not just the changes.
2. Preserve all text content unless the user asks to change it.
3. Update the theme, backgrounds, layouts, and elements as requested.
4. Do NOT remove images unless asked.
5. Keep the same slide IDs and element IDs.
6. Only return JSON. No other text.`;

/**
 * Generate incremental changes by diffing old and new presentations.
 */
function generateChanges(oldPres: SlidePresentation, newPres: SlidePresentation): any[] {
  const changes: any[] = [];

  // Theme changes
  const oldTheme = oldPres.theme;
  const newTheme = newPres.theme;
  if (oldTheme.primaryColor !== newTheme.primaryColor)
    changes.push({ type: 'theme', field: 'primaryColor', value: newTheme.primaryColor });
  if (oldTheme.secondaryColor !== newTheme.secondaryColor)
    changes.push({ type: 'theme', field: 'secondaryColor', value: newTheme.secondaryColor });
  if (oldTheme.accentColor !== newTheme.accentColor)
    changes.push({ type: 'theme', field: 'accentColor', value: newTheme.accentColor });
  if (oldTheme.backgroundColor !== newTheme.backgroundColor)
    changes.push({ type: 'theme', field: 'backgroundColor', value: newTheme.backgroundColor });
  if (oldTheme.fontTitle !== newTheme.fontTitle)
    changes.push({ type: 'theme', field: 'fontTitle', value: newTheme.fontTitle });
  if (oldTheme.fontBody !== newTheme.fontBody)
    changes.push({ type: 'theme', field: 'fontBody', value: newTheme.fontBody });

  // Per-slide changes
  for (let si = 0; si < Math.max(oldPres.slides.length, newPres.slides.length); si++) {
    const oldSlide = oldPres.slides[si];
    const newSlide = newPres.slides[si];
    if (!oldSlide || !newSlide) continue;

    if (JSON.stringify(oldSlide.background) !== JSON.stringify(newSlide.background)) {
      changes.push({ type: 'change', slideIndex: si, elementId: null, field: 'background.value', value: newSlide.background.value });
    }

    const newElMap = new Map(newSlide.elements.map((el: any) => [el.id, el]));
    for (const oldEl of oldSlide.elements) {
      const newEl = newElMap.get(oldEl.id);
      if (!newEl) continue;

      const compare = (field: string) => {
        if ((oldEl as any)[field] !== (newEl as any)[field])
          changes.push({ type: 'change', slideIndex: si, elementId: oldEl.id, field, value: (newEl as any)[field] });
      };

      compare('x'); compare('y'); compare('width'); compare('height');
      compare('rotation'); compare('opacity'); compare('zIndex');

      if (oldEl.type === 'text' && newEl.type === 'text') {
        compare('fontSize'); compare('fontFamily'); compare('fontWeight');
        compare('fontStyle'); compare('color'); compare('textAlign');
        compare('lineHeight'); compare('backgroundColor'); compare('padding');
      }
      if (oldEl.type === 'image' && newEl.type === 'image') {
        compare('src'); compare('objectFit'); compare('borderRadius');
      }
      if (oldEl.type === 'shape' && newEl.type === 'shape') {
        compare('fill'); compare('stroke'); compare('strokeWidth');
      }
    }
  }

  return changes;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, slideIndex, presentation, scope } = body;

    if (!message || !presentation) {
      return new Response(JSON.stringify({ error: 'Message and presentation required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const oldPresentation = JSON.parse(JSON.stringify(presentation)) as SlidePresentation;

    const userContent = JSON.stringify({
      message,
      currentSlideIndex: slideIndex ?? 0,
      presentation,
      scope: scope ?? 'slide',
    });

    // Whole-show scope: streaming via diff
    if (scope === 'all') {
      const llmResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_ALL },
            { role: 'user', content: userContent },
          ],
          temperature: 0.5,
          max_tokens: 32000,
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        return new Response(JSON.stringify({ error: `AI error: ${errorText}` }), {
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
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rawJson = content.slice(firstBrace, lastBrace + 1);
      const newPresentation = JSON.parse(rawJson) as SlidePresentation;

      // Generate diff and stream it
      const changes = generateChanges(oldPresentation, newPresentation);

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendSSE = (data: unknown) => {
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
          };

          let changeCount = 0;

          for (const change of changes) {
            changeCount++;
            sendSSE(change);
            if (changeCount % 3 === 0) {
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
    }

    // Single slide scope (non-streaming)
    const llmResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_SLIDE },
          { role: 'user', content: userContent },
        ],
        temperature: 0.5,
        max_tokens: 32000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return new Response(JSON.stringify({ error: `AI error: ${errorText}` }), {
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

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
