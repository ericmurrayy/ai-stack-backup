// Ollama AI Integration for Murray FSM
const OLLAMA_BASE_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'dolphin-mistral:7b-v2.8';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export async function chat(messages: ChatMessage[], model = DEFAULT_MODEL): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!response.ok) throw new Error('Ollama request failed');
  const data = await response.json();
  return data.message?.content || '';
}

export async function generate(prompt: string, model = DEFAULT_MODEL): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!response.ok) throw new Error('Ollama request failed');
  const data = await response.json();
  return data.response || '';
}

export async function streamChat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  model = DEFAULT_MODEL
): Promise<void> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) throw new Error('Ollama request failed');

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          onChunk(data.message.content);
        }
      } catch {}
    }
  }
}

export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

// FSM-specific AI functions
export const FSM_SYSTEM_PROMPT = `You are an AI assistant for Murray's Garage Door Services FSM app.
You help with:
- Creating and managing jobs
- Scheduling appointments
- Customer communication
- Generating estimates and invoices
- Answering questions about garage door repair

Be concise and professional. Format responses for easy reading.
Business: Murray's Garage Door Services, Chelmsford MA, 978-758-0690`;

export async function askFSMAssistant(question: string): Promise<string> {
  return chat([
    { role: 'system', content: FSM_SYSTEM_PROMPT },
    { role: 'user', content: question }
  ]);
}

export async function generateJobDescription(customerIssue: string): Promise<string> {
  const prompt = `Based on this customer issue, write a professional job description:
"${customerIssue}"

Include: problem summary, likely cause, recommended service. Keep it under 100 words.`;

  return generate(prompt);
}

export async function generateEstimateNotes(serviceType: string, issues: string): Promise<string> {
  const prompt = `Generate estimate notes for a garage door ${serviceType}. Issues: ${issues}. Include parts/labor breakdown suggestions. Be specific but concise.`;
  return generate(prompt);
}

export async function suggestScheduleTime(jobDetails: string, existingSchedule: string): Promise<string> {
  const prompt = `Given this job: ${jobDetails}
And existing schedule: ${existingSchedule}
Suggest optimal scheduling time. Consider job urgency and travel efficiency.`;
  return generate(prompt);
}
