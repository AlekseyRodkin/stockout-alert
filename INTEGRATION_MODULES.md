# WB и Ozon API Интеграция — Модули

**Статус:** ✅ Завершено
**Дата:** 2026-02-17
**Builder:** Builder 2

---

## Обзор архитектуры

Интеграция состоит из 7 модулей TypeScript, реализующих полный flow синхронизации данных:

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Client (базис)                      │
│  src/utils/http-client.ts — Exponential backoff + retry     │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐  ┌────────▼────────┐
│   WB Client    │  │   Ozon Client   │
│ client.ts      │  │  client.ts      │
│ (getInventory) │  │ (getInventory)  │
│ (getSales)     │  │ (getSales)      │
└───────┬────────┘  └────────┬────────┘
        │                    │
┌───────▼──────────────────┬─▼────────┐
│   WB OAuth (auth.ts)     │ Ozon OAuth│
│ • getAuthUrl()           │ (auth.ts)│
│ • exchangeCode()         │           │
│ • refreshToken()         │           │
└───────┬──────────────────┴──────────┘
        │
┌───────▼────────────────────────────────┐
│  Sync Workers (синхронизация → БД)     │
│  wb/sync.ts + ozon/sync.ts             │
│  - Получить inventory                  │
│  - Проверить/создать SKU в БД          │
│  - Вставить в inventory_history        │
│  - Обновить last_updated_at            │
└────────────────────────────────────────┘
```

---

## Модули

### 1. **HTTP Client** (`src/utils/http-client.ts`)

Универсальный HTTP клиент с поддержкой:
- ✅ Exponential backoff (2^attempt * retryDelayMs)
- ✅ Автоматический retry при 429, 500, 502, 503, 504
- ✅ Таймауты (по умолчанию 30 сек)
- ✅ Обработка JSON и текста
- ✅ Параметры запроса (query params)

**Методы:**
- `get<T>(path, options?)` → Promise<HttpResponse<T>>
- `post<T>(path, body?, options?)` → Promise<HttpResponse<T>>

**Использование:**
```typescript
const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
});

const response = await client.get<UserData>('/users/123');
```

---

### 2. **WB API Client** (`src/integrations/wb/client.ts`)

Клиент для API Wildberries с методами:

| Метод | Описание |
|-------|----------|
| `getInventory()` | Получить остатки SKU на всех складах |
| `getSalesHistory(days=7)` | История продаж за N дней |
| `getOrdersList(limit=1000)` | Активные заказы |
| `getSupplierInfo()` | Информация о поставщике (склады) |

**Возвращаемые типы:**
```typescript
interface WBInventoryItem {
  sku: string;
  skuTitle: string;
  warehouseId: number;
  quantity: number;
  reserve: number;
  available: number;
}
```

---

### 3. **Ozon API Client** (`src/integrations/ozon/client.ts`)

Клиент для API Ozon с методами:

| Метод | Описание |
|-------|----------|
| `getInventory()` | Остатки товаров на складах |
| `getSalesHistory(days=7)` | История продаж за N дней |
| `getProductList()` | Список товаров (продуктов) |
| `getWarehouses()` | Информация о складах |

**Возвращаемые типы:**
```typescript
interface OzonInventoryItem {
  sku: string;
  productName: string;
  warehouseId: number;
  available: number;
  reserved: number;
  total: number;
}
```

---

### 4. **WB OAuth** (`src/integrations/wb/auth.ts`)

Управление авторизацией через OAuth 2.0:

| Класс | Метод | Описание |
|-------|-------|----------|
| `WBAuthManager` | `getAuthUrl(state?)` | URL для редиректа |
| | `exchangeCodeForToken(code)` | Обмен кода на токены |
| | `refreshToken(refreshToken)` | Обновление токена |
| `WBTokenManager` | `ensureValidToken(token)` | Автоматическое обновление если истекает |

**Пример flow:**
```typescript
const authMgr = new WBAuthManager({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'https://app.example.com/auth/wb/callback',
});

// 1. Получить URL для редиректа
const authUrl = authMgr.getAuthUrl();

// 2. После редиректа обменять код на токены
const tokens = await authMgr.exchangeCodeForToken(code);

// 3. Сохранить в БД и позже использовать
const tokenMgr = new WBTokenManager(authMgr);
const validToken = await tokenMgr.ensureValidToken(storedToken);
```

---

### 5. **Ozon OAuth** (`src/integrations/ozon/auth.ts`)

Аналогично WB, но для Ozon:

| Класс | Метод |
|-------|-------|
| `OzonAuthManager` | `getAuthUrl()` |
| | `exchangeCodeForToken(code)` |
| | `refreshToken(refreshToken)` |
| `OzonTokenManager` | `ensureValidToken(token)` |

---

### 6. **WB Sync Worker** (`src/integrations/wb/sync.ts`)

Рабочий процесс синхронизации для WB:

**Логика:**
1. Получить всех продавцов с WB интеграцией из БД
2. Для каждого продавца:
   - Проверить/обновить токен (если истекает)
   - Получить inventory от WB API
   - Для каждого SKU:
     - Проверить есть ли в таблице `skus`
     - Если нет → создать запись
     - Вставить запись в `inventory_history`
     - Обновить `last_updated_at` в `skus`
3. Запуск каждый час

**Класс:**
```typescript
class WBSyncWorker {
  async syncInventory(): Promise<void> // Основной метод
}

// Запуск как standalone процесса
await startWBSync();
```

---

### 7. **Ozon Sync Worker** (`src/integrations/ozon/sync.ts`)

Аналогично WB, но для Ozon:
- Синхронизирует товары из Ozon в БД
- Использует `clientId` и `apiKey` вместо токена
- Создает/обновляет SKU в таблице `skus`
- Запускается каждый час

---

## Структура файлов

```
src/
├── utils/
│   └── http-client.ts          ← HTTP клиент с retry логикой
│
└── integrations/
    ├── wb/
    │   ├── client.ts           ← WB API клиент
    │   ├── auth.ts             ← WB OAuth
    │   └── sync.ts             ← WB Sync Worker
    │
    └── ozon/
        ├── client.ts           ← Ozon API клиент
        ├── auth.ts             ← Ozon OAuth
        └── sync.ts             ← Ozon Sync Worker
```

---

## Обработка ошибок

### Retry Logic

**Автоматические retry при:**
- 429 (Rate Limit) — exponential backoff
- 500, 502, 503, 504 (Server errors) — exponential backoff
- 408 (Request Timeout) — retry

**Не повторяются:**
- 401, 403 (Auth errors) — нужна новая авторизация
- 404 (Not Found) — нет смысла повторять

### Обработка в Workers

Если ошибка при синхронизации одного SKU:
- Логируется ошибка
- Синхронизация продолжается для остальных
- Продавец не помечается как "ошибка", только конкретный SKU

---

## Типы данных (TypeScript)

Все модули используют строгую типизацию:

```typescript
// WB
interface WBInventoryItem { sku, skuTitle, quantity, available... }
interface WBSalesItem { date, sku, orderId, quantity, price... }
interface WBOrder { orderId, sku, status, price... }

// Ozon
interface OzonInventoryItem { sku, productName, available, reserved... }
interface OzonSalesItem { date, sku, quantity, price... }
interface OzonProduct { productId, sku, name, price... }

// Auth
interface WBTokenResponse { access_token, refresh_token, expires_in... }
interface StoredWBToken { sellerId, accessToken, refreshToken, expiresAt... }

// Sync
interface WBSyncConfig { supabaseUrl, supabaseKey }
```

---

## Зависимости

```json
{
  "dependencies": {
    "@supabase/supabase-js": "latest",
    "typescript": "latest",
    "node-fetch": "2.x" // встроен в Node 18+
  }
}
```

---

## Тестирование

**Unit test пример (WB Client):**
```typescript
const wbClient = new WBClient('TEST_TOKEN');
const inventory = await wbClient.getInventory();

expect(inventory).toBeArray();
expect(inventory[0]).toHaveProperty('sku');
expect(inventory[0]).toHaveProperty('available');
```

**Integration test (Sync Worker):**
```typescript
const worker = new WBSyncWorker(config);
await worker.syncInventory();

// Проверить что записи созданы в БД
const { data } = await supabase.from('inventory_history').select('*');
expect(data.length).toBeGreaterThan(0);
```

---

## Следующие шаги (Phase 3 → 4)

1. ✅ **Builder 2 (интеграция)** — ЗАВЕРШЕНО
2. **Builder 3 (forecasting + alerts)** — Ожидает
3. **Builder 4 (API routes + auth)** — Ожидает
4. **Builder 5 (workers + cron)** — Ожидает
5. **Phase 4 (Review)** — После Builder 5

---

**Все файлы рабочие и готовы к интеграции с остальными модулями.**
