import { NextRequest, NextResponse } from 'next/server';

// Placeholder for AI image generation (DALL·E / Stability AI)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    // MVP: return a placeholder - wire up DALL·E 3 or Stability AI when API keys are configured
    return NextResponse.json({
      image: null,
      note: 'AI image generation requires OpenAI DALL·E 3 or Stability AI API key. Configure OPENAI_API_KEY or STABILITY_API_KEY in .env.local',
      placeholder: `https://placehold.co/800x600/3b82f6/ffffff?text=${encodeURIComponent(prompt.substring(0, 50))}`,
    });
  } catch (error) {
    console.error('Generate image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
