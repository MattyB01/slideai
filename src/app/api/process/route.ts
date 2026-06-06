import { NextRequest } from 'next/server';

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

const STREAMING_SYSTEM_PROMPT = `You are a professional presentation designer. You will receive a JSON representation of a presentation. Your job is to improve its visual design by outputting a SEQUENCE OF INCREMENTAL CHANGES, one JSON object per line.

${DESIGN_PRINCIPLES}

CRITICAL RULES:
- Output one JSON object per line (newline-separated). NO extra text, NO markdown fences, NO commentary.
- Each line is a valid JSON object of type "change", "theme", or "done".
- End with: {"type":"done"}

SUPPORTED CHANGE FORMATS:

Slide background:
{"type":"change","slideIndex":N,"field":"background.value","value":"#hexcolor"}

Element position/size:
{"type":"change","slideIndex":N,"elementId":"elID","field":"x","value":N}
{"type":"change","slideIndex":N,"elementId":"elID","field":"y","value":N}
{"type":"change","slideIndex":N,"elementId":"elID","field":"width","value":N}
{"type":"change","slideIndex":N,"elementId":"elID","field":"height","value":N}

Text formatting:
{"type":"change","slideIndex":N,"elementId":"elID","field":"fontSize","value":N}
{"type":"change","slideIndex":N,"elementId":"elID","field":"color","value":"#hex"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"fontFamily","value":"Inter"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"fontWeight","value":"bold"|"normal"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"fontStyle","value":"italic"|"normal"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"textAlign","value":"left"|"center"|"right"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"lineHeight","value":1.5}
{"type":"change","slideIndex":N,"elementId":"elID","field":"opacity","value":1}

Shape style:
{"type":"change","slideIndex":N,"elementId":"elID","field":"fill","value":"#hex"}
{"type":"change","slideIndex":N,"elementId":"elID","field":"backgroundColor","value":"#hex"}

Images:
{"type":"change","slideIndex":N,"elementId":"elID","field":"src","value":"__STOCK__:search keywords"}

Theme (applied globally):
{"type":"theme","field":"primaryColor","value":"#hex"}
{"type":"theme","field":"backgroundColor","value":"#hex"}
{"type":"theme","field":"fontBody","value":"Inter"}
{"type":"theme","field":"fontTitle","value":"Inter"}

Done marker (must be last line):
{"type":"done"}

DESIGN TASK FOR THIS RUN:
- Change backgrounds on every slide — vary colors across slides
- Adjust layout (x, y, width, height) to create better visual hierarchy
- Adjust font sizes: titles 40-54pt, body 28-32pt for presentation mode
- Apply a coherent color scheme matching your chosen archetype
- Update fonts to match the design archetype (max 2 families)
- Set text alignment and padding for better readability
- Add image placeholders with __STOCK__:keywords where images would improve the slide
- Ensure nothing is cut off (x + width ≤ 100, y + height ≤ 100)
- Ensure WCAG AA contrast (4.5:1 minimum)
- Process slides in order, output all changes for slide 0, then slide 1, etc.
- Change the ELEMENT ID in the response to match the EXACT element IDs from the input presentation`;

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

    const userMessage = themeContext
      ? `Apply this theme context: ${themeContext}\n\nPresentation:\n${JSON.stringify(presentation)}`
      : JSON.stringify(presentation);

    // Call DeepSeek with streaming
    const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: STREAMING_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 64000,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      return new Response(JSON.stringify({ error: `AI service error: ${errorText}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    // Create a ReadableStream that proxies DeepSeek's SSE to our simpler SSE format
    const stream = new ReadableStream({
      async start(controller) {
        const reader = deepseekResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let changeCount = 0;
        let streamEnded = false;

        const sendSSE = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            // Parse DeepSeek's SSE format
            // Each event: data: {...json...}\n\n
            const sseEvents = chunk.split('\n');
            for (const line of sseEvents) {
              if (!line.startsWith('data: ')) continue;

              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                streamEnded = true;
                continue;
              }

              try {
                const deepseekData = JSON.parse(dataStr);
                const content = deepseekData.choices?.[0]?.delta?.content || '';

                if (!content) continue;

                buffer += content;

                // Check if we have complete newline-delimited JSON lines
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
                  const jsonLine = buffer.slice(0, newlineIdx).trim();
                  buffer = buffer.slice(newlineIdx + 1);

                  if (!jsonLine) continue;

                  try {
                    const change = JSON.parse(jsonLine);

                    if (change.type === 'done') {
                      streamEnded = true;
                    } else if (change.type === 'change' || change.type === 'theme') {
                      changeCount++;
                      sendSSE(change);

                      // Send progress update every 3 changes
                      if (changeCount % 3 === 0) {
                        sendSSE({ type: 'progress', changes: changeCount });
                      }
                    }
                  } catch {
                    // Line wasn't complete JSON yet — put it back and wait for more tokens
                    buffer = jsonLine + '\n' + buffer;
                    break;
                  }
                }
              } catch {
                // Skip unparseable SSE data lines
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const remaining = buffer.trim();
            try {
              const change = JSON.parse(remaining);
              if (change.type === 'change' || change.type === 'theme') {
                changeCount++;
                sendSSE(change);
              }
            } catch {
              // Incomplete JSON at end — ignore
            }
          }

          // Signal done
          sendSSE({ type: 'done', changes: changeCount });
        } catch (err) {
          console.error('Stream processing error:', err);
          sendSSE({ type: 'error', message: 'AI processing failed mid-stream' });
        } finally {
          controller.close();
        }
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
