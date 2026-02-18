/**
 * Scheduler - планировщик фоновых задач
 * Запускает синхронизацию каждый час в 00 минут (0 * * * *)
 */

import schedule from 'node-schedule'
import { logger } from '../utils/logger'
import {
  getAllSellers,
  syncInventoryWB,
  syncInventoryOzon,
  recalculateAllForecasts,
  checkAndSendAlerts,
} from './sync-worker'

let isRunning = false

/**
 * Главный цикл синхронизации
 * 1. Получить всех sellers
 * 2. Синхронизировать каждого (WB/Ozon)
 * 3. Пересчитать прогнозы
 * 4. Проверить алерты
 */
async function runSyncCycle() {
  if (isRunning) {
    logger.warn('⚠️  Цикл уже запущен, пропускаю')
    return
  }

  isRunning = true
  const cycleStartTime = Date.now()

  try {
    logger.info('═════════════════════════════════════════')
    logger.info('🔄 ЦИКЛ СИНХРОНИЗАЦИИ НАЧАТ')
    logger.info(`⏰ ${new Date().toLocaleString('ru-RU')}`)
    logger.info('═════════════════════════════════════════')

    // 1. Получаем sellers
    const sellers = await getAllSellers()

    if (sellers.length === 0) {
      logger.warn('⚠️  Нет sellers')
      isRunning = false
      return
    }

    logger.info(`📋 Sellers: ${sellers.length}`)

    // Статистика
    const results = {
      total: sellers.length,
      successful: 0,
      failed: 0,
      forecasts: 0,
      alerts: 0,
    }

    // 2. Синхронизируем каждого seller
    for (const seller of sellers) {
      try {
        logger.info(`\n📦 Seller: ${seller.seller_id} (${seller.marketplace})`)

        let syncOk = true

        // Синхронизируем в зависимости от marketplace
        if (seller.marketplace === 'wb') {
          syncOk = await syncInventoryWB(seller)
        } else if (seller.marketplace === 'ozon') {
          syncOk = await syncInventoryOzon(seller)
        } else {
          logger.error(`❌ Неизвестный marketplace: ${seller.marketplace}`)
          syncOk = false
        }

        // Если синхронизация успешна - пересчитываем прогнозы
        if (syncOk) {
          results.successful++
          const forecasts = await recalculateAllForecasts(seller)
          results.forecasts += forecasts
        } else {
          results.failed++
        }
      } catch (err) {
        logger.error(`❌ Ошибка seller ${seller.seller_id}:`, err)
        results.failed++
      }
    }

    // 3. Проверяем алерты
    try {
      logger.info('\n📢 Проверяю алерты...')
      const alerts = await checkAndSendAlerts()
      results.alerts = alerts
    } catch (err) {
      logger.error('❌ Ошибка алертов:', err)
    }

    // Итоговый отчет
    const duration = ((Date.now() - cycleStartTime) / 1000).toFixed(2)

    logger.info('═════════════════════════════════════════')
    logger.info('✅ ЦИКЛ ЗАВЕРШЁН')
    logger.info(`⏱️  Время: ${duration}s`)
    logger.info('📊 РЕЗУЛЬТАТЫ:')
    logger.info(`  • Sellers успешно: ${results.successful}/${results.total}`)
    logger.info(`  • Ошибок: ${results.failed}`)
    logger.info(`  • Прогнозов: ${results.forecasts}`)
    logger.info(`  • Алертов: ${results.alerts}`)
    logger.info('═════════════════════════════════════════\n')
  } catch (err) {
    logger.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', err)
  } finally {
    isRunning = false
  }
}

/**
 * Запустить scheduler
 * Расписание: 0 * * * * (каждый час в 00 минут)
 */
export function startScheduler() {
  logger.info('🚀 Запускаю Scheduler...')

  const job = schedule.scheduleJob('0 * * * *', async () => {
    logger.info('⏲️  Запускаю цикл синхронизации...')
    await runSyncCycle()
  })

  if (job) {
    logger.info('✅ Scheduler инициализирован')
    logger.info(`📅 Расписание: каждый час в 00 минут`)
    logger.info(`🕐 Следующий запуск: ${job.nextInvocation()?.toLocaleString('ru-RU')}`)

    // Запускаем первый цикл через 10 сек
    logger.info('⚡ Первый цикл через 10 сек...')
    setTimeout(() => {
      runSyncCycle().catch((err) => {
        logger.error('Ошибка первого цикла:', err)
      })
    }, 10000)
  } else {
    logger.error('❌ Ошибка создания job')
  }

  return job
}

/**
 * Остановить scheduler
 */
export function stopScheduler() {
  logger.info('⏹️  Остановляю Scheduler...')
  schedule.gracefulShutdown()
  logger.info('✅ Scheduler остановлен')
}

/**
 * Запустить цикл вручную (для тестирования)
 */
export async function runSyncCycleManual() {
  logger.info('🔧 Ручной запуск цикла синхронизации')
  await runSyncCycle()
}
