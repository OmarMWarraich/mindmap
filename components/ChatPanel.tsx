'use client';

import { useId, useRef, useState } from 'react';

// ── Icons ──────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const inputId = useId();
  const listRef = useRef<HTMLOListElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  function scrollToBottom() {
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text, timestamp: new Date() },
    ]);
    setDraft('');
    // AI calls will be wired in a future phase
    setTimeout(() => {
      scrollToBottom();
    }, 0);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
        <div className="grid gap-0.5">
          <h2 className="text-sm font-semibold text-zinc-900">Chat</h2>
          <p className="text-xs text-zinc-500">Ask questions about your study map</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {messages.length === 0 ? 'No messages' : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── Message list ──────────────────────────────────────── */}
      <ol
        aria-label="Chat messages"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        ref={listRef}
      >
        {messages.length === 0 ? (
          <li className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            No messages yet. Ask something about your study topic.
          </li>
        ) : (
          messages.map((msg) => (
            <li
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              key={msg.id}
            >
              <div
                className={
                  msg.role === 'user'
                    ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-accent-600 px-3.5 py-2 text-sm text-white'
                    : 'max-w-[80%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-800'
                }
              >
                {msg.text}
              </div>
            </li>
          ))
        )}
      </ol>

      {/* ── Input area ────────────────────────────────────────── */}
      <form
        className="flex shrink-0 items-end gap-2 border-t border-zinc-200 px-4 py-3"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor={inputId}>
          Message
        </label>
        <textarea
          className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-400"
          id={inputId}
          maxLength={2000}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask about your study topic…"
          rows={1}
          value={draft}
        />
        <button
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-lg bg-accent-600 p-2.5 text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!draft.trim()}
          type="submit"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
