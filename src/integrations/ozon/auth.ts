// Ozon OAuth интеграция
import { HttpClient } from '../../utils/http-client';

export interface OzonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export class OzonAuthManager {
  private httpClient: HttpClient;

  constructor(private config: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.httpClient = new HttpClient({
      baseUrl: 'https://auth.ozon.ru',
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
      state: state || Math.random().toString(36).substring(2, 20),
    });
    return `https://auth.ozon.ru/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OzonTokenResponse> {
    console.log('[Ozon Auth] Обмениваем код на токен...');
    const res = await this.httpClient.post<OzonTokenResponse>('/oauth/token', {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });
    console.log('[Ozon Auth] Токен получен');
    return res.data;
  }

  async refreshToken(refreshToken: string): Promise<OzonTokenResponse> {
    console.log('[Ozon Auth] Обновляем токен...');
    const res = await this.httpClient.post<OzonTokenResponse>('/oauth/token', {
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

export class OzonTokenManager {
  constructor(private authManager: OzonAuthManager) {}

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
