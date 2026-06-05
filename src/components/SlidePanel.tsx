'use client';

import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import SlideCanvas from './SlideCanvas';

export default function SlidePanel() {
  const presentation = useStore((s) => s.presentation);
  const activeSlideIndex = useStore((s) => s.activeSlideIndex);
  const setActiveSlideIndex = useStore((s) => s.setActiveSlideIndex);
  const addSlide = useStore((s) => s.addSlide);
  const reorderSlides = useStore((s) => s.reorderSlides);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      dragNode.current = e.currentTarget;
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderSlides(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNode.current = null;
  }, [dragIndex, dragOverIndex, reorderSlides]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) {
        reorderSlides(dragIndex, index);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, reorderSlides],
  );

  if (!presentation) return null;

  const slides = presentation.slides;

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      <div className="px-3 py-3 border-b border-zinc-100">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Slides
        </h2>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          {slides.length} slide{slides.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-2">
        {slides.map((slide, index) => {
          const isActive = activeSlideIndex === index;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={slide.id}
              className={`
                rounded-lg cursor-pointer transition-all duration-150
                ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-zinc-50'}
                ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
                ${isDragOver ? 'scale-105 ring-2 ring-blue-300' : ''}
              `}
              onClick={() => setActiveSlideIndex(index)}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="px-2 pt-2 pb-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>
                <div
                  className="overflow-hidden rounded border border-zinc-200"
                  style={{ height: 80, width: 142 }}
                >
                  <div className="scale-[0.148] origin-top-left" style={{ width: 960, height: 540 }}>
                    <SlideCanvas slide={slide} isActive={false} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t border-zinc-100">
        <button
          onClick={addSlide}
          className="
            w-full flex items-center justify-center gap-1.5
            py-2 px-3 rounded-lg
            bg-zinc-900 text-white text-sm font-medium
            hover:bg-zinc-800 active:bg-zinc-700
            transition-colors duration-150
          "
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="7" y1="1" x2="7" y2="13" />
            <line x1="1" y1="7" x2="13" y2="7" />
          </svg>
          Add Slide
        </button>
      </div>
    </div>
  );
}
