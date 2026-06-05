import type {
  SlidePresentation,
  Slide,
  SlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  SlideTheme,
} from '@/types/slide';

/* ------------------------------------------------------------------ */
/*  Slide-level CSS                                                    */
/* ------------------------------------------------------------------ */

export interface SlideCSS {
  /** Styles for the slide container <div> */
  container: React.CSSProperties;
  /** Styles for the slide background layer */
  background: React.CSSProperties;
  /** Per-element styles keyed by element id */
  elements: Record<string, React.CSSProperties>;
}

/**
 * Compute CSS styles for every slide in the presentation.
 * Returns an array parallel to presentation.slides.
 */
export function renderPresentation(
  presentation: SlidePresentation,
  viewportWidth: number = 960,
  viewportHeight: number = 540,
): SlideCSS[] {
  const aspectRatio = viewportWidth / viewportHeight;
  return presentation.slides.map((slide) =>
    renderSlide(slide, presentation.theme, aspectRatio),
  );
}

/**
 * Compute CSS styles for a single slide.
 */
export function renderSlide(
  slide: Slide,
  theme: SlideTheme,
  aspectRatio: number = 16 / 9,
): SlideCSS {
  const container: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '960px',
    aspectRatio: `${aspectRatio}`,
    overflow: 'hidden',
    borderRadius: theme.borderRadius,
    fontFamily: theme.fontBody,
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
  };

  const background = getBackgroundStyle(slide.background, theme);

  const elements: Record<string, React.CSSProperties> = {};
  for (const element of slide.elements) {
    elements[element.id] = getElementStyle(element, theme);
  }

  return { container, background, elements };
}

/* ------------------------------------------------------------------ */
/*  Background styling                                                 */
/* ------------------------------------------------------------------ */

function getBackgroundStyle(
  bg: Slide['background'],
  theme: SlideTheme,
): React.CSSProperties {
  switch (bg.type) {
    case 'color':
      return {
        position: 'absolute',
        inset: 0,
        backgroundColor: bg.value || theme.backgroundColor,
      };

    case 'gradient': {
      // The value is a CSS gradient string (e.g. "linear-gradient(...)")
      // If it doesn't look like a gradient, apply it as a color fallback
      const isGradient = bg.value?.includes('gradient');
      return {
        position: 'absolute',
        inset: 0,
        background: isGradient ? bg.value : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
      };
    }

    case 'image':
      return {
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${bg.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };

    default:
      return {
        position: 'absolute',
        inset: 0,
        backgroundColor: theme.backgroundColor,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Element styling                                                    */
/* ------------------------------------------------------------------ */

function getElementStyle(
  element: SlideElement,
  theme: SlideTheme,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    opacity: element.opacity,
  };

  switch (element.type) {
    case 'text':
      return getTextElementStyle(element, base, theme);
    case 'image':
      return getImageElementStyle(element, base);
    case 'shape':
      return getShapeElementStyle(element, base);
    default:
      return base;
  }
}

function getTextElementStyle(
  el: TextElement,
  base: React.CSSProperties,
  theme: SlideTheme,
): React.CSSProperties {
  return {
    ...base,
    fontFamily: el.fontFamily || theme.fontBody,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    color: el.color,
    textAlign: el.textAlign,
    lineHeight: el.lineHeight,
    backgroundColor: el.backgroundColor,
    padding: el.padding,
    overflow: 'hidden',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    display: 'flex',
    alignItems: 'flex-start',
    // If the text element has no explicit background, keep transparent
    background: el.backgroundColor || 'transparent',
  };
}

function getImageElementStyle(
  el: ImageElement,
  base: React.CSSProperties,
): React.CSSProperties {
  const styles: React.CSSProperties = {
    ...base,
    overflow: 'hidden',
    borderRadius: el.borderRadius,
  };

  // The image itself will be rendered as an <img> or <div> with background-image
  // We include both approaches for flexibility:
  styles.backgroundImage = `url(${el.src})`;
  styles.backgroundSize = el.objectFit;
  styles.backgroundPosition = 'center';
  styles.backgroundRepeat = 'no-repeat';

  return styles;
}

function getShapeElementStyle(
  el: ShapeElement,
  base: React.CSSProperties,
): React.CSSProperties {
  const styles: React.CSSProperties = {
    ...base,
    backgroundColor: el.fill,
    border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : undefined,
  };

  switch (el.shape) {
    case 'circle':
      styles.borderRadius = '50%';
      break;
    case 'triangle': {
      // CSS triangle using clip-path
      styles.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
      styles.backgroundColor = el.fill;
      break;
    }
    case 'line': {
      // Thin horizontal line by default
      styles.height = `${el.strokeWidth ?? 2}px`;
      styles.backgroundColor = el.stroke || el.fill;
      styles.border = 'none';
      break;
    }
    case 'rectangle':
    default:
      styles.borderRadius = el.fill ? undefined : undefined;
      break;
  }

  return styles;
}

/* ------------------------------------------------------------------ */
/*  Theme-to-CSS utility                                               */
/* ------------------------------------------------------------------ */

/**
 * Convert the SlideTheme into CSS custom properties so they can be
 * applied at the :root or a wrapper <div> level.
 */
export function themeToCSSVariables(theme: SlideTheme): Record<string, string> {
  return {
    '--slide-primary': theme.primaryColor,
    '--slide-secondary': theme.secondaryColor,
    '--slide-accent': theme.accentColor,
    '--slide-bg': theme.backgroundColor,
    '--slide-font-title': theme.fontTitle,
    '--slide-font-body': theme.fontBody,
    '--slide-radius': `${theme.borderRadius}px`,
  };
}

/* ------------------------------------------------------------------ */
/*  Default empty slide (for placeholders)                             */
/* ------------------------------------------------------------------ */

export function getEmptySlideCSS(): SlideCSS {
  return {
    container: {
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 8,
      color: '#999',
      fontSize: 18,
      fontFamily: 'Arial, sans-serif',
    },
    background: {
      position: 'absolute',
      inset: 0,
      backgroundColor: '#f5f5f5',
    },
    elements: {},
  };
}

export default {
  renderPresentation,
  renderSlide,
  themeToCSSVariables,
  getEmptySlideCSS,
};
