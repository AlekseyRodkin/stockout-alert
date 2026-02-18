# StockOut Alert API Documentation

REST API для фронтенда и Telegram бота. Все endpoints (кроме auth/login и /health) требуют JWT токен в заголовке `Authorization: Bearer <token>`.

## Base URL
```
http://localhost:3000
```

## Authentication

Все защищённые endpoints требуют JWT токен:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints

### 🔐 Auth (Аутентификация)

#### POST `/api/auth/login`
Обменять OAuth код маркетплейса на JWT токен.

**Request:**
```json
{
  "marketplace": "wb",
  "code": "oauth_code_from_marketplace"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sellerId": "wb-oauth_code_hash",
  "skus": [
    { "id": 12345, "name": "Чехол iPhone", "lastUpdated": "2026-02-17T10:00:00Z" },
    { "id": 54321, "name": "Стекло", "lastUpdated": "2026-02-17T09:30:00Z" }
  ]
}
```

#### GET `/api/auth/verify`
Проверить валидность текущего токена.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "valid": true,
  "sellerId": "wb-abc123...",
  "marketplace": "wb",
  "createdAt": "2026-02-01T15:30:00Z"
}
```

#### POST `/api/auth/logout`
Логаут (просто удаль токен на клиенте).

**Response (200):**
```json
{
  "status": "ok",
  "message": "Удалите токен на клиенте"
}
```

---

### 📦 SKU (Товары)

#### GET `/api/skus`
Получить список всех SKU продавца.

**Response (200):**
```json
{
  "total": 45,
  "skus": [
    {
      "id": 12345,
      "name": "Чехол iPhone",
      "lastUpdated": "2026-02-17T10:00:00Z",
      "currentStock": 150
    }
  ]
}
```

#### GET `/api/skus/{skuId}`
Получить детали SKU и текущий прогноз.

**Response (200):**
```json
{
  "skuId": 12345,
  "name": "Чехол iPhone",
  "platform": "wb",
  "marketplaceSku": "WB12345",
  "currentStock": 150,
  "lastUpdated": "2026-02-17T10:00:00Z",
  "forecast": {
    "stockoutDate": "2026-03-16",
    "daysUntilStockout": 27,
    "confidence": 85,
    "recommendation": "Закажи 300 шт в день 2026-02-22",
    "predictedDailySales": 15
  }
}
```

#### GET `/api/skus/{skuId}/forecast`
Получить прогноз stock-out для SKU.

**Response (200):**
```json
{
  "skuId": 12345,
  "name": "Чехол iPhone",
  "forecast": [
    {
      "date": "2026-02-17",
      "expectedStock": 150,
      "dailySales": 15
    },
    {
      "date": "2026-02-18",
      "expectedStock": 135,
      "dailySales": 15
    }
  ],
  "stockOutDate": "2026-03-16",
  "confidence": 85,
  "recommendation": "Закажи 300 шт в день 2026-02-22"
}
```

#### GET `/api/skus/{skuId}/forecast-history`
Получить историю прогнозов за 60 дней.

**Response (200):**
```json
{
  "skuId": 12345,
  "daysBack": 60,
  "forecast": [
    {
      "date": "2026-02-17",
      "expectedStock": 150,
      "dailySales": 15,
      "stockoutDate": "2026-03-16",
      "confidence": 85
    }
  ]
}
```

---

### 🔔 Alerts (Алерты)

#### POST `/api/alerts/subscribe`
Подписаться на алерты за N дней до stock-out.

**Request:**
```json
{
  "skuId": 12345,
  "alertDays": 7,
  "telegramChatId": "123456789"
}
```

**Response (201):**
```json
{
  "status": "ok",
  "message": "Подписка создана",
  "details": {
    "skuId": 12345,
    "alertDays": 7,
    "telegramChatId": "123456789"
  }
}
```

#### GET `/api/alerts/subscriptions`
Получить все активные подписки.

**Response (200):**
```json
{
  "total": 10,
  "subscriptions": [
    {
      "id": "sub-001",
      "skuId": 12345,
      "skuName": "Чехол iPhone",
      "alertDays": 7,
      "telegramChatId": "123456789",
      "createdAt": "2026-02-10T15:30:00Z"
    }
  ]
}
```

#### DELETE `/api/alerts/subscriptions/{subscriptionId}`
Удалить подписку на алерты.

**Response (200):**
```json
{
  "status": "ok",
  "message": "Подписка удалена",
  "subscriptionId": "sub-001"
}
```

#### GET `/api/alerts/history`
Получить историю отправленных алертов.

**Query Params:**
- `skuId` (optional) — фильтр по SKU

**Response (200):**
```json
{
  "total": 5,
  "history": [
    {
      "id": "alert-001",
      "alertType": "stockout_warning",
      "sentAt": "2026-02-16T10:00:00Z",
      "status": "sent"
    }
  ]
}
```

#### GET `/api/alerts/upcoming`
Получить предстоящие алерты (SKU которые скоро stock-out).

**Response (200):**
```json
{
  "total": 3,
  "upcomingAlerts": [
    {
      "skuId": 12345,
      "skuName": "Чехол iPhone",
      "daysUntilStockout": 3,
      "stockoutDate": "2026-02-20",
      "confidence": 85,
      "alertLevel": "critical"
    }
  ]
}
```

---

### 📊 Dashboard (Дашборд)

#### GET `/api/dashboard`
Получить основные метрики дашборда.

**Response (200):**
```json
{
  "skusTotal": 45,
  "skusAtRisk": 3,
  "atRiskList": [
    {
      "skuId": 12345,
      "name": "Чехол iPhone",
      "daysUntilStockout": 3,
      "confidence": 85
    }
  ]
}
```

#### GET `/api/dashboard/metrics`
Расширенные метрики.

**Response (200):**
```json
{
  "skuMetrics": {
    "total": 45,
    "lowStock": 8,
    "atRisk": 3,
    "lastUpdated": "2026-02-17T10:00:00Z"
  },
  "alertMetrics": {
    "activeSubscriptions": 15
  },
  "healthScore": 82
}
```

#### GET `/api/dashboard/trends`
Тренды за период.

**Query Params:**
- `days` (default: 30, max: 90) — количество дней для анализа

**Response (200):**
```json
{
  "period": "30 дней",
  "daysBack": 30,
  "trends": [
    {
      "date": "2026-02-17",
      "avgStock": 245,
      "avgDailySales": 12,
      "skuCount": 45
    }
  ]
}
```

#### GET `/api/dashboard/alerts-summary`
Краткая сводка по алертам.

**Response (200):**
```json
{
  "summary": {
    "critical": 2,
    "warning": 5,
    "normal": 38,
    "total": 45
  },
  "actions": [
    "⚠️ 2 SKU в критическом состоянии!",
    "📢 5 SKU требуют внимания"
  ]
}
```

---

### 🏥 Health & Info

#### GET `/health`
Health check.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T10:00:00Z",
  "version": "0.1.0"
}
```

#### GET `/api/version`
Версия API.

**Response (200):**
```json
{
  "version": "0.1.0",
  "name": "StockOut Alert API",
  "description": "REST API для предупреждения о stock-out товаров на маркетплейсах"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Ошибка валидации",
  "code": "VALIDATION_ERROR",
  "details": "skuId должен быть положительным числом"
}
```

### 401 Unauthorized
```json
{
  "error": "Токен истёк",
  "code": "TOKEN_EXPIRED",
  "expiredAt": "2026-03-19T15:30:00Z"
}
```

### 404 Not Found
```json
{
  "error": "SKU не найден",
  "code": "SKU_NOT_FOUND"
}
```

### 500 Internal Server Error
```json
{
  "error": "Внутренняя ошибка сервера",
  "code": "INTERNAL_ERROR"
}
```

---

## Testing with curl

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "marketplace": "wb",
    "code": "test_oauth_code_12345"
  }'
```

### Get SKUs (with token)
```bash
TOKEN="<your_jwt_token>"
curl -X GET http://localhost:3000/api/skus \
  -H "Authorization: Bearer $TOKEN"
```

### Subscribe to alerts
```bash
TOKEN="<your_jwt_token>"
curl -X POST http://localhost:3000/api/alerts/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "skuId": 12345,
    "alertDays": 7,
    "telegramChatId": "123456789"
  }'
```

### Get dashboard
```bash
TOKEN="<your_jwt_token>"
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $TOKEN"
```
