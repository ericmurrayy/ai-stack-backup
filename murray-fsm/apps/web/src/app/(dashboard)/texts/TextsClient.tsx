// Murray's FSM - iMessage-Style Client Component
// =================================================
// Thread sidebar + chat view + compose bar with quick templates

'use client';

import { useState, useRef, useEffect } from 'react';
import { formatPhone, formatRelativeTime } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  Search,
  ChevronDown,
  Smile,
  Paperclip,
  Phone,
  User,
  Zap,
  X,
  ExternalLink,
  Clock,
  CheckCheck,
  Check,
} from 'lucide-react';
import type { Thread } from './page';
import type { MessageLog } from '@/types/database';
import Link from 'next/link';

// ---------- Types ----------

interface QuickTemplate {
  id: string;
  label: string;
  body: string;
}

// ---------- Helpers ----------

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getContactColor(phone: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatChatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function shouldShowTimestamp(messages: MessageLog[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at).getTime();
  const curr = new Date(messages[index].created_at).getTime();
  return curr - prev > 30 * 60 * 1000; // 30+ minutes gap
}

// ==========================================================================
// Thread Sidebar
// ==========================================================================

function ThreadList({
  threads,
  activeThreadPhone,
  onSelectThread,
  searchQuery,
  onSearchChange,
}: {
  threads: Thread[];
  activeThreadPhone: string | null;
  onSelectThread: (phone: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const filtered = threads.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.contactPhone.includes(q) ||
      t.contactName?.toLowerCase().includes(q) ||
      t.lastMessage.body?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">Messages</h2>
          <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="New message">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No conversations found</p>
          </div>
        ) : (
          filtered.map((thread) => {
            const isActive = thread.contactPhone === activeThreadPhone;
            const name = thread.contactName || formatPhone(thread.contactPhone);
            const color = getContactColor(thread.contactPhone);

            return (
              <button
                key={thread.contactPhone}
                onClick={() => onSelectThread(thread.contactPhone)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-slate-100 ${
                  isActive
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-sm font-semibold">
                    {getInitials(thread.contactName)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                      {name}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {formatMessageTime(thread.lastMessage.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {thread.lastMessage.direction === 'outbound' && (
                      <CheckCheck className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-slate-500 truncate">
                      {thread.lastMessage.body || '📎 Attachment'}
                    </span>
                  </div>
                  {thread.unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center mt-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==========================================================================
// Chat View
// ==========================================================================

function ChatView({
  thread,
  onSendMessage,
  templates,
  sending,
}: {
  thread: Thread;
  onSendMessage: (body: string) => void;
  templates: QuickTemplate[];
  sending: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const name = thread.contactName || formatPhone(thread.contactPhone);
  const color = getContactColor(thread.contactPhone);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length]);

  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || sending) return;
    onSendMessage(trimmed);
    setInputValue('');
    setShowTemplates(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function selectTemplate(template: QuickTemplate) {
    setInputValue(template.body);
    setShowTemplates(false);
    inputRef.current?.focus();
  }

  // Generate sms: link for native iMessage/SMS
  const smsLink = `sms:${thread.contactPhone}${inputValue ? `&body=${encodeURIComponent(inputValue)}` : ''}`;

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* Chat Header */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${color} rounded-full flex items-center justify-center`}>
            <span className="text-white text-sm font-semibold">{getInitials(thread.contactName)}</span>
          </div>
          <div>
            <div className="font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{formatPhone(thread.contactPhone)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.customerId && (
            <Link
              href={`/customers/${thread.customerId}`}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 rounded-full transition-colors"
            >
              <User className="w-3 h-3" />
              View Customer
            </Link>
          )}
          <a
            href={`tel:${thread.contactPhone}`}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Call"
          >
            <Phone className="w-4 h-4 text-slate-500" />
          </a>
          <a
            href={smsLink}
            className="p-2 hover:bg-green-50 rounded-lg transition-colors"
            title="Open in iMessage/SMS app"
          >
            <ExternalLink className="w-4 h-4 text-green-600" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {thread.messages.map((msg, idx) => {
          const isOutbound = msg.direction === 'outbound';
          const showTime = shouldShowTimestamp(thread.messages, idx);
          const isLastInGroup =
            idx === thread.messages.length - 1 ||
            thread.messages[idx + 1]?.direction !== msg.direction;

          return (
            <div key={msg.id}>
              {/* Timestamp separator */}
              {showTime && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {new Date(msg.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    {formatChatTimestamp(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2.5 text-sm leading-relaxed ${
                    isOutbound
                      ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-slate-900 rounded-2xl rounded-bl-md shadow-sm border border-slate-100'
                  }`}
                >
                  {msg.body ? (
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  ) : (
                    <p className="italic opacity-70">📎 Media message</p>
                  )}

                  {/* Message metadata */}
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-blue-200' : 'text-slate-400'}`}>
                    <span className="text-[10px]">{formatChatTimestamp(msg.created_at)}</span>
                    {isOutbound && (
                      msg.delivered_at ? (
                        <CheckCheck className="w-3 h-3" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Templates Panel */}
      {showTemplates && (
        <div className="px-4 py-3 bg-white border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Templates</span>
            <button
              onClick={() => setShowTemplates(false)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title="Close templates"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs transition-colors border border-slate-200 hover:border-blue-300"
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-slate-400 truncate mt-0.5">{t.body.slice(0, 50)}...</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compose Bar */}
      <div className="px-4 py-3 bg-white border-t border-slate-200">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showTemplates ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}
            title="Quick templates"
          >
            <Zap className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="iMessage via Sendblue"
              rows={1}
              className="w-full px-4 py-2.5 bg-slate-100 border-0 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
            />
          </div>

          {inputValue.trim() ? (
            <button
              onClick={handleSend}
              disabled={sending}
              className="p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
              title="Send via Sendblue iMessage"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <a
              href={`sms:${thread.contactPhone}`}
              className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors flex-shrink-0"
              title="Open in iMessage/SMS"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3">
            <a
              href={smsLink}
              className="text-[11px] text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open in iMessage
            </a>
          </div>
          <span className="text-[11px] text-slate-400">
            Press Enter to send · Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Empty Chat State
// ==========================================================================

function EmptyChatState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Murray&apos;s Messages</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Select a conversation from the sidebar to view messages, or start a new conversation.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Quick templates
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            iMessage integration
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Main Client Component
// ==========================================================================

export function TextsClient({
  threads: initialThreads,
  templates,
}: {
  threads: Thread[];
  templates: QuickTemplate[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activePhone, setActivePhone] = useState<string | null>(
    initialThreads.length > 0 ? initialThreads[0].contactPhone : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const activeThread = threads.find((t) => t.contactPhone === activePhone) || null;

  // Auto-dismiss send status toast after 4 seconds
  useEffect(() => {
    if (sendStatus) {
      const timer = setTimeout(() => setSendStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [sendStatus]);

  async function handleSendMessage(body: string) {
    if (!activeThread) return;

    setSending(true);
    setSendStatus(null);
    try {
      // Call our Sendblue API route
      const res = await fetch('/api/sendblue/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeThread.contactPhone,
          content: body,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error('Send failed:', result);
        setSendStatus({ message: result.error || 'Failed to send', type: 'error' });
        return;
      }

      // Show status feedback
      if (result.needsSetup) {
        setSendStatus({ message: '💡 Message saved. Add Sendblue API keys to .env.local for iMessage delivery.', type: 'info' });
      } else if (result.wasDowngraded) {
        setSendStatus({ message: '📱 Sent as SMS (recipient doesn\'t have iMessage)', type: 'info' });
      } else {
        setSendStatus({ message: '💬 Sent as iMessage (blue text) ✅', type: 'success' });
      }

      // Optimistically add to thread
      if (result.data) {
        setThreads((prev) =>
          prev.map((t) =>
            t.contactPhone === activeThread.contactPhone
              ? {
                  ...t,
                  messages: [...t.messages, result.data as MessageLog],
                  lastMessage: result.data as MessageLog,
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error('Send error:', err);
      setSendStatus({ message: 'Network error — check your connection', type: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <ThreadList
        threads={threads}
        activeThreadPhone={activePhone}
        onSelectThread={setActivePhone}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {activeThread ? (
        <ChatView
          thread={activeThread}
          onSendMessage={handleSendMessage}
          templates={templates}
          sending={sending}
        />
      ) : (
        <EmptyChatState />
      )}

      {/* Send Status Toast */}
      {sendStatus && (
        <div
          className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 animate-fade-in ${
            sendStatus.type === 'success'
              ? 'bg-blue-500 text-white'
              : sendStatus.type === 'info'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {sendStatus.message}
        </div>
      )}
    </div>
  );
}
