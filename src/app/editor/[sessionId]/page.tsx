'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import Toolbar from '@/components/Toolbar';
import SlidePanel from '@/components/SlidePanel';
import SlideEditor from '@/components/SlideEditor';
import ChatPanel from '@/components/ChatPanel';
import ElementInspector from '@/components/ElementInspector';

export default function EditorPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const presentation = useStore((s) => s.presentation);
  const selectedElementId = useStore((s) => s.selectedElementId);

  // If no presentation is loaded, show a message
  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-700">No presentation loaded</h3>
          <p className="text-sm text-zinc-400">
            Upload a .pptx file from the home page to get started.
          </p>
          <a
            href="/"
            className="mt-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Slide Thumbnails */}
        <SlidePanel />

        {/* Center: Slide Canvas */}
        <SlideEditor />

        {/* Right: AI Chat */}
        <ChatPanel />
      </div>

      {/* Bottom: Element Inspector */}
      {selectedElementId && <ElementInspector />}
    </div>
  );
}
