'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { ChatMessage } from '@/types/slide';

const quickActions = [
  { label: 'Restyle slide', action: 'restyle' },
  { label: 'Better image', action: 'better-image' },
  { label: 'Bigger text', action: 'bigger-text' },
  { label: 'Change background', action: 'change-bg' },
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-zinc-100 text-zinc-800 rounded-bl-md'
          }
        `}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={`block mt-1 text-[10px] ${
            isUser ? 'text-blue-200' : 'text-zinc-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export default function ChatPanel() {
  const chatMessages = useStore((s) => s.chatMessages);
  const isChatLoading = useStore((s) => s.isChatLoading);
  const addChatMessage = useStore((s) => s.addChatMessage);
  const setChatLoading = useStore((s) => s.setChatLoading);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setInput('');

    // Simulate assistant response
    setChatLoading(true);
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `I've processed your request. Here's what I'd suggest:\n\n${text.length > 50 ? "I'll restructure the layout to improve visual hierarchy and readability." : "Let me adjust that for you."}`,
        timestamp: new Date(),
      };
      addChatMessage(assistantMsg);
      setChatLoading(false);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    const actionMessages: Record<string, string> = {
      restyle: 'Restyle this slide with a fresh layout',
      'better-image': 'Find a better image for this slide',
      'bigger-text': 'Make the text bigger and more readable',
      'change-bg': 'Change the background design',
    };
    setInput(actionMessages[action] ?? '');
    inputRef.current?.focus();
  };

  const emptyState = chatMessages.length === 0 && !isChatLoading;

  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          AI Assistant
        </h2>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Ask me to edit your slides
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {emptyState && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-500 mb-1">
              How can I help?
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Try clicking a quick action below or type a request.
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isChatLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
                <span className="text-xs text-zinc-400 ml-1">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {emptyState && (
        <div className="px-3 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleQuickAction(qa.action)}
                className="
                  text-[11px] font-medium
                  px-2.5 py-1.5 rounded-lg
                  bg-zinc-100 text-zinc-600
                  hover:bg-zinc-200 hover:text-zinc-800
                  transition-colors duration-150
                "
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-zinc-100 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className="
              flex-1 resize-none rounded-xl border border-zinc-200
              bg-zinc-50 px-3 py-2 text-sm
              text-zinc-900 placeholder-zinc-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
              transition-colors duration-150
            "
            style={{ minHeight: 36, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading}
            className="
              shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
              bg-blue-600 text-white
              hover:bg-blue-700 active:bg-blue-800
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
