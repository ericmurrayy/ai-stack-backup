/**
 * Jarvis Bridge Service
 * =====================
 * Bridge between Windows-based FSM app and WSL-based Jarvis/Clawdbot system.
 *
 * Provides:
 * - Task delegation to Jarvis orchestrator
 * - Direct Ollama queries (Dolphin model)
 * - Clawdbot messaging (WhatsApp, Telegram)
 * - BOSS agent control
 * - Memory sync with clawd/
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

// Configuration
const WSL_DISTRO = 'Ubuntu';
const WSL_PREFIX = `wsl -d ${WSL_DISTRO} -e bash -c`;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin3:latest';
const JARVIS_DIR = '/home/ericm/jarvis';
const CLAWD_DIR = '/home/ericm/clawd';

// Types
export interface JarvisStatus {
  orchestrator: 'running' | 'stopped' | 'error';
  agents: Record<string, AgentStatus>;
  queue: {
    pending: number;
    completed: number;
    failed: number;
  };
  timestamp: string;
}

export interface AgentStatus {
  name: string;
  model: string;
  role: string;
  status: 'idle' | 'busy' | 'error';
  currentTask: string | null;
}

export interface BOSSStatus {
  running: boolean;
  model: string;
  revenue_30d: {
    income: number;
    expense: number;
    profit: number;
  };
  pending_actions: number;
  goal_progress: string;
}

export interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export interface DelegateResult {
  success: boolean;
  assignedTo: string;
  message: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sanitize a filename to prevent path traversal
 * Only allows alphanumeric chars, hyphens, underscores, dots, and forward slashes
 * Rejects paths containing '..' or starting with '/'
 */
function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts
  const cleaned = filename.replace(/\.\./g, '').replace(/^\/+/, '')
  // Only allow safe characters
  if (!/^[a-zA-Z0-9_\-./]+$/.test(cleaned)) {
    throw new Error(`Invalid filename: ${filename}`)
  }
  // Verify the resolved path stays within the target directory
  const resolved = path.posix.normalize(cleaned)
  if (resolved.startsWith('/') || resolved.includes('..')) {
    throw new Error(`Path traversal detected: ${filename}`)
  }
  return resolved
}

/**
 * Execute a command in WSL safely using execFile (no shell interpolation)
 */
async function wslExec(command: string, timeout = 30000): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'wsl',
      ['-d', WSL_DISTRO, '-e', 'bash', '-c', command],
      { timeout }
    );
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error: unknown) {
    const err = error as { killed?: boolean; message?: string }
    if (err.killed) {
      throw new Error(`Command timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Query Ollama directly (Dolphin model)
 */
export async function queryOllama(
  prompt: string,
  options: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const model = options.model || OLLAMA_MODEL;
  const messages: Array<{ role: string; content: string }> = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaResponse;
    return data.message?.content || '';
  } catch (error: any) {
    console.error('Ollama query failed:', error.message);
    throw error;
  }
}

/**
 * Get Jarvis orchestrator status
 */
export async function getOrchestratorStatus(): Promise<JarvisStatus> {
  try {
    const output = await wslExec(
      `python3 ${JARVIS_DIR}/agents/orchestrator.py status`
    );
    return JSON.parse(output);
  } catch (error: any) {
    return {
      orchestrator: 'error',
      agents: {},
      queue: { pending: 0, completed: 0, failed: 0 },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Delegate a task to the Jarvis orchestrator
 */
export async function delegateTask(
  taskType: string,
  description: string
): Promise<DelegateResult> {
  try {
    // Sanitize inputs to prevent injection
    const safeTaskType = taskType.replace(/[^a-zA-Z0-9_-]/g, '')
    const safeDesc = description.replace(/'/g, "'\\''")
    const output = await wslExec(
      `python3 "${JARVIS_DIR}/agents/orchestrator.py" delegate "${safeTaskType}" '${safeDesc}'`,
      60000
    );

    return {
      success: true,
      assignedTo: output.includes('queued') ? 'queue' : output,
      message: output,
    };
  } catch (error: any) {
    return {
      success: false,
      assignedTo: 'none',
      message: error.message,
    };
  }
}

/**
 * Run Jarvis health check
 */
export async function runHealthCheck(): Promise<{
  healthy: boolean;
  checks: Record<string, boolean>;
}> {
  try {
    const output = await wslExec(
      `python3 ${JARVIS_DIR}/agents/orchestrator.py health`
    );
    return JSON.parse(output);
  } catch (error: any) {
    return {
      healthy: false,
      checks: { error: false },
    };
  }
}

/**
 * Get BOSS agent status
 */
export async function getBOSSStatus(): Promise<BOSSStatus> {
  try {
    const output = await wslExec(
      `python3 ${JARVIS_DIR}/agents/boss.py status`
    );
    return JSON.parse(output);
  } catch (error: any) {
    return {
      running: false,
      model: OLLAMA_MODEL,
      revenue_30d: { income: 0, expense: 0, profit: 0 },
      pending_actions: 0,
      goal_progress: '0%',
    };
  }
}

/**
 * Run one BOSS automation cycle
 */
export async function runBOSSCycle(): Promise<{ success: boolean; message: string }> {
  try {
    const output = await wslExec(
      `python3 ${JARVIS_DIR}/agents/boss.py cycle`,
      120000
    );
    return { success: true, message: output };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Get BOSS revenue summary
 */
export async function getBOSSRevenue(): Promise<{
  income: number;
  expense: number;
  profit: number;
}> {
  try {
    const output = await wslExec(
      `python3 ${JARVIS_DIR}/agents/boss.py revenue`
    );
    return JSON.parse(output);
  } catch (error: any) {
    return { income: 0, expense: 0, profit: 0 };
  }
}

/**
 * Send message via Clawdbot
 */
export async function sendMessage(
  channel: string,
  message: string
): Promise<MessageResult> {
  try {
    // Sanitize channel name and message content
    const safeChannel = channel.replace(/[^a-zA-Z0-9_#@-]/g, '')
    const safeMsg = message.replace(/'/g, "'\\''")
    const output = await wslExec(
      `clawdbot message send --channel '${safeChannel}' --text '${safeMsg}'`,
      30000
    );

    return {
      success: true,
      messageId: output.trim(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send WhatsApp message
 */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<MessageResult> {
  const channel = `whatsapp:${phone.replace(/\D/g, '')}`;
  return sendMessage(channel, message);
}

/**
 * Send Telegram message
 */
export async function sendTelegram(
  chatId: string,
  message: string
): Promise<MessageResult> {
  const channel = `telegram:${chatId}`;
  return sendMessage(channel, message);
}

/**
 * Get Clawdbot gateway status
 */
export async function getGatewayStatus(): Promise<{
  running: boolean;
  port: number;
  channels: string[];
}> {
  try {
    const output = await wslExec('clawdbot gateway status');
    // Parse output - clawdbot returns JSON or text
    if (output.includes('{')) {
      return JSON.parse(output);
    }
    return {
      running: output.toLowerCase().includes('running'),
      port: 18789,
      channels: [],
    };
  } catch (error) {
    return { running: false, port: 18789, channels: [] };
  }
}

/**
 * Read clawd memory file (with path traversal protection)
 */
export async function readMemory(
  filename: string
): Promise<{ content: string; exists: boolean }> {
  try {
    const safeName = sanitizeFilename(filename)
    const safePath = `${CLAWD_DIR}/${safeName}`
    const output = await wslExec(`cat "${safePath}"`)
    return { content: output, exists: true }
  } catch (error) {
    return { content: '', exists: false }
  }
}

/**
 * Write to clawd memory (with path traversal protection)
 */
export async function writeMemory(
  filename: string,
  content: string
): Promise<boolean> {
  try {
    const safeName = sanitizeFilename(filename)
    const safePath = `${CLAWD_DIR}/${safeName}`
    // Use heredoc to avoid shell injection via content
    await wslExec(
      `cat > "${safePath}" << 'MURRAY_EOF'\n${content}\nMURRAY_EOF`
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Append to daily memory log
 */
export async function appendToMemory(note: string): Promise<boolean> {
  try {
    const timestamp = new Date().toTimeString().slice(0, 5)
    const safeNote = note.replace(/'/g, "'\\''")
    const today = new Date().toISOString().slice(0, 10)
    const safePath = `${CLAWD_DIR}/memory/${sanitizeFilename(today + '.md')}`
    await wslExec(
      `echo '- [${timestamp}] ${safeNote}' >> "${safePath}"`
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get today's memory entries
 */
export async function getTodayMemory(): Promise<string[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const output = await wslExec(
      `cat ${CLAWD_DIR}/memory/${today}.md 2>/dev/null || echo ''`
    );
    return output.split('\n').filter((line) => line.startsWith('- ['));
  } catch (error) {
    return [];
  }
}

/**
 * Smart assistant query - routes to appropriate AI based on task
 */
export async function askAssistant(
  message: string,
  context?: { conversationHistory?: Array<{ role: string; content: string }> }
): Promise<{ response: string; source: 'local' | 'jarvis' | 'claude' }> {
  const lowerMessage = message.toLowerCase();

  // Determine the best AI to handle this request
  const needsJarvis =
    lowerMessage.includes('browse') ||
    lowerMessage.includes('website') ||
    lowerMessage.includes('search online') ||
    lowerMessage.includes('send email') ||
    lowerMessage.includes('send message') ||
    lowerMessage.includes('schedule') ||
    lowerMessage.includes('create job') ||
    lowerMessage.includes('invoice');

  const needsLocalAI =
    lowerMessage.includes('analyze') ||
    lowerMessage.includes('summarize') ||
    lowerMessage.includes('explain') ||
    lowerMessage.includes('what is') ||
    lowerMessage.includes('how to') ||
    message.length < 100;

  try {
    if (needsJarvis) {
      // Delegate to Jarvis for complex tasks
      const taskType = detectTaskType(message);
      const result = await delegateTask(taskType, message);
      return {
        response: result.message,
        source: 'jarvis',
      };
    } else if (needsLocalAI) {
      // Use local Ollama for quick queries
      const response = await queryOllama(message, {
        systemPrompt: `You are Jarvis, an AI assistant for Murray's Garage Door Services.
Be concise and helpful. The user is Eric Murray, the owner.
Current date: ${new Date().toISOString().slice(0, 10)}`,
      });
      return {
        response,
        source: 'local',
      };
    } else {
      // Default to local AI
      const response = await queryOllama(message);
      return {
        response,
        source: 'local',
      };
    }
  } catch (error: any) {
    return {
      response: `Error: ${error.message}`,
      source: 'local',
    };
  }
}

/**
 * Detect task type from message
 */
function detectTaskType(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('browse') || lower.includes('website') || lower.includes('url')) {
    return 'browser';
  }
  if (lower.includes('email') || lower.includes('send') || lower.includes('message')) {
    return 'comms';
  }
  if (lower.includes('schedule') || lower.includes('job') || lower.includes('appointment')) {
    return 'fsm';
  }
  if (lower.includes('research') || lower.includes('find') || lower.includes('search')) {
    return 'research';
  }
  if (lower.includes('code') || lower.includes('fix') || lower.includes('implement')) {
    return 'code';
  }

  return 'general';
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaStatus(): Promise<{
  running: boolean;
  models: string[];
}> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      return { running: false, models: [] };
    }
    const data = await response.json();
    return {
      running: true,
      models: data.models?.map((m: any) => m.name) || [],
    };
  } catch (error) {
    return { running: false, models: [] };
  }
}

/**
 * Get full system status
 */
export async function getFullSystemStatus(): Promise<{
  ollama: { running: boolean; models: string[] };
  jarvis: JarvisStatus;
  boss: BOSSStatus;
  gateway: { running: boolean; port: number; channels: string[] };
  timestamp: string;
}> {
  const [ollama, jarvis, boss, gateway] = await Promise.all([
    checkOllamaStatus(),
    getOrchestratorStatus(),
    getBOSSStatus(),
    getGatewayStatus(),
  ]);

  return {
    ollama,
    jarvis,
    boss,
    gateway,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// CLAUDE CODE INTEGRATION
// Delegate tasks directly to Claude Code CLI for maximum capability
// ============================================================================

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  model?: string;
  tokensUsed?: number;
}

/**
 * Execute a task using Claude Code CLI
 * This provides access to the full Claude agent capabilities including:
 * - File system access
 * - Code editing
 * - Web search
 * - MCP tools (browser, notion, hubspot, etc.)
 */
export async function askClaudeCode(
  prompt: string,
  options: {
    model?: 'opus' | 'sonnet' | 'haiku';
    allowedTools?: string[];
    workingDir?: string;
    timeout?: number;
  } = {}
): Promise<ClaudeCodeResult> {
  const model = options.model || 'sonnet';
  const timeout = options.timeout || 300000; // 5 minutes default

  try {
    // Build the command
    let cmd = `claude -p "${prompt.replace(/"/g, '\\"')}" --model ${model}`;

    // Add allowed tools if specified
    if (options.allowedTools && options.allowedTools.length > 0) {
      cmd += ` --allowedTools "${options.allowedTools.join(',')}"`;
    }

    // Execute in WSL
    const output = await wslExec(cmd, timeout);

    return {
      success: true,
      output: output,
      model: `claude-${model}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Delegate a complex task to Claude Code with specific capabilities
 */
export async function delegateToClaudeCode(
  taskType: string,
  description: string,
  context?: Record<string, any>
): Promise<ClaudeCodeResult> {
  // Build context-aware prompt
  let systemContext = '';

  if (context) {
    systemContext = `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
  }

  // Map task types to appropriate tools and models
  const taskConfig: Record<string, { tools: string[]; model: 'opus' | 'sonnet' | 'haiku' }> = {
    browser: {
      tools: ['mcp__chrome-devtools__*', 'WebSearch', 'WebFetch'],
      model: 'sonnet',
    },
    code: {
      tools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      model: 'opus',
    },
    research: {
      tools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
      model: 'sonnet',
    },
    fsm: {
      tools: ['Read', 'Edit', 'Bash', 'mcp__supabase__*'],
      model: 'sonnet',
    },
    crm: {
      tools: ['mcp__hubspot__*', 'Read', 'WebFetch'],
      model: 'sonnet',
    },
    notion: {
      tools: ['mcp__notion__*'],
      model: 'haiku',
    },
    payments: {
      tools: ['mcp__square__*'],
      model: 'sonnet',
    },
    automation: {
      tools: ['mcp__n8n__*', 'Bash'],
      model: 'sonnet',
    },
    general: {
      tools: [],
      model: 'sonnet',
    },
  };

  const config = taskConfig[taskType] || taskConfig.general;

  const fullPrompt = `${systemContext}Task: ${description}

You are Jarvis, an AI assistant for Murray's Garage Door Services.
Owner: Eric Murray
Current date: ${new Date().toISOString().slice(0, 10)}

Execute this task thoroughly and return the results.`;

  return askClaudeCode(fullPrompt, {
    model: config.model,
    allowedTools: config.tools.length > 0 ? config.tools : undefined,
    timeout: 300000,
  });
}

/**
 * Run a Claude Code agent for autonomous multi-step tasks
 */
export async function runClaudeAgent(
  goal: string,
  options: {
    maxTurns?: number;
    workingDir?: string;
  } = {}
): Promise<ClaudeCodeResult> {
  const maxTurns = options.maxTurns || 10;

  const prompt = `You are an autonomous agent working towards this goal:

${goal}

Work step by step until the goal is achieved or you've determined it cannot be completed.
Report your progress and final results.`;

  return askClaudeCode(prompt, {
    model: 'opus',
    timeout: 600000, // 10 minutes for agent tasks
  });
}

// Export singleton instance
export const jarvisBridge = {
  // Ollama (local AI)
  queryOllama,
  checkOllamaStatus,

  // Jarvis orchestrator
  getOrchestratorStatus,
  delegateTask,
  runHealthCheck,

  // BOSS agent
  getBOSSStatus,
  runBOSSCycle,
  getBOSSRevenue,

  // Messaging (Clawdbot)
  sendMessage,
  sendWhatsApp,
  sendTelegram,
  getGatewayStatus,

  // Memory (clawd)
  readMemory,
  writeMemory,
  appendToMemory,
  getTodayMemory,

  // Claude Code
  askClaudeCode,
  delegateToClaudeCode,
  runClaudeAgent,

  // Smart assistant
  askAssistant,

  // System status
  getFullSystemStatus,
};

export default jarvisBridge;
