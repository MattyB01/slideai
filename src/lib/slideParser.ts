import type {
  SlidePresentation,
  SlideTheme,
  Slide,
  SlideBackground,
  SlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
} from '@/types/slide';

/* ------------------------------------------------------------------ */
/*  Parsing helpers                                                    */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function includes<T extends string>(arr: readonly T[], val: string): val is T {
  for (const item of arr) {
    if (item === val) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Element parsers                                                    */
/* ------------------------------------------------------------------ */

function parseBaseElement(raw: Record<string, unknown>) {
  return {
    id: asString(raw.id),
    x: asNumber(raw.x),
    y: asNumber(raw.y),
    width: asNumber(raw.width),
    height: asNumber(raw.height),
    rotation: asNumber(raw.rotation, 0),
    zIndex: asNumber(raw.zIndex, 0),
    opacity: asNumber(raw.opacity, 1),
  };
}

function parseTextElement(raw: Record<string, unknown>): TextElement {
  return {
    ...parseBaseElement(raw),
    type: 'text',
    content: asString(raw.content),
    fontSize: asNumber(raw.fontSize, 16),
    fontFamily: asString(raw.fontFamily, 'Arial'),
    fontWeight: raw.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: raw.fontStyle === 'italic' ? 'italic' : 'normal',
    color: asString(raw.color, '#000000'),
    textAlign: includes(['left', 'center', 'right'] as const, raw.textAlign as string)
      ? (raw.textAlign as 'left' | 'center' | 'right')
      : 'left',
    lineHeight: asNumber(raw.lineHeight, 1.4),
    backgroundColor: raw.backgroundColor !== undefined ? asString(raw.backgroundColor) : undefined,
    padding: raw.padding !== undefined ? asNumber(raw.padding) : undefined,
  };
}

function parseImageElement(raw: Record<string, unknown>): ImageElement {
  return {
    ...parseBaseElement(raw),
    type: 'image',
    src: asString(raw.src),
    alt: asString(raw.alt, ''),
    objectFit: includes(['cover', 'contain', 'fill'] as const, raw.objectFit as string)
      ? (raw.objectFit as 'cover' | 'contain' | 'fill')
      : 'cover',
    borderRadius: raw.borderRadius !== undefined ? asNumber(raw.borderRadius) : undefined,
    source: includes(['generated', 'stock', 'uploaded'] as const, raw.source as string)
      ? (raw.source as 'generated' | 'stock' | 'uploaded')
      : 'generated',
    attribution: raw.attribution !== undefined ? asString(raw.attribution) : undefined,
  };
}

function parseShapeElement(raw: Record<string, unknown>): ShapeElement {
  return {
    ...parseBaseElement(raw),
    type: 'shape',
    shape: includes(['rectangle', 'circle', 'triangle', 'line'] as const, raw.shape as string)
      ? (raw.shape as 'rectangle' | 'circle' | 'triangle' | 'line')
      : 'rectangle',
    fill: asString(raw.fill, '#cccccc'),
    stroke: raw.stroke !== undefined ? asString(raw.stroke) : undefined,
    strokeWidth: raw.strokeWidth !== undefined ? asNumber(raw.strokeWidth) : undefined,
  };
}

function parseElement(raw: unknown): SlideElement {
  if (!isRecord(raw)) {
    throw new Error(`Invalid element: expected an object, got ${typeof raw}`);
  }

  const type = asString(raw.type);

  switch (type) {
    case 'text':
      return parseTextElement(raw);
    case 'image':
      return parseImageElement(raw);
    case 'shape':
      return parseShapeElement(raw);
    default:
      // Graceful fallback: treat unknown types as text elements
      console.warn(`Unknown element type "${type}", treating as text`);
      return parseTextElement({ ...raw, type: 'text' });
  }
}

/* ------------------------------------------------------------------ */
/*  Slide parsers                                                      */
/* ------------------------------------------------------------------ */

function parseBackground(raw: unknown): SlideBackground {
  if (!isRecord(raw)) {
    return { type: 'color', value: '#ffffff' };
  }
  const type = raw.type as string;
  return {
    type: (['color', 'gradient', 'image'] as const).includes(type as 'color' | 'gradient' | 'image')
      ? (type as 'color' | 'gradient' | 'image')
      : 'color',
    value: asString(raw.value, '#ffffff'),
  };
}

function parseSlide(raw: unknown, index: number): Slide {
  if (!isRecord(raw)) {
    throw new Error(`Invalid slide at index ${index}: expected an object`);
  }

  const elementsRaw = Array.isArray(raw.elements) ? raw.elements : [];
  const elements: SlideElement[] = elementsRaw.map((e: unknown, i: number) => {
    try {
      return parseElement(e);
    } catch (err) {
      console.warn(`Failed to parse element at index ${i} in slide ${index}:`, err);
      // Return a minimal text element so the slide doesn't break
      return {
        id: `fallback-${i}`,
        type: 'text' as const,
        x: 0,
        y: 0,
        width: 400,
        height: 40,
        rotation: 0,
        zIndex: 0,
        opacity: 1,
        content: '[Unparseable element]',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal' as const,
        fontStyle: 'normal' as const,
        color: '#000000',
        textAlign: 'left' as const,
        lineHeight: 1.4,
      };
    }
  });

  return {
    id: asString(raw.id, `slide-${index}`),
    index,
    background: parseBackground(raw.background),
    elements,
    speakerNotes: raw.speakerNotes !== undefined ? asString(raw.speakerNotes) : undefined,
  };
}

function parseTheme(raw: unknown): SlideTheme {
  if (!isRecord(raw)) {
    // Return a sensible default theme
    return {
      primaryColor: '#1a73e8',
      secondaryColor: '#34a853',
      accentColor: '#ea4335',
      backgroundColor: '#ffffff',
      fontTitle: 'Arial',
      fontBody: 'Arial',
      borderRadius: 8,
    };
  }
  return {
    primaryColor: asString(raw.primaryColor, '#1a73e8'),
    secondaryColor: asString(raw.secondaryColor, '#34a853'),
    accentColor: asString(raw.accentColor, '#ea4335'),
    backgroundColor: asString(raw.backgroundColor, '#ffffff'),
    fontTitle: asString(raw.fontTitle, 'Arial'),
    fontBody: asString(raw.fontBody, 'Arial'),
    borderRadius: asNumber(raw.borderRadius, 8),
  };
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse the raw JSON response from the Python PPTX processing service
 * into a strongly-typed SlidePresentation object.
 *
 * Accepts either a parsed object (already JSON.parsed) or a JSON string.
 */
export function parsePresentation(raw: string | Record<string, unknown>): SlidePresentation {
  const data: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!isRecord(data)) {
    throw new Error('Invalid presentation: expected a JSON object');
  }

  const slidesRaw: unknown[] = Array.isArray(data.slides) ? data.slides : [];
  const slides: Slide[] = slidesRaw.map((s, i) => parseSlide(s, i));

  return {
    id: asString(data.id, 'presentation-1'),
    title: asString(data.title, 'Untitled Presentation'),
    theme: parseTheme(data.theme),
    slides,
  };
}

export default parsePresentation;
