'use client';

import type React from 'react';
import { useStore } from '@/lib/store';
import type { TextElement, ImageElement, ShapeElement, SlideElement } from '@/types/slide';

export default function ElementInspector() {
  const presentation = useStore((s) => s.presentation);
  const activeSlideIndex = useStore((s) => s.activeSlideIndex);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const selectElement = useStore((s) => s.selectElement);
  const updateElement = useStore((s) => s.updateElement);
  const removeElement = useStore((s) => s.removeElement);

  const activeSlide = presentation?.slides[activeSlideIndex] ?? null;
  const selectedElement = activeSlide?.elements.find(
    (el) => el.id === selectedElementId,
  ) ?? null;

  if (!selectedElement || !presentation) {
    return (
      <div className="h-14 flex items-center justify-center bg-white border-t border-zinc-200">
        <p className="text-xs text-zinc-400">
          Select an element to edit its properties
        </p>
      </div>
    );
  }

  const handleChange = (field: string, value: unknown) => {
    updateElement(activeSlideIndex, selectedElement.id, { [field]: value });
  };

  const handleDelete = () => {
    removeElement(activeSlideIndex, selectedElement.id);
    selectElement(null);
  };

  return (
    <div className="bg-white border-t border-zinc-200 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Element Properties
        </h3>
        <span className="text-[10px] font-mono uppercase text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
          {selectedElement.type}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2.5">
        {/* Position X */}
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-zinc-400 mb-1">X</label>
          <input
            type="number"
            value={Math.round(selectedElement.x)}
            onChange={(e) => handleChange('x', Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Position Y */}
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-zinc-400 mb-1">Y</label>
          <input
            type="number"
            value={Math.round(selectedElement.y)}
            onChange={(e) => handleChange('y', Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Width */}
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-zinc-400 mb-1">W</label>
          <input
            type="number"
            value={Math.round(selectedElement.width)}
            onChange={(e) => handleChange('width', Number(e.target.value))}
            min={1}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Height */}
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-zinc-400 mb-1">H</label>
          <input
            type="number"
            value={Math.round(selectedElement.height)}
            onChange={(e) => handleChange('height', Number(e.target.value))}
            min={1}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Font size (text only) */}
        {selectedElement.type === 'text' && (
          <>
            <div className="col-span-1">
              <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                Font
              </label>
              <input
                type="number"
                value={(selectedElement as TextElement).fontSize}
                onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                min={8}
                max={200}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Color */}
            <div className="col-span-1">
              <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                Color
              </label>
              <input
                type="color"
                value={(selectedElement as TextElement).color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-full h-[30px] rounded-md border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5"
              />
            </div>
          </>
        )}

        {/* Shape fill color */}
        {selectedElement.type === 'shape' && (
          <div className="col-span-1">
            <label className="block text-[10px] font-medium text-zinc-400 mb-1">
              Fill
            </label>
            <input
              type="color"
              value={(selectedElement as ShapeElement).fill}
              onChange={(e) => handleChange('fill', e.target.value)}
              className="w-full h-[30px] rounded-md border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5"
            />
          </div>
        )}

        {/* Opacity */}
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-zinc-400 mb-1">
            Opacity
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((selectedElement.opacity ?? 1) * 100)}
              onChange={(e) => handleChange('opacity', Number(e.target.value) / 100)}
              className="flex-1 h-1.5 appearance-none bg-zinc-200 rounded-full cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] text-zinc-400 w-6 text-right tabular-nums">
              {Math.round((selectedElement.opacity ?? 1) * 100)}
            </span>
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-end">
        <button
          onClick={handleDelete}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            text-xs font-medium text-red-600
            hover:bg-red-50 active:bg-red-100
            transition-colors duration-150
          "
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Delete element
        </button>
      </div>
    </div>
  );
}
