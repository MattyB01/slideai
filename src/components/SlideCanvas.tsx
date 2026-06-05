'use client';

import type { Slide, SlideElement, TextElement, ImageElement, ShapeElement } from '@/types/slide';
import { useStore } from '@/lib/store';

interface SlideCanvasProps {
  slide: Slide;
  isActive: boolean;
  scale?: number;
}

export default function SlideCanvas({ slide, isActive, scale = 1 }: SlideCanvasProps) {
  const presentation = useStore((s) => s.presentation);
  const theme = presentation?.theme ?? null;
  const selectElement = useStore((s) => s.selectElement);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const activeSlideIndex = useStore((s) => s.activeSlideIndex);

  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 540;

  const getBackgroundStyle = (): React.CSSProperties => {
    const bg = slide.background;
    switch (bg.type) {
      case 'color':
        return { backgroundColor: bg.value };
      case 'gradient':
        return { background: bg.value };
      case 'image':
        return {
          backgroundImage: `url(${bg.value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      default:
        return { backgroundColor: '#ffffff' };
    }
  };

  const renderTextElement = (el: TextElement) => {
    const padding = el.padding ?? 8;
    return (
      <div
        key={el.id}
        data-element-id={el.id}
        className={`absolute cursor-pointer transition-shadow ${
          isActive && selectedElementId === el.id
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : isActive
              ? 'hover:ring-1 hover:ring-blue-300'
              : ''
        }`}
        style={{
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          opacity: el.opacity,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          zIndex: el.zIndex,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          color: el.color,
          textAlign: el.textAlign,
          lineHeight: el.lineHeight,
          padding,
          backgroundColor: el.backgroundColor ?? 'transparent',
          borderRadius: theme?.borderRadius ?? 4,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) selectElement(el.id);
        }}
      >
        {el.content}
      </div>
    );
  };

  const renderImageElement = (el: ImageElement) => {
    return (
      <div
        key={el.id}
        data-element-id={el.id}
        className={`absolute cursor-pointer overflow-hidden transition-shadow ${
          isActive && selectedElementId === el.id
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : isActive
              ? 'hover:ring-1 hover:ring-blue-300'
              : ''
        }`}
        style={{
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          opacity: el.opacity,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          zIndex: el.zIndex,
          borderRadius: el.borderRadius ?? theme?.borderRadius ?? 4,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) selectElement(el.id);
        }}
      >
        <img
          src={el.src}
          alt={el.alt}
          className="w-full h-full pointer-events-none"
          style={{
            objectFit: el.objectFit,
            width: '100%',
            height: '100%',
          }}
          draggable={false}
        />
        {el.attribution && (
          <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1 py-0.5 rounded leading-none">
            {el.attribution}
          </span>
        )}
      </div>
    );
  };

  const renderShapeElement = (el: ShapeElement) => {
    let borderRadius = 0;
    let shapeStyle: React.CSSProperties = {};

    switch (el.shape) {
      case 'rectangle':
        borderRadius = theme?.borderRadius ?? 4;
        break;
      case 'circle':
        borderRadius = '50%';
        break;
      case 'triangle':
        shapeStyle = {
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
        };
        break;
      case 'line':
        shapeStyle = {
          height: el.strokeWidth ?? 2,
          alignSelf: 'center',
        };
        break;
    }

    return (
      <div
        key={el.id}
        data-element-id={el.id}
        className={`absolute cursor-pointer transition-shadow ${
          isActive && selectedElementId === el.id
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : isActive
              ? 'hover:ring-1 hover:ring-blue-300'
              : ''
        }`}
        style={{
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          opacity: el.opacity,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          zIndex: el.zIndex,
          backgroundColor: el.fill,
          border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : undefined,
          borderRadius,
          ...shapeStyle,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) selectElement(el.id);
        }}
      />
    );
  };

  const renderElement = (el: SlideElement) => {
    switch (el.type) {
      case 'text':
        return renderTextElement(el);
      case 'image':
        return renderImageElement(el);
      case 'shape':
        return renderShapeElement(el);
      default:
        return null;
    }
  };

  const sortedElements = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      className="relative overflow-hidden bg-white select-none"
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
        ...getBackgroundStyle(),
        outline: isActive ? '3px solid #3b82f6' : '1px solid #e5e7eb',
        outlineOffset: -3,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
      onClick={() => {
        if (isActive) selectElement(null);
      }}
    >
      {sortedElements.map(renderElement)}
    </div>
  );
}
