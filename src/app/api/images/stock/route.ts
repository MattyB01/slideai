import { NextRequest, NextResponse } from 'next/server';

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query') || 'presentation';

  try {
    const results: Array<{
      id: string;
      url: string;
      preview: string;
      alt: string;
      photographer: string;
      photographerUrl: string;
      source: 'unsplash' | 'pexels';
    }> = [];

    // Search Unsplash in parallel with Pexels
    const promises: Promise<void>[] = [];

    if (UNSPLASH_ACCESS_KEY) {
      promises.push(
        fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12`, {
          headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` },
          signal: AbortSignal.timeout(5000),
        })
          .then((r) => (r.ok ? r.json() : Promise.resolve({ results: [] })))
          .then((data) => {
            for (const photo of data.results || []) {
              results.push({
                id: `unsplash-${photo.id}`,
                url: photo.urls?.regular || photo.urls?.small || '',
                preview: photo.urls?.thumb || photo.urls?.small || '',
                alt: photo.alt_description || query,
                photographer: photo.user?.name || 'Unknown',
                photographerUrl: `https://unsplash.com/@${photo.user?.username}?utm_source=slideai&utm_medium=referral`,
                source: 'unsplash',
              });
            }
          })
          .catch(() => {})
      );
    }

    if (PEXELS_API_KEY) {
      promises.push(
        fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`, {
          headers: { 'Authorization': PEXELS_API_KEY },
          signal: AbortSignal.timeout(5000),
        })
          .then((r) => (r.ok ? r.json() : Promise.resolve({ photos: [] })))
          .then((data) => {
            for (const photo of data.photos || []) {
              results.push({
                id: `pexels-${photo.id}`,
                url: photo.src?.large || photo.src?.original || '',
                preview: photo.src?.tiny || photo.src?.small || '',
                alt: photo.alt || query,
                photographer: photo.photographer || 'Unknown',
                photographerUrl: photo.photographer_url || '',
                source: 'pexels',
              });
            }
          })
          .catch(() => {})
      );
    }

    await Promise.allSettled(promises);

    return NextResponse.json({ images: results });
  } catch (error) {
    console.error('Stock images error:', error);
    return NextResponse.json({ images: [] });
  }
}
