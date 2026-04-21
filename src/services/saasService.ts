/**
 * SaaS 积分校验与扣除服务
 */

export interface SaasResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface UserInfo {
  name: string;
  enterprise: string;
  integral: number;
}

export interface ToolInfo {
  name: string;
  integral: number;
}

export interface LaunchData {
  user: UserInfo;
  tool: ToolInfo;
}

export interface VerifyData {
  currentIntegral: number;
  requiredIntegral: number;
}

export interface ConsumeData {
  currentIntegral: number;
  consumedIntegral: number;
}

/**
 * 启动接口：获取初始用户信息
 */
export async function launchTool(userId: string, toolId: string): Promise<SaasResponse<LaunchData>> {
  try {
    const response = await fetch('/api/tool/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return await response.json();
  } catch (error) {
    console.error('SaaS Launch Error:', error);
    return { success: false, message: '初始化失败' };
  }
}

/**
 * 校验接口：仅检查积分是否充足
 */
export async function verifyIntegral(userId: string, toolId: string): Promise<SaasResponse<VerifyData>> {
  try {
    const response = await fetch('/api/tool/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return await response.json();
  } catch (error) {
    console.error('SaaS Verify Error:', error);
    return { success: false, message: '积分校验失败' };
  }
}

/**
 * 扣费接口：实际扣除积分
 */
export async function consumeIntegral(userId: string, toolId: string): Promise<SaasResponse<ConsumeData>> {
  try {
    const response = await fetch('/api/tool/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return await response.json();
  } catch (error) {
    console.error('SaaS Consume Error:', error);
    return { success: false, message: '积分扣除失败' };
  }
}
