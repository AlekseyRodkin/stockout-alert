import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './api/middleware/errorHandler'
import { logger } from './utils/logger'
import { startScheduler, stopScheduler } from './workers/scheduler'

// Импортируем routes
import authRoutes from './api/routes/auth'
import skusRoutes from './api/routes/skus'
import alertsRoutes from './api/routes/alerts'
import dashboardRoutes from './api/routes/dashboard'

// Загружаем переменные окружения
dotenv.config()

// Создаём Express приложение
const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true
}))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  })
})

// API Version
app.get('/api/version', (req, res) => {
  res.status(200).json({
    version: '0.1.0',
    name: 'StockOut Alert API',
    description: 'REST API для предупреждения о stock-out товаров на маркетплейсах'
  })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/skus', skusRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api', dashboardRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint не найден',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  })
})

// Error handler
app.use(errorHandler)

// Запускаем сервер
const server = app.listen(PORT, () => {
  logger.info(`🚀 StockOut Alert API запущен на http://localhost:${PORT}`)
  logger.info(`📊 Health check: GET http://localhost:${PORT}/health`)
  logger.info(`📖 API docs: GET http://localhost:${PORT}/api/version`)
  
  // Запускаем background scheduler для синхронизации
  logger.info('\n📅 Инициализирую background scheduler...')
  startScheduler()
})

// Обработка SIGTERM
process.on('SIGTERM', () => {
  logger.info('📴 Получен сигнал SIGTERM, завершаю приложение...')
  stopScheduler()
  server.close(() => {
    logger.info('✅ Сервер остановлен')
    process.exit(0)
  })
})

// Обработка SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('📴 Получен сигнал SIGINT, завершаю приложение...')
  stopScheduler()
  server.close(() => {
    logger.info('✅ Сервер остановлен')
    process.exit(0)
  })
})

export default app
