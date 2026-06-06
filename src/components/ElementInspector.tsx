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
  const addElement = useStore((s) => s.addElement);

  const activeSlide = presentation?.slides[activeSlideIndex] ?? null;
  const selectedElement = activeSlide?.elements.find(
    (el) => el.id === selectedElementId,
  ) ?? null;

  if (!presentation) return null;

  const handleChange = (field: string, value: unknown) => {
    if (selectedElement) {
      updateElement(activeSlideIndex, selectedElement.id, { [field]: value });
    }
  };

  const handleDelete = () => {
    if (!selectedElement) return;
    removeElement(activeSlideIndex, selectedElement.id);
    selectElement(null);
  };

  const handleAddText = () => {
    const newEl: TextElement = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'text',
      x: 10, y: 10, width: 40, height: 15,
      rotation: 0, zIndex: activeSlide?.elements.length ?? 0, opacity: 1,
      content: 'New Text',
      fontSize: 24, fontFamily: 'Arial',
      fontWeight: 'normal', fontStyle: 'normal',
      color: '#000000', textAlign: 'center', lineHeight: 1.4,
    };
    addElement(activeSlideIndex, newEl);
    selectElement(newEl.id);
  };

  const handleAddShape = () => {
    const newEl: ShapeElement = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'shape',
      x: 20, y: 20, width: 30, height: 30,
      rotation: 0, zIndex: activeSlide?.elements.length ?? 0, opacity: 1,
      shape: 'rectangle', fill: '#3b82f6',
    };
    addElement(activeSlideIndex, newEl);
    selectElement(newEl.id);
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newEl: ImageElement = {
          id: Math.random().toString(36).substring(2, 11),
          type: 'image',
          x: 20, y: 20, width: 40, height: 30,
          rotation: 0, zIndex: activeSlide?.elements.length ?? 0, opacity: 1,
          src: ev.target?.result as string,
          alt: file.name, objectFit: 'cover',
          source: 'uploaded',
        };
        addElement(activeSlideIndex, newEl);
        selectElement(newEl.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Elements</h2>
      </div>

      {/* Add element buttons */}
      <div className="grid grid-cols-3 gap-2 px-3 py-3 border-b border-zinc-100">
        <button onClick={handleAddText} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors" title="Add text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
          <span className="text-[10px] font-medium text-zinc-500">Text</span>
        </button>
        <button onClick={handleAddShape} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors" title="Add shape">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
          <span className="text-[10px] font-medium text-zinc-500">Shape</span>
        </button>
        <button onClick={handleAddImage} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors" title="Add image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          <span className="text-[10px] font-medium text-zinc-500">Image</span>
        </button>
      </div>

      {/* Selected element properties */}
      {selectedElement ? (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{selectedElement.type}</span>
            <button onClick={handleDelete} className="text-[10px] font-medium text-red-500 hover:text-red-700 transition-colors">Delete</button>
          </div>

          {/* Position */}
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Position & Size</label>
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <span className="block text-[9px] text-zinc-400 mb-0.5">X</span>
                <input type="number" value={Math.round(selectedElement.x)} onChange={(e) => handleChange('x', Number(e.target.value))} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <span className="block text-[9px] text-zinc-400 mb-0.5">Y</span>
                <input type="number" value={Math.round(selectedElement.y)} onChange={(e) => handleChange('y', Number(e.target.value))} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <span className="block text-[9px] text-zinc-400 mb-0.5">W</span>
                <input type="number" value={Math.round(selectedElement.width)} onChange={(e) => handleChange('width', Number(e.target.value))} min={1} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <span className="block text-[9px] text-zinc-400 mb-0.5">H</span>
                <input type="number" value={Math.round(selectedElement.height)} onChange={(e) => handleChange('height', Number(e.target.value))} min={1} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Opacity</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={Math.round((selectedElement.opacity ?? 1) * 100)} onChange={(e) => handleChange('opacity', Number(e.target.value) / 100)} className="flex-1 h-1.5 appearance-none bg-zinc-200 rounded-full cursor-pointer accent-blue-600" />
              <span className="text-[10px] text-zinc-400 w-6 text-right tabular-nums">{Math.round((selectedElement.opacity ?? 1) * 100)}</span>
            </div>
          </div>

          {/* Text-specific */}
          {selectedElement.type === 'text' && (
            <>
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Font</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="col-span-2">
                    <select value={(selectedElement as TextElement).fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      {['Arial', 'Inter', 'Roboto', 'Helvetica', 'Times New Roman', 'Georgia', 'Poppins', 'DM Sans'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-400 mb-0.5">Size</span>
                    <input type="number" value={(selectedElement as TextElement).fontSize} onChange={(e) => handleChange('fontSize', Number(e.target.value))} min={8} max={200} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-400 mb-0.5">Color</span>
                    <input type="color" value={(selectedElement as TextElement).color} onChange={(e) => handleChange('color', e.target.value)} className="w-full h-[26px] rounded border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5" />
                  </div>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="block text-[9px] text-zinc-400 mb-0.5">Weight</span>
                    <select value={(selectedElement as TextElement).fontWeight} onChange={(e) => handleChange('fontWeight', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-400 mb-0.5">Style</span>
                    <select value={(selectedElement as TextElement).fontStyle} onChange={(e) => handleChange('fontStyle', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[9px] text-zinc-400 mb-0.5">Align</span>
                    <select value={(selectedElement as TextElement).textAlign} onChange={(e) => handleChange('textAlign', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Background color for text */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1">Background</label>
                <input type="color" value={(selectedElement as TextElement).backgroundColor || '#ffffff'} onChange={(e) => handleChange('backgroundColor', e.target.value)} className="w-full h-[26px] rounded border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5" />
              </div>
            </>
          )}

          {/* Shape-specific */}
          {selectedElement.type === 'shape' && (
            <>
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1">Shape Type</label>
                <select value={(selectedElement as ShapeElement).shape} onChange={(e) => handleChange('shape', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                  <option value="triangle">Triangle</option>
                  <option value="line">Line</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1">Fill Color</label>
                <input type="color" value={(selectedElement as ShapeElement).fill} onChange={(e) => handleChange('fill', e.target.value)} className="w-full h-[26px] rounded border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5" />
              </div>
              {(selectedElement as ShapeElement).stroke !== undefined && (
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">Stroke</label>
                  <input type="color" value={(selectedElement as ShapeElement).stroke || '#000000'} onChange={(e) => handleChange('stroke', e.target.value)} className="w-full h-[26px] rounded border border-zinc-200 bg-zinc-50 cursor-pointer p-0.5" />
                </div>
              )}
            </>
          )}

          {/* Image-specific */}
          {selectedElement.type === 'image' && (
            <div>
              <label className="block text-[10px] font-medium text-zinc-400 mb-1">Object Fit</label>
              <select value={(selectedElement as ImageElement).objectFit} onChange={(e) => handleChange('objectFit', e.target.value)} className="w-full px-1.5 py-1 text-[11px] rounded border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-400 text-center px-4">Click an element on the canvas to edit its properties</p>
        </div>
      )}
    </div>
  );
}
