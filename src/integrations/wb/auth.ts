// WB OAuth интеграция
import { HttpClient } from '../../utils/http-client';

export interface WBTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class WBAuthManager {
  private httpClient: HttpClient;

  constructor(private config: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.httpClient = new HttpClient({
      baseUrl: 'https://oauth.wildberries.ru',
      timeout: 30000,
      maxRetries: 2,
      retryDelayMs: 1000,
    });
  }

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'inventory.view sales.view orders.view',
      state: state || Math.random().toString(36).substring(2, 20),
    });
    return `https://oauth.wildberries.ru/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<WBTokenResponse> {
    console.log('[WB Auth] Обмениваем код на токен...');
    const res = await this.httpClient.post<WBTokenResponse>('/oauth/token', {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });
    console.log('[WB Auth] Токен получен');
    return res.data;
  }

  async refreshToken(refreshToken: string): Promise<WBTokenResponse> {
    console.log('[WB Auth] Обновляем токен...');
    const res = await this.httpClient.post<WBTokenResponse>('/oauth/token', {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return res.data;
  }

  shouldRefreshToken(expiresAt: Date): boolean {
    return (expiresAt.getTime() - Date.now()) < 5 * 60 * 1000;
  }
}

export class WBTokenManager {
  constructor(private authManager: WBAuthManager) {}

  async ensureValidToken(token: any): Promise<string> {
    if (!this.authManager.shouldRefreshToken(new Date(token.expiresAt))) {
      return token.accessToken;
    }
    const newToken = await this.authManager.refreshToken(token.refreshToken);
    token.accessToken = newToken.access_token;
    token.refreshToken = newToken.refresh_token;
    token.expiresAt = new Date(Date.now() + newToken.expires_in * 1000);
    return newToken.access_token;
  }
}
