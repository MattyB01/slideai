'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import SlideCanvas from './SlideCanvas';

type ZoomLevel = 'fit' | 50 | 75 | 100 | 150;

export default function SlideEditor() {
  const presentation = useStore((s) => s.presentation);
  const activeSlideIndex = useStore((s) => s.activeSlideIndex);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);

  const containerRef = useRef<HTMLDivElement>(null);

  const activeSlide = presentation?.slides[activeSlideIndex] ?? null;

  const handleZoomTo = useCallback(
    (level: ZoomLevel) => {
      if (level === 'fit') {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const padX = 64;
          const padY = 64;
          const scaleX = (rect.width - padX) / 960;
          const scaleY = (rect.height - padY) / 540;
          const fitScale = Math.min(scaleX, scaleY, 1.5) * 100;
          setZoom(Math.round(fitScale));
        }
      } else {
        setZoom(level);
      }
    },
    [setZoom],
  );

  useEffect(() => {
    handleZoomTo(100);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomPercent = `${zoom}%`;
  const scale = zoom / 100;

  const zoomOptions: { label: string; value: ZoomLevel }[] = [
    { label: 'Fit', value: 'fit' },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '100%', value: 100 },
    { label: '150%', value: 150 },
  ];

  if (!presentation || !activeSlide) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-700">No presentation loaded</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Upload a .pptx file or create a new presentation to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-50">
      {/* Zoom controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-1.5">
          {zoomOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleZoomTo(opt.value)}
              className={`
                px-2.5 py-1 text-xs font-medium rounded-md transition-colors
                ${
                  (opt.value === 'fit' && zoom !== 50 && zoom !== 75 && zoom !== 100 && zoom !== 150)
                    ? 'bg-blue-100 text-blue-700'
                    : opt.value !== 'fit' && zoom === opt.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400 font-medium">{zoomPercent}</span>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-8"
      >
        <div
          className="shrink-0"
          style={{
            width: 960 * scale,
            height: 540 * scale,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: 960,
              height: 540,
            }}
          >
            <SlideCanvas slide={activeSlide} isActive={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
