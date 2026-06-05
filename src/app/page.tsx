'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { v4 as uuid } from 'uuid';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const setPresentation = useStore((s) => s.setPresentation);
  const setFileName = useStore((s) => s.setFileName);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Upload failed');
        }

        const data = await res.json();
        setFileName(data.fileName);
        setPresentation(data.presentation);

        // Navigate to editor
        const sessionId = uuid();
        router.push(`/editor/${sessionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [router, setPresentation, setFileName]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa] p-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">SlideAI</h1>
            <p className="text-xs text-zinc-400">AI-powered presentation designer</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`
            w-full border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragActive
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700">
                {uploading
                  ? 'Uploading and analyzing...'
                  : isDragActive
                    ? 'Drop your file here'
                    : 'Drop your .pptx file here'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {uploading ? 'This may take a moment' : 'or click to browse files'}
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[
            { icon: '🎨', label: 'AI Restyling' },
            { icon: '🖼️', label: 'Stock Images' },
            { icon: '💬', label: 'Chat Editor' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-zinc-100">
              <span className="text-lg">{f.icon}</span>
              <span className="text-[11px] font-medium text-zinc-500">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
