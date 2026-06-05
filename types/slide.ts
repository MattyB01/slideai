export interface SlidePresentation {
  id: string;
  title: string;
  theme: SlideTheme;
  slides: Slide[];
}

export interface SlideTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontTitle: string;
  fontBody: string;
  borderRadius: number;
}

export interface Slide {
  id: string;
  index: number;
  background: SlideBackground;
  elements: SlideElement[];
  speakerNotes?: string;
}

export interface SlideBackground {
  type: 'color' | 'gradient' | 'image';
  value: string;
}

export type SlideElement = TextElement | ImageElement | ShapeElement;

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  backgroundColor?: string;
  padding?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt: string;
  objectFit: 'cover' | 'contain' | 'fill';
  borderRadius?: number;
  source: 'generated' | 'stock' | 'uploaded';
  attribution?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rectangle' | 'circle' | 'triangle' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  changes?: SlideChange[];
  timestamp: Date;
}

export interface SlideChange {
  slideIndex: number;
  elementId: string | null;
  field: string;
  value: unknown;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: SlideTheme;
}
