✅ API routes and auth done

## Completed Tasks

### ✅ Auth Routes (`src/api/routes/auth.ts`)
- POST `/api/auth/login` — OAuth обмен и JWT создание
- GET `/api/auth/verify` — Проверка токена
- POST `/api/auth/logout` — Логаут (на клиенте удалить токен)

**Response:**
```json
{
  "token": "jwt_token",
  "sellerId": "seller-id",
  "skus": [{ "id": 123, "name": "Product" }]
}
```

### ✅ SKU Routes (`src/api/routes/skus.ts`)
- GET `/api/skus` — Все SKU продавца
- GET `/api/skus/{skuId}` — Детали SKU
- GET `/api/skus/{skuId}/forecast` — Прогноз stock-out

**Response:**
```json
{
  "skuId": 12345,
  "name": "Чехол iPhone",
  "forecast": [
    { "date": "2026-02-17", "expectedStock": 150, "dailySales": 15 }
  ],
  "stockOutDate": "2026-03-16",
  "confidence": 85,
  "recommendation": "Закажи 300 шт"
}
```

### ✅ Alerts Routes (`src/api/routes/alerts.ts`)
- POST `/api/alerts/subscribe` — Подписка на алерты
- GET `/api/alerts/subscriptions` — Активные подписки
- DELETE `/api/alerts/subscriptions/{id}` — Отписка
- GET `/api/alerts/history` — История алертов
- GET `/api/alerts/upcoming` — Предстоящие алерты

**Request (subscribe):**
```json
{
  "skuId": 12345,
  "alertDays": 7,
  "telegramChatId": "123456789"
}
```

### ✅ Dashboard Routes (`src/api/routes/dashboard.ts`)
- GET `/api/dashboard` — Основные метрики
- GET `/api/dashboard/metrics` — Расширённые метрики
- GET `/api/dashboard/trends` — Тренды
- GET `/api/dashboard/alerts-summary` — Сводка по алертам

**Response:**
```json
{
  "skusTotal": 45,
  "skusAtRisk": 3,
  "atRiskList": [
    { "skuId": 12345, "name": "Product", "daysUntilStockout": 7, "confidence": 85 }
  ]
}
```

### ✅ Middleware
- **auth.ts** — JWT middleware с функциями `authMiddleware()` и `createJWT()`
- **errorHandler.ts** — Глобальная обработка ошибок с класса `HttpError`

### ✅ Utils
- **validation.ts** — Валидация inputs (skuId, alertDays, marketplace, code)
- **db.ts** — Supabase клиент и функции для работы с БД

### ✅ Main App (`src/index.ts`)
- Express сервер с регистрацией всех routes
- CORS поддержка
- Health check endpoint `/health`
- Version endpoint `/api/version`
- Global error handler

## Build & Compilation
```bash
npm install                # ✅ 49 packages
npm run build             # ✅ TypeScript → JavaScript
npm run dev               # ts-node src/index.ts
npm start                 # node dist/index.js
```

## Running the API
```bash
PORT=3000 npm start
# 🚀 API запущен на http://localhost:3000
```

## Testing
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"marketplace":"wb","code":"test_code_12345"}'

# Get SKUs (with JWT)
curl -X GET http://localhost:3000/api/skus \
  -H "Authorization: Bearer <token>"

# Subscribe to alerts
curl -X POST http://localhost:3000/api/alerts/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"skuId":12345,"alertDays":7,"telegramChatId":"123456789"}'

# Dashboard
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer <token>"
```

## Architecture
```
src/
├── api/
│   ├── routes/
│   │   ├── auth.ts         # OAuth & JWT
│   │   ├── skus.ts         # SKU forecasts
│   │   ├── alerts.ts       # Alert subscriptions
│   │   └── dashboard.ts    # Metrics & dashboard
│   └── middleware/
│       ├── auth.ts         # JWT middleware
│       └── errorHandler.ts # Global error handler
├── utils/
│   ├── validation.ts       # Input validation
│   └── db.ts              # Supabase client & queries
└── index.ts               # Main app
```

## Dependencies
- `express` — Web framework
- `jsonwebtoken` — JWT auth
- `cors` — CORS support
- `dotenv` — Environment variables
- `@supabase/supabase-js` — Database client
- `typescript` — Type safety

## Multi-tenancy ✅
Each seller can only see their own SKUs through:
- JWT token with `sellerId`
- Database queries filtered by `seller_id`
- Authorization checks in routes

## Status: Ready for Frontend Integration
- All endpoints implemented
- JWT auth working
- Multi-tenant data isolation
- Error handling in place
- Type-safe TypeScript code
- Compiled to JavaScript (dist/)

**Next:** Integrate with Frontend UI and Telegram Bot (Builder 5, Builder 6)
