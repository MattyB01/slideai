import { create } from 'zustand';
import type {
  SlidePresentation,
  SlideTheme,
  Slide,
  SlideElement,
  ChatMessage,
  SlideChange,
} from '@/types/slide';

export interface SlideAIState {
  presentation: SlidePresentation | null;
  currentSlideIndex: number;
  chatMessages: ChatMessage[];
  isProcessing: boolean;
  isExporting: boolean;
  originalJson: SlidePresentation | null;
}

export interface SlideAIActions {
  /** Load a full presentation and snapshot original for revert */
  setPresentation: (data: SlidePresentation) => void;

  /** Merge partial theme values into the current theme */
  updateTheme: (theme: Partial<SlideTheme>) => void;

  /** Merge partial fields into a slide by id */
  updateSlide: (slideId: string, updates: Partial<Slide>) => void;

  /** Append an element to a specific slide */
  addElement: (slideId: string, element: SlideElement) => void;

  /** Remove an element from a specific slide */
  removeElement: (slideId: string, elementId: string) => void;

  /** Merge partial fields into a specific element */
  updateElement: (
    slideId: string,
    elementId: string,
    updates: Partial<SlideElement>,
  ) => void;

  /** Append a message to the chat log */
  addChatMessage: (msg: ChatMessage) => void;

  /** Apply an array of SlideChanges to the presentation */
  applyChanges: (changes: SlideChange[]) => void;

  /** Navigate to a slide by index */
  setCurrentSlide: (index: number) => void;

  /** Restore the presentation from the originalJson snapshot */
  revertToOriginal: () => void;

  /** Full reset to initial state */
  reset: () => void;
}

export type SlideAIStore = SlideAIState & SlideAIActions;

const initialState: SlideAIState = {
  presentation: null,
  currentSlideIndex: 0,
  chatMessages: [],
  isProcessing: false,
  isExporting: false,
  originalJson: null,
};

export const useSlideStore = create<SlideAIStore>((set, get) => ({
  ...initialState,

  setPresentation: (data: SlidePresentation) => {
    // Deep-clone so the snapshot is independent
    const snapshot: SlidePresentation = JSON.parse(JSON.stringify(data));
    set({
      presentation: data,
      originalJson: snapshot,
      currentSlideIndex: 0,
      chatMessages: [],
      isProcessing: false,
      isExporting: false,
    });
  },

  updateTheme: (theme: Partial<SlideTheme>) =>
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          theme: { ...state.presentation.theme, ...theme },
        },
      };
    }),

  updateSlide: (slideId: string, updates: Partial<Slide>) =>
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          slides: state.presentation.slides.map((s) =>
            s.id === slideId ? { ...s, ...updates } : s,
          ),
        },
      };
    }),

  addElement: (slideId: string, element: SlideElement) =>
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          slides: state.presentation.slides.map((s) =>
            s.id === slideId
              ? { ...s, elements: [...s.elements, element] }
              : s,
          ),
        },
      };
    }),

  removeElement: (slideId: string, elementId: string) =>
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          slides: state.presentation.slides.map((s) =>
            s.id === slideId
              ? {
                  ...s,
                  elements: s.elements.filter((e) => e.id !== elementId),
                }
              : s,
          ),
        },
      };
    }),

  updateElement: (
    slideId: string,
    elementId: string,
    updates: Partial<SlideElement>,
  ) =>
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: {
          ...state.presentation,
          slides: state.presentation.slides.map((s) =>
            s.id === slideId
              ? {
                  ...s,
                  elements: s.elements.map((e) =>
                    e.id === elementId
                      ? ({ ...e, ...updates } as SlideElement)
                      : e,
                  ),
                }
              : s,
          ),
        },
      };
    }),

  addChatMessage: (msg: ChatMessage) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg],
    })),

  applyChanges: (changes: SlideChange[]) =>
    set((state) => {
      if (!state.presentation) return state;
      const slides = state.presentation.slides.map((slide, idx) => {
        const slideChanges = changes.filter((c) => c.slideIndex === idx);
        if (slideChanges.length === 0) return slide;

        let updated = { ...slide };
        for (const change of slideChanges) {
          if (change.elementId === null) {
            // Slide-level field update (e.g. background, speakerNotes)
            (updated as Record<string, unknown>)[change.field] = change.value;
          } else {
            // Element-level field update
            updated = {
              ...updated,
              elements: updated.elements.map((el) =>
                el.id === change.elementId
                  ? ({ ...el, [change.field]: change.value } as SlideElement)
                  : el,
              ),
            };
          }
        }
        return updated;
      });

      return {
        presentation: { ...state.presentation, slides },
      };
    }),

  setCurrentSlide: (index: number) => set({ currentSlideIndex: index }),

  revertToOriginal: () =>
    set((state) => {
      if (!state.originalJson) return state;
      return {
        presentation: JSON.parse(JSON.stringify(state.originalJson)),
        currentSlideIndex: 0,
        chatMessages: [],
        isProcessing: false,
        isExporting: false,
      };
    }),

  reset: () => set(initialState),
}));
