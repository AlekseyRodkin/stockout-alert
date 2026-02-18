// Ozon API Client для получения остатков, продаж и товаров
import { HttpClient } from '../../utils/http-client';

export class OzonClient {
  private client: HttpClient;

  constructor(private clientId: string, private apiKey: string) {
    this.client = new HttpClient({
      baseUrl: 'https://api-seller.ozon.ru',
      defaultHeaders: { 'Client-Id': clientId, 'Api-Key': apiKey },
      timeout: 30000,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  }

  async getInventory(): Promise<any[]> {
    console.log('[Ozon] Получаем остатки...');
    try {
      const res = await this.client.post<any>(
        '/v2/products/stocks',
        { limit: 1000, offset: 0 },
        { headers: { 'Client-Id': this.clientId, 'Api-Key': this.apiKey } }
      );
      return res.data.stocks?.flatMap((s: any) =>
        s.warehouses?.map((w: any) => ({
          sku: s.sku,
          productName: s.name || '',
          warehouseId: w.warehouse_id,
          available: w.available || 0,
          reserved: w.reserved || 0,
          total: (w.available || 0) + (w.reserved || 0),
        })) || []
      ) || [];
    } catch (error) {
      console.error('[Ozon] getInventory error:', error);
      throw error;
    }
  }

  async getSalesHistory(days: number = 7): Promise<any[]> {
    console.log(`[Ozon] Получаем продажи за ${days} дней...`);
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      const res = await this.client.post<any>(
        '/v2/finance/transaction/list',
        {
          filter: {
            date: {
              from: fromDate.toISOString().split('T')[0],
              to: toDate.toISOString().split('T')[0],
            },
            transaction_type: 'order',
          },
          page: 1,
          page_size: 1000,
        },
        { headers: { 'Client-Id': this.clientId, 'Api-Key': this.apiKey } }
      );
      return res.data.transactions || [];
    } catch (error) {
      console.error('[Ozon] getSalesHistory error:', error);
      throw error;
    }
  }

  async getProductList(): Promise<any[]> {
    console.log('[Ozon] Получаем товары...');
    try {
      const res = await this.client.post<any>(
        '/v2/products/list',
        { filter: { visibility: 'ALL' }, limit: 1000, offset: 0 },
        { headers: { 'Client-Id': this.clientId, 'Api-Key': this.apiKey } }
      );
      return res.data.products || [];
    } catch (error) {
      console.error('[Ozon] getProductList error:', error);
      throw error;
    }
  }
}
