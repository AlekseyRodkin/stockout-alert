// WB Sync Worker синхронизирует остатки в БД каждый час
import { createClient } from '@supabase/supabase-js';
import { WBClient } from './client';

export class WBSyncWorker {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async syncInventory(): Promise<void> {
    console.log('[WB Sync] Начало синхронизации остатков...');
    try {
      const { data: sellers } = await this.supabase
        .from('sellers')
        .select('id, wb_token')
        .eq('marketplace', 'wb') as any;

      if (!sellers || sellers.length === 0) {
        console.log('[WB Sync] Нет WB продавцов');
        return;
      }

      for (const seller of sellers) {
        if (!seller.wb_token) continue;

        try {
          const client = new WBClient(seller.wb_token);
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
                  title: item.skuTitle,
                  marketplace: 'wb',
                  created_at: new Date().toISOString(),
                }] as any)
                .select('id')
                .single()) as any;

              if (insertError || !newSku) {
                console.error(`[WB Sync] Ошибка при создании SKU ${item.sku}:`, insertError);
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
              metadata: { total: item.quantity, reserved: item.reserve },
            }] as any);
          }

          console.log(`[WB Sync] Продавец ${seller.id}: ${inventory.length} SKU синхронизировано`);
        } catch (error) {
          console.error(`[WB Sync] Ошибка продавца ${seller.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[WB Sync] Ошибка синхронизации:', error);
    }
  }
}

export async function startWBSync(supabaseUrl: string, supabaseKey: string) {
  const worker = new WBSyncWorker(supabaseUrl, supabaseKey);
  await worker.syncInventory();
  setInterval(() => worker.syncInventory(), 60 * 60 * 1000);
}

export default WBSyncWorker;
