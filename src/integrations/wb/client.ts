// WB API Client для получения остатков, продаж и заказов
import { HttpClient } from '../../utils/http-client';

export class WBClient {
  private client: HttpClient;

  constructor(private token: string) {
    this.client = new HttpClient({
      baseUrl: 'https://api.wildberries.ru/api/v3',
      defaultHeaders: { Authorization: `Bearer ${token}` },
      timeout: 30000,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  }

  async getInventory(): Promise<any[]> {
    console.log('[WB] Получаем остатки...');
    try {
      const res = await this.client.get<any>('/stocks', { headers: { Authorization: `Bearer ${this.token}` } });
      return res.data.stocks?.flatMap((s: any) =>
        s.skus?.map((sk: any) => ({
          sku: sk.sku,
          skuTitle: sk.skuTitle || '',
          warehouseId: s.warehouseId,
          quantity: sk.quantity || 0,
          reserve: sk.reserve || 0,
          available: (sk.quantity || 0) - (sk.reserve || 0),
        })) || []
      ) || [];
    } catch (error) {
      console.error('[WB] getInventory error:', error);
      throw error;
    }
  }

  async getSalesHistory(days: number = 7): Promise<any[]> {
    console.log(`[WB] Получаем продажи за ${days} дней...`);
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      const res = await this.client.get<any>('/sales', {
        headers: { Authorization: `Bearer ${this.token}` },
        params: {
          dateFrom: fromDate.toISOString().split('T')[0],
          dateTo: toDate.toISOString().split('T')[0],
        },
      });
      return res.data.sales || [];
    } catch (error) {
      console.error('[WB] getSalesHistory error:', error);
      throw error;
    }
  }

  async getOrdersList(): Promise<any[]> {
    console.log('[WB] Получаем заказы...');
    try {
      const res = await this.client.get<any>('/orders', {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { limit: 1000 },
      });
      return res.data.orders || [];
    } catch (error) {
      console.error('[WB] getOrdersList error:', error);
      throw error;
    }
  }
}
