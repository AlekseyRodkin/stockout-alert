// Ozon Sync Worker синхронизирует остатки в БД каждый час
import { createClient } from '@supabase/supabase-js';
import { OzonClient } from './client';

export class OzonSyncWorker {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async syncInventory(): Promise<void> {
    console.log('[Ozon Sync] Начало синхронизации остатков...');
    try {
      const { data: sellers } = await this.supabase
        .from('sellers')
        .select('id, ozon_client_id, ozon_api_key')
        .eq('marketplace', 'ozon') as any;

      if (!sellers || sellers.length === 0) {
        console.log('[Ozon Sync] Нет Ozon продавцов');
        return;
      }

      for (const seller of sellers) {
        if (!seller.ozon_client_id || !seller.ozon_api_key) continue;

        try {
          const client = new OzonClient(seller.ozon_client_id, seller.ozon_api_key);
          const inventory = await client.getInventory();

          for (const item of inventory) {
            const { data: existingSku } = (await this.supabase
              .from('skus')
              .select('id')
              .eq('seller_id', seller.id)
              .eq('sku_code', item.sku)
              .maybeSingle()) as any;

            let skuId: string;

            if (!existingSku) {
              const { data: newSku, error: insertError } = (await this.supabase
                .from('skus')
                .insert([{
                  seller_id: seller.id,
                  sku_code: item.sku,
                  title: item.productName,
                  marketplace: 'ozon',
                  created_at: new Date().toISOString(),
                }] as any)
                .select('id')
                .single()) as any;

              if (insertError || !newSku) {
                console.error(`[Ozon Sync] Ошибка при создании SKU ${item.sku}:`, insertError);
                continue;
              }
              skuId = newSku.id as string;
            } else {
              skuId = existingSku.id as string;
            }

            await this.supabase.from('inventory_history').insert([{
              sku_id: skuId,
              seller_id: seller.id,
              quantity: item.available,
              warehouse_id: item.warehouseId,
              recorded_at: new Date().toISOString(),
              metadata: { total: item.total, reserved: item.reserved },
            }] as any);
          }

          console.log(`[Ozon Sync] Продавец ${seller.id}: ${inventory.length} товаров синхронизировано`);
        } catch (error) {
          console.error(`[Ozon Sync] Ошибка продавца ${seller.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[Ozon Sync] Ошибка синхронизации:', error);
    }
  }
}

export async function startOzonSync(supabaseUrl: string, supabaseKey: string) {
  const worker = new OzonSyncWorker(supabaseUrl, supabaseKey);
  await worker.syncInventory();
  setInterval(() => worker.syncInventory(), 60 * 60 * 1000);
}

export default OzonSyncWorker;
