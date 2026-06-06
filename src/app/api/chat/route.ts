import { NextRequest } from 'next/server';

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

const STREAMING_SYSTEM_PROMPT_ALL = `You are an AI presentation editor. The user wants to modify the ENTIRE presentation.

When the user requests a change, output a SEQUENCE OF INCREMENTAL CHANGES, one JSON object per line.

CRITICAL RULES:
- Output one JSON object per line (newline-separated). NO extra text, NO markdown fences, NO commentary.
- Each line is a valid JSON object of type "change", "theme", or "done".
- End with: {"type":"done"}

SUPPORTED FORMATS:

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
{"type":"change","slideIndex":N,"elementId":"elID","field":"opacity","value":1}

Images:
{"type":"change","slideIndex":N,"elementId":"elID","field":"src","value":"__STOCK__:search keywords"}

Theme (applied globally):
{"type":"theme","field":"primaryColor","value":"#hex"}
{"type":"theme","field":"backgroundColor","value":"#hex"}
{"type":"theme","field":"fontBody","value":"Inter"}

Done marker (must be last line):
{"type":"done"}

Rules:
1. Return the COMPLETE set of changes — not just the ones the user asked for.
2. Preserve all text content unless the user asks to change it.
3. Do NOT remove images unless asked.
4. Only output the change lines. No other text.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, slideIndex, presentation, scope, stream } = body;

    if (!message || !presentation) {
      return new Response(JSON.stringify({ error: 'Message and presentation required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userContent = JSON.stringify({
      message,
      currentSlideIndex: slideIndex ?? 0,
      presentation,
      scope: scope ?? 'slide',
    });

    // If streaming requested for whole-show scope
    if (stream === true && scope === 'all') {
      const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: STREAMING_SYSTEM_PROMPT_ALL },
            { role: 'user', content: userContent },
          ],
          stream: true,
          temperature: 0.5,
          max_tokens: 32000,
        }),
      });

      if (!deepseekResponse.ok) {
        const errorText = await deepseekResponse.text();
        return new Response(JSON.stringify({ error: `AI error: ${errorText}` }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const encoder = new TextEncoder();
      const stream2 = new ReadableStream({
        async start(controller) {
          const reader = deepseekResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let changeCount = 0;

          const sendSSE = (data: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const sseEvents = chunk.split('\n');

              for (const line of sseEvents) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const deepseekData = JSON.parse(dataStr);
                  const content = deepseekData.choices?.[0]?.delta?.content || '';
                  if (!content) continue;

                  buffer += content;

                  let newlineIdx;
                  while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
                    const jsonLine = buffer.slice(0, newlineIdx).trim();
                    buffer = buffer.slice(newlineIdx + 1);
                    if (!jsonLine) continue;

                    try {
                      const change = JSON.parse(jsonLine);
                      if (change.type === 'done') {
                        sendSSE({ type: 'done', changes: changeCount });
                        controller.close();
                        return;
                      }
                      if (change.type === 'change' || change.type === 'theme') {
                        changeCount++;
                        sendSSE(change);
                        if (changeCount % 3 === 0) {
                          sendSSE({ type: 'progress', changes: changeCount });
                        }
                      }
                    } catch {
                      buffer = jsonLine + '\n' + buffer;
                      break;
                    }
                  }
                } catch {}
              }
            }

            if (buffer.trim()) {
              try {
                const change = JSON.parse(buffer.trim());
                if (change.type === 'change' || change.type === 'theme') {
                  changeCount++;
                  sendSSE(change);
                }
              } catch {}
            }

            sendSSE({ type: 'done', changes: changeCount });
          } catch (err) {
            console.error('Chat stream error:', err);
            sendSSE({ type: 'error', message: 'Chat processing failed mid-stream' });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream2, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming (slide scope or fallback)
    const systemPrompt = scope === 'all' ? STREAMING_SYSTEM_PROMPT_ALL : SYSTEM_PROMPT_SLIDE;

    const llmResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
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
    const content = data.choices?.[0]?.message?.content;

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
