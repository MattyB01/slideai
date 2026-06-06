import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Files larger than 3MB will skip embedded images to avoid Vercel/browser size limits
const EMBED_IMAGES_THRESHOLD = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.pptx')) {
      return NextResponse.json({ error: 'Only .pptx files are accepted' }, { status: 400 });
    }

    // Decide whether to embed images based on file size
    const embedImages = file.size <= EMBED_IMAGES_THRESHOLD;

    const uploadFormData = new FormData();
    uploadFormData.append('file', file, file.name);

    // Build URL with query params
    const url = new URL(`${PYTHON_SERVICE_URL}/parse`);
    url.searchParams.set('embed_images', String(embedImages));

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: uploadFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Python service error: ${errorText}` },
        { status: 502 }
      );
    }

    const presentation = await response.json();

    // If we skipped images, add a note
    const warnings: string[] = [];
    if (!embedImages) {
      warnings.push('Images were omitted to reduce file size. Use AI Restyle to regenerate visuals.');
    }

    return NextResponse.json({
      presentation,
      fileName: file.name,
      warnings,
      embedImages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
