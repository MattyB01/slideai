'use client';

import { useState, useCallback } from 'react';

interface StockPhoto {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

interface ImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, attribution?: string) => void;
}

type Tab = 'stock' | 'generate' | 'upload';

// Mock stock photos for the demo
const MOCK_PHOTOS: StockPhoto[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=150&fit=crop', alt: 'Mountain landscape', photographer: 'Eberhard Grossgasteiger', photographerUrl: 'https://unsplash.com/@eberhardgross' },
  { id: '2', url: 'https://images.unsplash.com/photo-1504198266287-1659872e6590?w=800', thumb: 'https://images.unsplash.com/photo-1504198266287-1659872e6590?w=200&h=150&fit=crop', alt: 'City skyline', photographer: 'Jonatan Pie', photographerUrl: 'https://unsplash.com/@r3dmax' },
  { id: '3', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', thumb: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=200&h=150&fit=crop', alt: 'Starry night', photographer: 'Eberhard Grossgasteiger', photographerUrl: 'https://unsplash.com/@eberhardgross' },
  { id: '4', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800', thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&h=150&fit=crop', alt: 'Forest trail', photographer: 'Neil Thomas', photographerUrl: 'https://unsplash.com/@neilgt' },
  { id: '5', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800', thumb: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=200&h=150&fit=crop', alt: 'Mountain lake', photographer: 'Eberhard Grossgasteiger', photographerUrl: 'https://unsplash.com/@eberhardgross' },
  { id: '6', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800', thumb: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=150&fit=crop', alt: 'Sunrise valley', photographer: 'Dan Cristian Pădureț', photographerUrl: 'https://unsplash.com/@dancristian' },
  { id: '7', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=150&fit=crop', alt: 'Tropical beach', photographer: 'Sean Oulashin', photographerUrl: 'https://unsplash.com/@oulashin' },
  { id: '8', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800', thumb: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=200&h=150&fit=crop', alt: 'Mountain road', photographer: 'Lukas Neasi', photographerUrl: 'https://unsplash.com/@lukas_neasi' },
  { id: '9', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800', thumb: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=150&fit=crop', alt: 'Ocean waves', photographer: 'Dave Hoefler', photographerUrl: 'https://unsplash.com/@davehoefler' },
  { id: '10', url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800', thumb: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=200&h=150&fit=crop', alt: 'Autumn lake', photographer: 'Alexander Kozlov', photographerUrl: 'https://unsplash.com/@alexander_kozlov' },
  { id: '11', url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800', thumb: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=200&h=150&fit=crop', alt: 'Mountain river', photographer: 'Tobias Bjørkli', photographerUrl: 'https://unsplash.com/@tobiasbjorkli' },
  { id: '12', url: 'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800', thumb: 'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=200&h=150&fit=crop', alt: 'Ocean horizon', photographer: 'Sofia Akash', photographerUrl: 'https://unsplash.com/@akash_sofia' },
];

export default function ImagePicker({ isOpen, onClose, onSelect }: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<StockPhoto | null>(null);

  const filteredPhotos = MOCK_PHOTOS.filter(
    (p) =>
      p.alt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.photographer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleConfirm = useCallback(() => {
    if (selectedImage) {
      onSelect(selectedImage.url, `Photo by ${selectedImage.photographer}`);
      onClose();
    }
  }, [selectedImage, onSelect, onClose]);

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'stock', label: 'Stock Photos' },
    { id: 'generate', label: 'AI Generate' },
    { id: 'upload', label: 'Upload' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900">Insert Image</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-zinc-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedImage(null); }}
              className={`
                px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${activeTab === tab.id
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'stock' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search stock photos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="
                    w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200
                    bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                    transition-colors duration-150
                  "
                />
              </div>

              {/* Grid */}
              <div className="grid grid-cols-4 gap-2">
                {filteredPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedImage(photo)}
                    className={`
                      relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all duration-150
                      ${selectedImage?.id === photo.id
                        ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                        : 'border-transparent hover:border-zinc-300'
                      }
                    `}
                  >
                    <img
                      src={photo.thumb}
                      alt={photo.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selectedImage?.id === photo.id && (
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {filteredPhotos.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-400">No photos found for "{searchQuery}"</p>
                </div>
              )}

              {/* Attribution */}
              {selectedImage && (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-xs text-zinc-500">
                    Photo by{' '}
                    <a
                      href={selectedImage.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {selectedImage.photographer}
                    </a>{' '}
                    on Unsplash
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-700 mb-1">AI Image Generation</h3>
              <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
                Describe the image you want and AI will generate it for your slide.
              </p>
              <button
                disabled
                className="mt-4 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-400 text-sm font-medium cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-700 mb-1">Upload from device</h3>
              <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
                Drag and drop an image or click to browse.
              </p>
              <button
                disabled
                className="mt-4 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-400 text-sm font-medium cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedImage}
            className="
              px-5 py-2 text-sm font-medium rounded-lg
              bg-blue-600 text-white
              hover:bg-blue-700 active:bg-blue-800
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
}
