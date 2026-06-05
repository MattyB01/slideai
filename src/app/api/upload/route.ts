import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

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

    const uploadFormData = new FormData();
    uploadFormData.append('file', file, file.name);

    const response = await fetch(`${PYTHON_SERVICE_URL}/parse`, {
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
    return NextResponse.json({ presentation, fileName: file.name });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
