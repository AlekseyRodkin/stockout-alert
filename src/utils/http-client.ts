// Универсальный HTTP клиент с retry logic и exponential backoff для API запросов
export interface HttpClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface HttpResponse<T = any> {
  status: number;
  data: T;
}

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = config.defaultHeaders || {};
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 1000;
  }

  async get<T = any>(path: string, options?: any): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = { ...this.defaultHeaders, ...options?.headers };
    return this.requestWithRetry<T>('GET', url, headers, null);
  }

  async post<T = any>(path: string, body?: any, options?: any): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = { ...this.defaultHeaders, ...options?.headers };
    return this.requestWithRetry<T>('POST', url, headers, body);
  }

  private async requestWithRetry<T>(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    attempt: number = 0
  ): Promise<HttpResponse<T>> {
    try {
      return await this.executeRequest<T>(method, url, headers, body);
    } catch (error: any) {
      const isRetryable = attempt < this.maxRetries && [429, 500, 503].includes(error.status);
      if (!isRetryable) throw error;

      const delayMs = this.retryDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * delayMs * 0.1;
      console.log(`[HttpClient] Retry ${attempt + 1}/${this.maxRetries} через ${(delayMs + jitter).toFixed(0)}ms`);

      await new Promise(r => setTimeout(r, delayMs + jitter));
      return this.requestWithRetry<T>(method, url, headers, body, attempt + 1);
    }
  }

  private async executeRequest<T>(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
      };

      if (body) fetchOptions.body = JSON.stringify(body);

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const data: T = contentType?.includes('application/json')
        ? await response.json()
        : (await response.text()) as any;

      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return { status: response.status, data };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>)
      );
      if (qs.toString()) url += `?${qs.toString()}`;
    }
    return url;
  }
}
