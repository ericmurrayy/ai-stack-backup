// Murray's FSM - iMessage-Style Texts Page
// ==========================================
// Full messaging interface with thread sidebar, chat view, and compose

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { formatPhone, formatRelativeTime } from '@/lib/utils';
import type { MessageLog } from '@/types/database';
import { TextsClient } from './TextsClient';

// ---------- Types ----------

export interface Thread {
  contactPhone: string;
  contactName: string | null;
  customerId: string | null;
  messages: MessageLog[];
  lastMessage: MessageLog;
  unreadCount: number;
}

// ---------- Data Fetching ----------

async function getMessagesWithCustomers() {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from('message_logs')
    .select('*')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching messages:', error);
    return { threads: [], allMessages: [] };
  }

  const allMessages = (messages || []) as MessageLog[];

  // Get unique phone numbers to match with customers
  const phones = new Set<string>();
  allMessages.forEach((m) => {
    phones.add(m.direction === 'inbound' ? m.from_phone : m.to_phone);
  });

  // Look up customer names for phone numbers
  const phoneArray = Array.from(phones);
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('deleted', false);

  const phoneToCustomer = new Map<string, { id: string; name: string }>();
  (customers || []).forEach((c: any) => {
    if (c.phone) {
      // Normalize phone for matching
      const normalized = c.phone.replace(/\D/g, '');
      phoneToCustomer.set(normalized, { id: c.id, name: c.name });
      phoneToCustomer.set(c.phone, { id: c.id, name: c.name });
    }
  });

  // Build threads grouped by contact phone
  const threadMap = new Map<string, Thread>();

  allMessages.forEach((msg) => {
    const contactPhone = msg.direction === 'inbound' ? msg.from_phone : msg.to_phone;
    const normalized = contactPhone.replace(/\D/g, '');
    const customer = phoneToCustomer.get(normalized) || phoneToCustomer.get(contactPhone);

    if (!threadMap.has(contactPhone)) {
      threadMap.set(contactPhone, {
        contactPhone,
        contactName: customer?.name || null,
        customerId: customer?.id || null,
        messages: [],
        lastMessage: msg,
        unreadCount: 0,
      });
    }

    const thread = threadMap.get(contactPhone)!;
    thread.messages.push(msg);

    // Count unread (inbound messages without read status)
    if (msg.direction === 'inbound' && msg.status !== 'read') {
      thread.unreadCount++;
    }
  });

  // Sort threads by most recent message
  const threads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );

  // Reverse message order within threads (oldest first for chat display)
  threads.forEach((t) => t.messages.reverse());

  return { threads, allMessages };
}

async function getQuickTemplates() {
  return [
    { id: 'otw', label: '🚗 On My Way', body: "Hi, this is Murray's! Your tech is on the way and should arrive in about 15-20 minutes." },
    { id: 'arrived', label: '📍 Arrived', body: "Hi, this is Murray's! Your technician has arrived at the service location." },
    { id: 'complete', label: '✅ Job Complete', body: "Great news! Your service has been completed. Please don't hesitate to reach out if you have any questions." },
    { id: 'reminder', label: '📅 Appointment Reminder', body: "Friendly reminder: You have an upcoming appointment with Murray's. Please reply to confirm or reschedule." },
    { id: 'estimate', label: '💰 Estimate Ready', body: "Your estimate is ready! Please check your email or the customer portal to review and approve." },
    { id: 'follow-up', label: '🔄 Follow Up', body: "Hi! Just following up on the work we did. How is everything working? We'd appreciate your feedback!" },
    { id: 'invoice', label: '🧾 Invoice Sent', body: "Your invoice has been sent. You can pay online through the link in your email. Thank you for your business!" },
    { id: 'review', label: '⭐ Review Request', body: "Thank you for choosing Murray's! We'd really appreciate it if you could leave us a review. It helps us grow!" },
  ];
}

// ---------- Page ----------

export default async function TextsPage() {
  const [{ threads }, templates] = await Promise.all([
    getMessagesWithCustomers(),
    getQuickTemplates(),
  ]);

  return (
    <div className="h-screen flex flex-col">
      <Header title="Messages" />
      <TextsClient threads={threads} templates={templates} />
    </div>
  );
}
