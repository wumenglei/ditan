export interface SaasInitPayload {
  type: 'SAAS_INIT';
  userId?: unknown;
  toolId?: unknown;
  context?: unknown;
  prompt?: unknown;
  callbackUrl?: unknown;
}

export interface SaasSession {
  userId: string;
  toolId: string;
  context: string;
  prompt: string[];
  callbackUrl: string;
}

export interface ToolLaunchData {
  user?: {
    name?: string;
    enterprise?: string;
    integral?: number;
  };
  tool?: {
    name?: string;
    integral?: number;
  };
}

export interface ToolVerifyData {
  currentIntegral?: number;
  requiredIntegral?: number;
}

export interface ToolConsumeData {
  currentIntegral?: number;
  consumedIntegral?: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  valid?: boolean;
  message?: string;
  data?: T;
}

const invalidIdValues = new Set(['', 'null', 'undefined']);

export function isValidSaasId(value: unknown): value is string {
  return typeof value === 'string' && !invalidIdValues.has(value.trim().toLowerCase());
}

export function normalizeSaasInit(data: unknown): SaasSession | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as SaasInitPayload;
  if (payload.type !== 'SAAS_INIT') return null;
  if (!isValidSaasId(payload.userId) || !isValidSaasId(payload.toolId)) return null;

  const context = typeof payload.context === 'string' ? payload.context.trim() : '';
  const prompt = Array.isArray(payload.prompt)
    ? payload.prompt.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof payload.prompt === 'string' && payload.prompt.trim()
      ? [payload.prompt.trim()]
      : [];

  return {
    userId: payload.userId.trim(),
    toolId: payload.toolId.trim(),
    context,
    prompt,
    callbackUrl: typeof payload.callbackUrl === 'string' ? payload.callbackUrl.trim() : '',
  };
}

export function mergePromptWithSaas(customPrompt: string, session: SaasSession | null): string {
  const parts = [customPrompt.trim()].filter(Boolean);

  if (session?.context) {
    parts.push(`SaaS 内容主体: ${session.context}`);
  }

  if (session?.prompt.length) {
    parts.push(`SaaS 补充关键词: ${session.prompt.join('、')}`);
  }

  return parts.join('\n');
}

export async function launchTool(session: SaasSession): Promise<ToolLaunchData> {
  return requestTool<ToolLaunchData>('/api/tool/launch', session, '启动接口调用失败');
}

export async function verifyTool(session: SaasSession): Promise<ToolVerifyData> {
  return requestTool<ToolVerifyData>('/api/tool/verify', session, '积分校验失败');
}

export async function consumeTool(session: SaasSession): Promise<ToolConsumeData> {
  return requestTool<ToolConsumeData>('/api/tool/consume', session, '积分扣除失败');
}

async function requestTool<T>(endpoint: string, session: SaasSession, fallbackMessage: string): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: session.userId,
      toolId: session.toolId,
    }),
  });

  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${fallbackMessage}：后端未返回有效 JSON`);
  }

  const accepted = response.ok && (payload.success === true || payload.valid === true);
  if (!accepted) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload.data || ({} as T);
}
