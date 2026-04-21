import axios from 'axios';

export interface SaaSUser {
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaaSTool {
  name: string;
  integral: number;
}

export interface SaaSLaunchResponse {
  success: boolean;
  data: {
    user: SaaSUser;
    tool: SaaSTool;
  };
}

export interface SaaSVerifyResponse {
  success: boolean;
  data: {
    currentIntegral: number;
    requiredIntegral: number;
  };
  message?: string;
}

export interface SaaSConsumeResponse {
  success: boolean;
  data: {
    currentIntegral: number;
    consumedIntegral: number;
  };
}

export const saasService = {
  async launch(userId: string, toolId: string): Promise<SaaSLaunchResponse> {
    const response = await axios.post<SaaSLaunchResponse>('/api/tool/launch', { userId, toolId });
    return response.data;
  },

  async verify(userId: string, toolId: string): Promise<SaaSVerifyResponse> {
    const response = await axios.post<SaaSVerifyResponse>('/api/tool/verify', { userId, toolId });
    return response.data;
  },

  async consume(userId: string, toolId: string): Promise<SaaSConsumeResponse> {
    const response = await axios.post<SaaSConsumeResponse>('/api/tool/consume', { userId, toolId });
    return response.data;
  }
};
