'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, canUndo, themePresets } from '@/lib/store';
import { streamAI } from '@/lib/streamAI';
import type { SlideTheme } from '@/types/slide';

export default function Toolbar() {
  const presentation = useStore((s) => s.presentation);
  const fileName = useStore((s) => s.fileName);
  const undo = useStore((s) => s.undo);
  const applyTheme = useStore((s) => s.applyTheme);
  const isAILoading = useStore((s) => s.isAILoading);
  const aiProgress = useStore((s) => s.aiProgress);
  const setAILoading = useStore((s) => s.setAILoading);
  const setAIProgress = useStore((s) => s.setAIProgress);
  const pushHistorySnapshot = useStore((s) => s.pushHistorySnapshot);
  const applyStreamChange = useStore((s) => s.applyStreamChange);
  const applyThemeField = useStore((s) => s.applyThemeField);

  const state = useStore.getState();
  const hasHistory = canUndo(state);

  const [themeOpen, setThemeOpen] = useState(false);
  const [restyling, setRestyling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find current theme name from presets
  const currentTheme = presentation?.theme;
  const currentPreset = themePresets.find(
    (p) =>
      p.theme.primaryColor === currentTheme?.primaryColor &&
      p.theme.fontBody === currentTheme?.fontBody
  );
  const themeLabel = currentPreset?.name ?? 'Custom';

  const handleExport = async () => {
    const p = useStore.getState().presentation;
    if (!p) return;
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation: p }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Export failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName || 'presentation'}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleThemeSelect = async (theme: SlideTheme, presetName: string) => {
    applyTheme(theme);
    setThemeOpen(false);

    // Auto-trigger AI Restyle with the selected theme context
    const p = useStore.getState().presentation;
    if (!p) return;

    setRestyling(true);
    setAILoading(true);
    pushHistorySnapshot();

    const controller = new AbortController();
    abortRef.current = controller;

    await streamAI(
      '/api/process',
      {
        presentation: p,
        themeContext: `Apply the "${presetName}" theme: primary=${theme.primaryColor}, background=${theme.backgroundColor}, font=${theme.fontBody}. Style all slides to match this theme.`,
      },
      {
        onChange: (change) => useStore.getState().applyStreamChange(change as any),
        onThemeChange: (field, value) => useStore.getState().applyThemeField(field, value),
        onProgress: (changes) => setAIProgress({ changes }),
        onDone: () => {},
        onError: (err) => alert(`Restyle error: ${err.message}`),
      },
      controller.signal,
    );

    abortRef.current = null;
    setRestyling(false);
    setAILoading(false);
  };

  const startRestyle = useCallback(async () => {
    const p = useStore.getState().presentation;
    if (!p) return;

    setRestyling(true);
    setAILoading(true);
    pushHistorySnapshot();

    const controller = new AbortController();
    abortRef.current = controller;

    await streamAI(
      '/api/process',
      { presentation: p },
      {
        onChange: (change) => useStore.getState().applyStreamChange(change as any),
        onThemeChange: (field, value) => useStore.getState().applyThemeField(field, value),
        onProgress: (changes) => setAIProgress({ changes }),
        onDone: () => {},
        onError: (err) => alert(`Restyle error: ${err.message}`),
      },
      controller.signal,
    );

    abortRef.current = null;
    setRestyling(false);
    setAILoading(false);
  }, []);

  const stopRestyle = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRestyling(false);
    setAILoading(false);
  };

  const displayName = fileName || presentation?.title || 'Untitled';

  return (
    <header className="h-12 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
        </div>
        <span className="font-semibold text-sm text-zinc-900 tracking-tight">SlideAI</span>
      </div>

      <div className="w-px h-5 bg-zinc-200" />
      <span className="text-sm text-zinc-600 font-medium truncate max-w-[160px]">{displayName}</span>
      <div className="flex-1" />

      {/* AI progress indicator */}
      {isAILoading && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <span>Restyling{aiProgress ? ` (${aiProgress.changes} changes)` : ''}…</span>
        </div>
      )}

      {/* Undo */}
      <button onClick={undo} disabled={!hasHistory} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors duration-150" title="Undo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
        Undo
      </button>

      <div className="w-px h-5 bg-zinc-200" />

      {/* Theme presets dropdown */}
      <div className="relative" ref={themeRef}>
        <button onClick={() => setThemeOpen(!themeOpen)} disabled={isAILoading} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          <span className="text-zinc-700 font-medium">{themeLabel}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${themeOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {themeOpen && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-zinc-200 rounded-xl shadow-lg shadow-zinc-200/50 z-50 py-1.5">
            <div className="px-3 pb-1.5 border-b border-zinc-100 mb-1.5">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Theme Presets</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Selecting a theme will auto-restyle the show</p>
            </div>
            {themePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleThemeSelect(preset.theme, preset.name)}
                disabled={isAILoading}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
              >
                <div className="w-6 h-6 rounded-md border border-zinc-200 shrink-0" style={{ backgroundColor: preset.theme.primaryColor }} />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-zinc-800">{preset.name}</span>
                  <span className="text-[11px] text-zinc-400">{preset.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Restyle / Stop */}
      {isAILoading ? (
        <button onClick={stopRestyle} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-all duration-150">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          Stop
        </button>
      ) : (
        <button onClick={startRestyle} disabled={restyling} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 disabled:opacity-60 disabled:cursor-wait transition-all duration-150">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3h.01" /><path d="M16.5 3h.01" /><path d="M20.5 4.5h.01" /><path d="M19 8.5h.01" /><path d="M21 12h.01" /><path d="M18 16.5h.01" /><path d="M6.5 19.5h.01" /><path d="M3 15h.01" /><path d="M4.5 9h.01" /><path d="M3 6h.01" /><path d="M8.5 3h.01" /><path d="m9 9 6 6" /><path d="m9 15 6-6" /></svg>
          AI Restyle
        </button>
      )}

      <div className="w-px h-5 bg-zinc-200" />

      {/* Export */}
      <button onClick={handleExport} disabled={isAILoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        Export
      </button>
    </header>
  );
}
