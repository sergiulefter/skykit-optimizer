import axios, { AxiosInstance } from 'axios';
import { HourRequestDto, HourResponseDto } from '../types';

const DEFAULT_API_KEY = '8ea40362-68fb-4473-95a9-32b7d47c9362';
const DEFAULT_BASE_URL = 'https://hackaton2025-lsac-eval.cfapps.eu12.hana.ondemand.com';

export class ApiClient {
  private client: AxiosInstance;
  private sessionId: string | null = null;
  private apiKey: string;

  constructor(apiKey: string = DEFAULT_API_KEY, baseUrl: string = DEFAULT_BASE_URL) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey
      }
    });
  }

  async startSession(): Promise<string> {
    try {
      const response = await this.client.post<string>('/api/v1/session/start');
      this.sessionId = response.data;
      console.log(`[API] Session started: ${this.sessionId}`);
      return this.sessionId as string;
    } catch (error) {
      console.error('[API] Failed to start session:', error);
      throw error;
    }
  }

  async playRound(request: HourRequestDto): Promise<HourResponseDto> {
    if (!this.sessionId) {
      throw new Error('Session not started. Call startSession() first.');
    }

    try {
      const response = await this.client.post<HourResponseDto>(
        '/api/v1/play/round',
        request,
        {
          headers: {
            'SESSION-ID': this.sessionId
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`[API] Failed to play round (Day ${request.day}, Hour ${request.hour}):`, error);
      throw error;
    }
  }

  async endSession(): Promise<HourResponseDto | null> {
    if (!this.sessionId) {
      throw new Error('Session not started.');
    }

    try {
      // Note: /session/end uses API-KEY header (already set in client defaults)
      // It does NOT use SESSION-ID - the server finds session by API key
      const response = await this.client.post<HourResponseDto>(
        '/api/v1/session/end',
        {}
      );

      console.log(`[API] Session ended. Final cost: ${response.data.totalCost}`);
      return response.data;
    } catch (error) {
      // Handle 404 gracefully - means game completed and server auto-ended session
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('[API] Session already ended (game completed automatically)');
        return null;
      }
      console.error('[API] Failed to end session:', error);
      throw error;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getApiKey(): string {
    return this.apiKey;
  }
}
