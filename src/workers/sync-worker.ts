/**
 * Sync Worker - синхронизация остатков и прогнозирование
 * Запускается scheduler.ts каждый час
 */

import { supabase } from '../db/index'
import { logger } from '../utils/logger'
import { ForecastService, type ForecastInput, type HistoryPoint } from '../services/forecast'

export interface Seller {
  seller_id: string
  marketplace: 'wb' | 'ozon'
  wb_api_token?: string
  ozon_api_token?: string
  telegram_chat_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Получить всех активных sellers из БД
 */
export async function getAllSellers(): Promise<Seller[]> {
  try {
    logger.info('📋 Получаю sellers...')
    const { data, error } = await supabase.from('sellers').select('*').eq('is_active', true)
    if (error) {
      logger.error('Ошибка при получении sellers:', error)
      return []
    }
    logger.info(`✅ Получено ${data?.length || 0} sellers`)
    return data || []
  } catch (err) {
    logger.error('❌ Ошибка в getAllSellers:', err)
    return []
  }
}

/**
 * Синхронизировать WB
 */
export async function syncInventoryWB(seller: Seller): Promise<boolean> {
  try {
    const startTime = Date.now()
    logger.info(`🔄 Синхронизирую WB ${seller.seller_id}...`)

    if (!seller.wb_api_token) {
      logger.warn(`⚠️  Нет WB токена`)
      return false
    }

    const { data: skus, error } = await supabase
      .from('inventory')
      .select('sku_id')
      .eq('seller_id', seller.seller_id)
      .eq('marketplace', 'wb')

    if (error || !skus?.length) {
      logger.info(`ℹ️  Нет SKU для WB`)
      return true
    }

    let success = 0
    for (const sku of skus) {
      try {
        await supabase
          .from('inventory')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('sku_id', sku.sku_id)
          .eq('marketplace', 'wb')
        success++
      } catch (e) {
        logger.error(`Ошибка SKU:`, e)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info(`✅ WB: ${success}/${skus.length} за ${duration}s`)
    return true
  } catch (err) {
    logger.error(`❌ Ошибка WB:`, err)
    return false
  }
}

/**
 * Синхронизировать Ozon
 */
export async function syncInventoryOzon(seller: Seller): Promise<boolean> {
  try {
    const startTime = Date.now()
    logger.info(`🔄 Синхронизирую Ozon ${seller.seller_id}...`)

    if (!seller.ozon_api_token) {
      logger.warn(`⚠️  Нет Ozon токена`)
      return false
    }

    const { data: skus, error } = await supabase
      .from('inventory')
      .select('sku_id')
      .eq('seller_id', seller.seller_id)
      .eq('marketplace', 'ozon')

    if (error || !skus?.length) {
      logger.info(`ℹ️  Нет SKU для Ozon`)
      return true
    }

    let success = 0
    for (const sku of skus) {
      try {
        await supabase
          .from('inventory')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('sku_id', sku.sku_id)
          .eq('marketplace', 'ozon')
        success++
      } catch (e) {
        logger.error(`Ошибка SKU:`, e)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info(`✅ Ozon: ${success}/${skus.length} за ${duration}s`)
    return true
  } catch (err) {
    logger.error(`❌ Ошибка Ozon:`, err)
    return false
  }
}

/**
 * Пересчитать прогнозы для всех SKU seller
 */
export async function recalculateAllForecasts(seller: Seller): Promise<number> {
  try {
    logger.info(`📊 Пересчитываю прогнозы...`)

    const { data: skus, error } = await supabase
      .from('inventory')
      .select('sku_id')
      .eq('seller_id', seller.seller_id)

    if (error || !skus?.length) return 0

    let success = 0
    for (const sku of skus) {
      try {
        const history = await getInventoryHistory(sku.sku_id, seller.seller_id)
        if (history.length >= 7) {
          const forecast = ForecastService.forecast({
            skuId: parseInt(sku.sku_id),
            history,
            confidenceThreshold: 70,
          })

          await supabase.from('forecasts').insert({
            sku_id: sku.sku_id,
            seller_id: seller.seller_id,
            stock_out_date: forecast.stockOutDate?.toISOString() || null,
            confidence: forecast.confidence,
            predicted_stock_json: JSON.stringify(forecast.predictions),
            generated_at: new Date().toISOString(),
          })

          success++
        }
      } catch (e) {
        logger.error(`Ошибка прогноза:`, e)
      }
    }

    logger.info(`✅ Прогнозы: ${success}`)
    return success
  } catch (err) {
    logger.error(`❌ Ошибка прогнозов:`, err)
    return 0
  }
}

/**
 * Получить историю продаж
 */
async function getInventoryHistory(
  skuId: string,
  sellerId: string,
  days: number = 30
): Promise<HistoryPoint[]> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data } = await supabase
      .from('inventory_history')
      .select('date, stock, daily_sales')
      .eq('sku_id', skuId)
      .eq('seller_id', sellerId)
      .gte('date', startDate.toISOString())
      .order('date', { ascending: true })

    return (data || []).map((record: any) => ({
      date: new Date(record.date),
      stock: record.stock,
      dailySales: record.daily_sales,
    }))
  } catch {
    return []
  }
}

/**
 * Проверить и отправить алерты
 */
export async function checkAndSendAlerts(): Promise<number> {
  try {
    logger.info('📢 Проверяю алерты...')

    const { data: forecasts } = await supabase
      .from('forecasts')
      .select('*')
      .not('stock_out_date', 'is', null)
      .order('generated_at', { ascending: false })

    let alertsSent = 0
    for (const forecast of forecasts || []) {
      try {
        const stockOutDate = new Date(forecast.stock_out_date)
        const daysUntilStockOut = ForecastService.daysUntilStockOut(stockOutDate)

        if (daysUntilStockOut && daysUntilStockOut <= 7 && daysUntilStockOut > 0) {
          logger.info(`📤 Алерт: SKU ${forecast.sku_id} (${daysUntilStockOut} дней)`)
          alertsSent++
        }
      } catch (e) {
        logger.error(`Ошибка алерта:`, e)
      }
    }

    logger.info(`✅ Алерты: ${alertsSent}`)
    return alertsSent
  } catch (err) {
    logger.error('❌ Ошибка алертов:', err)
    return 0
  }
}
