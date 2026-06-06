import { create } from 'zustand';
import type {
  Slide,
  SlidePresentation,
  SlideElement,
  ChatMessage,
  ThemePreset,
  SlideTheme,
} from '@/types/slide';

export const themePresets: ThemePreset[] = [
  {
    id: 'corporate-clean',
    name: 'Corporate Clean',
    description: 'Professional and minimalist',
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#3b82f6',
      backgroundColor: '#ffffff',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 4,
    },
  },
  {
    id: 'bold-modern',
    name: 'Bold & Modern',
    description: 'High-impact contemporary',
    theme: {
      primaryColor: '#7c3aed',
      secondaryColor: '#f59e0b',
      accentColor: '#ec4899',
      backgroundColor: '#0f172a',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 8,
    },
  },
  {
    id: 'soft-pastel',
    name: 'Soft Pastel',
    description: 'Gentle and inviting',
    theme: {
      primaryColor: '#a78bfa',
      secondaryColor: '#f9a8d4',
      accentColor: '#67e8f9',
      backgroundColor: '#fdf2f8',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 12,
    },
  },
  {
    id: 'dark-tech',
    name: 'Dark Tech',
    description: 'Sleek dark mode aesthetic',
    theme: {
      primaryColor: '#22d3ee',
      secondaryColor: '#a78bfa',
      accentColor: '#34d399',
      backgroundColor: '#030712',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 6,
    },
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    description: 'Rich, warm storytelling',
    theme: {
      primaryColor: '#b45309',
      secondaryColor: '#78716c',
      accentColor: '#d97706',
      backgroundColor: '#fffbeb',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 2,
    },
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Clean monochrome',
    theme: {
      primaryColor: '#18181b',
      secondaryColor: '#71717a',
      accentColor: '#18181b',
      backgroundColor: '#fafafa',
      fontTitle: 'Inter',
      fontBody: 'Inter',
      borderRadius: 0,
    },
  },
];

export interface EditorState {
  presentation: SlidePresentation | null;
  fileName: string;
  activeSlideIndex: number;
  selectedElementId: string | null;
  zoom: number;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  isAILoading: boolean;
  aiProgress: { changes: number } | null;
  history: SlidePresentation[];
  historyIndex: number;

  setPresentation: (p: SlidePresentation) => void;
  setFileName: (name: string) => void;
  setActiveSlideIndex: (index: number) => void;
  selectElement: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  addSlide: () => void;
  removeSlide: (id: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  updateElement: (slideIndex: number, elementId: string, updates: Partial<SlideElement>) => void;
  removeElement: (slideIndex: number, elementId: string) => void;
  addElement: (slideIndex: number, element: SlideElement) => void;
  applyTheme: (theme: SlideTheme) => void;
  undo: () => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  applyChanges: (slideIndex: number, changes: import('@/types/slide').SlideChange[]) => void;
  processResult: (presentation: SlidePresentation) => void;
  getActiveSlide: () => Slide | null;
  getActiveElement: () => SlideElement | null;

  // Streaming support
  setAILoading: (loading: boolean) => void;
  setAIProgress: (progress: { changes: number } | null) => void;
  pushHistorySnapshot: () => void;
  applyStreamChange: (change: import('@/types/slide').SlideChange) => void;
  applyThemeField: (field: string, value: unknown) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const defaultSlide = (index: number): Slide => ({
  id: generateId(),
  index,
  background: { type: 'color', value: '#ffffff' },
  elements: [],
});

const defaultPresentation = (): SlidePresentation => ({
  id: generateId(),
  title: 'Untitled Presentation',
  theme: themePresets[0].theme,
  slides: [defaultSlide(0)],
});

const pushHistory = (
  history: SlidePresentation[],
  historyIndex: number,
  presentation: SlidePresentation | null,
): { history: SlidePresentation[]; historyIndex: number } => {
  if (!presentation) return { history, historyIndex };
  const trimmed = history.slice(0, historyIndex + 1);
  trimmed.push(JSON.parse(JSON.stringify(presentation)));
  return { history: trimmed, historyIndex: trimmed.length - 1 };
};

export const useStore = create<EditorState>((set, get) => ({
  presentation: null,
  fileName: '',
  activeSlideIndex: 0,
  selectedElementId: null,
  zoom: 100,
  chatMessages: [],
  isChatLoading: false,
  isAILoading: false,
  aiProgress: null,
  history: [],
  historyIndex: -1,

  setPresentation: (p) => {
    set((state) => {
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { presentation: p, activeSlideIndex: 0, selectedElementId: null, history, historyIndex };
    });
  },

  setFileName: (name) => set({ fileName: name }),

  setActiveSlideIndex: (index) => {
    const presentation = get().presentation;
    if (!presentation || index < 0 || index >= presentation.slides.length) return;
    set({ activeSlideIndex: index, selectedElementId: null });
  },

  selectElement: (id) => set({ selectedElementId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(25, Math.min(200, zoom)) }),

  addSlide: () => {
    set((state) => {
      if (!state.presentation) return state;
      const newSlide = defaultSlide(state.presentation.slides.length);
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return {
        presentation: {
          ...state.presentation,
          slides: [...state.presentation.slides, newSlide],
        },
        activeSlideIndex: state.presentation.slides.length,
        history,
        historyIndex,
      };
    });
  },

  removeSlide: (id) => {
    set((state) => {
      if (!state.presentation || state.presentation.slides.length <= 1) return state;
      const filtered = state.presentation.slides.filter((s) => s.id !== id);
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      const newIndex = Math.min(state.activeSlideIndex, filtered.length - 1);
      return {
        presentation: { ...state.presentation, slides: filtered },
        activeSlideIndex: newIndex,
        selectedElementId: null,
        history,
        historyIndex,
      };
    });
  },

  reorderSlides: (fromIndex, toIndex) => {
    set((state) => {
      if (!state.presentation) return state;
      const slides = [...state.presentation.slides];
      const [moved] = slides.splice(fromIndex, 1);
      slides.splice(toIndex, 0, moved);
      const reindexed = slides.map((s, i) => ({ ...s, index: i }));
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return {
        presentation: { ...state.presentation, slides: reindexed },
        activeSlideIndex: toIndex,
        history,
        historyIndex,
      };
    });
  },

  updateElement: (slideIndex, elementId, updates) => {
    set((state) => {
      if (!state.presentation) return state;
      const slides = state.presentation.slides.map((slide, idx) => {
        if (idx !== slideIndex) return slide;
        return {
          ...slide,
          elements: slide.elements.map((el) =>
            el.id === elementId ? ({ ...el, ...updates } as SlideElement) : el,
          ),
        };
      });
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { presentation: { ...state.presentation, slides }, history, historyIndex };
    });
  },

  removeElement: (slideIndex, elementId) => {
    set((state) => {
      if (!state.presentation) return state;
      const slides = state.presentation.slides.map((slide, idx) => {
        if (idx !== slideIndex) return slide;
        return { ...slide, elements: slide.elements.filter((el) => el.id !== elementId) };
      });
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return {
        presentation: { ...state.presentation, slides },
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
        history,
        historyIndex,
      };
    });
  },

  addElement: (slideIndex, element) => {
    set((state) => {
      if (!state.presentation) return state;
      const slides = state.presentation.slides.map((slide, idx) => {
        if (idx !== slideIndex) return slide;
        return { ...slide, elements: [...slide.elements, element] };
      });
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { presentation: { ...state.presentation, slides }, history, historyIndex };
    });
  },

  applyTheme: (theme) => {
    set((state) => {
      if (!state.presentation) return state;
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return {
        presentation: {
          ...state.presentation,
          theme: { ...state.presentation.theme, ...theme },
        },
        history,
        historyIndex,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex < 0) return state;
      const snapshot = state.history[state.historyIndex];
      return {
        presentation: snapshot,
        historyIndex: state.historyIndex - 1,
        selectedElementId: null,
      };
    });
  },

  addChatMessage: (msg) => {
    set((state) => ({ chatMessages: [...state.chatMessages, msg] }));
  },

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  applyChanges: (slideIndex, changes) => {
    set((state) => {
      if (!state.presentation) return state;
      const slides = state.presentation.slides.map((slide, idx) => {
        if (idx !== slideIndex) return slide;
        let updated = { ...slide, elements: [...slide.elements] };
        for (const change of changes) {
          if (change.elementId === null) {
            // Slide-level change
            (updated as any)[change.field] = change.value;
          } else {
            updated.elements = updated.elements.map((el) =>
              el.id === change.elementId
                ? ({ ...el, [change.field]: change.value } as SlideElement)
                : el,
            );
          }
        }
        return updated;
      });
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { presentation: { ...state.presentation, slides }, history, historyIndex };
    });
  },

  processResult: (presentation) => {
    set((state) => {
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { presentation, history, historyIndex };
    });
  },

  getActiveSlide: () => {
    const state = get();
    if (!state.presentation) return null;
    return state.presentation.slides[state.activeSlideIndex] ?? null;
  },

  getActiveElement: () => {
    const state = get();
    const slide = state.getActiveSlide();
    if (!slide || !state.selectedElementId) return null;
    return slide.elements.find((el) => el.id === state.selectedElementId) ?? null;
  },

  // === Streaming support ===

  setAILoading: (loading) => set({ isAILoading: loading, aiProgress: loading ? { changes: 0 } : null }),

  setAIProgress: (progress) => set({ aiProgress: progress }),

  pushHistorySnapshot: () => {
    set((state) => {
      const { history, historyIndex } = pushHistory(state.history, state.historyIndex, state.presentation);
      return { history, historyIndex };
    });
  },

  applyStreamChange: (change) => {
    set((state) => {
      if (!state.presentation) return state;

      const slides = state.presentation.slides.map((slide, idx) => {
        if (idx !== change.slideIndex) return slide;

        if (change.elementId === null) {
          // Slide-level change, support dotted paths (e.g. "background.value")
          if (change.field.includes('.')) {
            const parts = change.field.split('.');
            const [parent, ...rest] = parts;
            if (parts.length === 2) {
              return {
                ...slide,
                [parent]: { ...(slide as any)[parent], [rest[0]]: change.value },
              };
            }
            // Nested path: background.gradient.colors[0] etc
            let obj = { ...slide };
            let current = obj as any;
            for (let i = 0; i < parts.length - 1; i++) {
              current[parts[i]] = { ...current[parts[i]] };
              current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = change.value;
            return obj;
          }
          return { ...slide, [change.field]: change.value };
        }

        // Element-level change
        return {
          ...slide,
          elements: slide.elements.map((el) =>
            el.id === change.elementId
              ? ({ ...el, [change.field]: change.value } as SlideElement)
              : el,
          ),
        };
      });

      return { presentation: { ...state.presentation, slides } };
    });
  },

  applyThemeField: (field, value) => {
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          theme: { ...state.presentation.theme, [field]: value },
        },
      };
    });
  },
}));

// Helper to check if undo is available
export const canUndo = (state: EditorState) => state.historyIndex >= 0;
