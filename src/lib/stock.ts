import type { ImageElement } from '@/types/slide';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StockImage {
  /** Unique identifier from the source API */
  id: string;
  /** Direct image download URL */
  url: string;
  /** Small preview (for thumbnails) */
  previewUrl: string;
  /** Photographer's full name for attribution */
  photographer: string;
  /** Link to the photographer's profile or original page */
  photographerUrl: string;
  /** API source: 'unsplash' | 'pexels' */
  source: 'unsplash' | 'pexels';
  /** Alt text / description */
  alt: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

export interface StockSearchResult {
  images: StockImage[];
  total: number;
  /** Attribution messages that must be displayed per API terms */
  attribution: string[];
}

/* ------------------------------------------------------------------ */
/*  API Keys                                                           */
/* ------------------------------------------------------------------ */

function getUnsplashKey(): string {
  if (typeof process !== 'undefined' && process.env?.UNSPLASH_ACCESS_KEY) {
    return process.env.UNSPLASH_ACCESS_KEY;
  }
  // Demo / dev-only fallback — replace in production
  console.warn('UNSPLASH_ACCESS_KEY not set, using demo fallback');
  return 'demo';
}

function getPexelsKey(): string {
  if (typeof process !== 'undefined' && process.env?.PEXELS_API_KEY) {
    return process.env.PEXELS_API_KEY;
  }
  console.warn('PEXELS_API_KEY not set, using demo fallback');
  return 'demo';
}

/* ------------------------------------------------------------------ */
/*  Unsplash client                                                    */
/* ------------------------------------------------------------------ */

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    links: { html: string };
  };
  alt_description: string | null;
  width: number;
  height: number;
  links: { html: string };
}

interface UnsplashResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

async function searchUnsplash(query: string): Promise<StockImage[]> {
  const key = getUnsplashKey();

  if (!key || key === 'demo') {
    console.warn('Unsplash API key missing — skipping Unsplash search');
    return [];
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
  });

  if (!response.ok) {
    console.error(`Unsplash API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data: UnsplashResponse = await response.json();

  return (data.results ?? []).map((photo) => ({
    id: `unsplash-${photo.id}`,
    url: photo.urls.regular,
    previewUrl: photo.urls.thumb,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
    source: 'unsplash' as const,
    alt: photo.alt_description ?? 'Stock photo from Unsplash',
    width: photo.width,
    height: photo.height,
  }));
}

/* ------------------------------------------------------------------ */
/*  Pexels client                                                      */
/* ------------------------------------------------------------------ */

interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    tiny: string;
  };
  photographer: string;
  photographer_url: string;
  alt: string | null;
  width: number;
  height: number;
}

interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page: string;
}

async function searchPexels(query: string): Promise<StockImage[]> {
  const key = getPexelsKey();

  if (!key || key === 'demo') {
    console.warn('Pexels API key missing — skipping Pexels search');
    return [];
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`;

  const response = await fetch(url, {
    headers: {
      Authorization: key,
    },
  });

  if (!response.ok) {
    console.error(`Pexels API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data: PexelsResponse = await response.json();

  return (data.photos ?? []).map((photo) => ({
    id: `pexels-${photo.id}`,
    url: photo.src.large,
    previewUrl: photo.src.tiny,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    source: 'pexels' as const,
    alt: photo.alt ?? 'Stock photo from Pexels',
    width: photo.width,
    height: photo.height,
  }));
}

/* ------------------------------------------------------------------ */
/*  Unified search                                                     */
/* ------------------------------------------------------------------ */

/**
 * Search both Unsplash and Pexels in parallel for the given query.
 * Returns merged, deduplicated results with attribution notices.
 *
 * Deduplication is done by comparing the photographer + approximate
 * aspect ratio, since the same photo can appear on both platforms.
 */
export async function searchStock(query: string): Promise<StockSearchResult> {
  const [unsplashResults, pexelsResults] = await Promise.allSettled([
    searchUnsplash(query),
    searchPexels(query),
  ]);

  const unsplashImages: StockImage[] =
    unsplashResults.status === 'fulfilled' ? unsplashResults.value : [];
  const pexelsImages: StockImage[] =
    pexelsResults.status === 'fulfilled' ? pexelsResults.value : [];

  if (unsplashResults.status === 'rejected') {
    console.error('Unsplash search failed:', unsplashResults.reason);
  }
  if (pexelsResults.status === 'rejected') {
    console.error('Pexels search failed:', pexelsResults.reason);
  }

  // Deduplicate: prefer the higher-resolution image when the same
  // photo appears on both services. We use (photographer + aspect)
  // as a heuristic fingerprint.
  const seen = new Set<string>();
  const merged: StockImage[] = [];

  // Sort so higher-resolution images come first
  const allImages = [...unsplashImages, ...pexelsImages].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  );

  for (const img of allImages) {
    const aspect = img.width / img.height;
    // Round aspect to 2 decimals for comparison
    const key = `${img.photographer}|${Math.round(aspect * 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(img);
    }
  }

  // Build required attribution notices per API terms
  const attribution: string[] = [];
  if (unsplashImages.length > 0) {
    attribution.push('Photos provided by Unsplash (https://unsplash.com)');
  }
  if (pexelsImages.length > 0) {
    attribution.push('Photos provided by Pexels (https://www.pexels.com)');
  }

  return {
    images: merged,
    total: merged.length,
    attribution,
  };
}

/* ------------------------------------------------------------------ */
/*  Helper: build attribution string for an ImageElement               */
/* ------------------------------------------------------------------ */

/**
 * Format attribution text suitable for display on a slide,
 * per the Unsplash and Pexels API guidelines.
 */
export function formatAttribution(image: StockImage): string {
  switch (image.source) {
    case 'unsplash':
      return `Photo by ${image.photographer} on Unsplash`;
    case 'pexels':
      return `Photo by ${image.photographer} on Pexels`;
    default:
      return `Photo by ${image.photographer}`;
  }
}

/**
 * Convert a StockImage to a partial ImageElement for inserting
 * into a slide.
 */
export function stockImageToElement(
  image: StockImage,
  x = 0,
  y = 0,
  width = 400,
  height = 300,
): Partial<ImageElement> {
  return {
    type: 'image',
    src: image.url,
    alt: image.alt,
    objectFit: 'cover',
    source: 'stock',
    attribution: formatAttribution(image),
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
  };
}

export default {
  searchStock,
  formatAttribution,
  stockImageToElement,
};
