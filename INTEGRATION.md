# Integration Guide

Как интегрировать ML-систему прогнозирования с остальным pipeline.

## Архитектура взаимодействия

```
Builder 1 (Scaffold)        Builder 2 (Data Sync)      Builder 3 (ML Alerts)
       ↓                            ↓                            ↓
  БД структура      sales_history таблица        Forecast + Alerts
  (tables)          (daily sync from API)        (batch cron job)
       ↓                            ↓                            ↓
       └────────────────────────────┴────────────────────────────┘
                      Supabase PostgreSQL
```

## Предусловия

### От Builder 1 (Scaffold)

Должны существовать таблицы:

```sql
-- SKU и настройки продавца
CREATE TABLE skus (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL,
  marketplace TEXT,                     -- 'wildberries', 'ozon', etc
  sku_name TEXT,
  current_stock INTEGER,
  telegram_user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- История продаж (от Builder 2 или синхронизация)
CREATE TABLE sales_history (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL REFERENCES skus(id),
  date DATE NOT NULL,
  daily_sales INTEGER,
  stock INTEGER,
  UNIQUE(sku_id, date)
);

-- Таблицы для прогнозов (создаём мы)
CREATE TABLE forecasts (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL REFERENCES skus(id),
  predictions_json JSONB,
  stock_out_date TIMESTAMP,
  confidence INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL REFERENCES skus(id),
  seller_id INTEGER NOT NULL,
  days_until_stockout INTEGER,
  recommended_order INTEGER,
  status TEXT,
  message_id TEXT,
  error TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);
```

### От Builder 2 (Data Sync)

sales_history должна заполняться ежедневно с данными из Wildberries/Ozon API:

```
Wildberries API → sales_history ← Ozon API
         ↓
    daily_sales, stock
    (за каждый день)
```

## Установка и подготовка

### 1. Клонируем и устанавливаем зависимости

```bash
cd ~/clawd/pipeline/active/stockout-alert/phase3-build
npm install
npm run build
```

### 2. Создаём .env файл

```bash
cp .env.example .env
# Отредактируем:
# - TELEGRAM_BOT_TOKEN (получить у BotFather)
# - DATABASE_URL (если используем реальную БД)
# - SUPABASE_URL и SUPABASE_KEY (если используем Supabase)
```

### 3. Интегрируем в код (заменяем mock на реальную БД)

Текущая реализация использует mock (in-memory Map). Для real production:

**Шаг 1: Установить суперклиент**

```bash
npm install @supabase/supabase-js
```

**Шаг 2: Обновить src/db/queries/forecasts.ts**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export class ForecastRepository {
  static async saveForecast(
    skuId: number,
    predictions: PredictionPoint[],
    stockOutDate: Date | null,
    confidence: number
  ): Promise<Forecast> {
    const { data, error } = await supabase
      .from('forecasts')
      .insert({
        sku_id: skuId,
        predictions_json: predictions,
        stock_out_date: stockOutDate,
        confidence: confidence,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      skuId: data.sku_id,
      predictions: data.predictions_json,
      stockOutDate: data.stock_out_date,
      confidence: data.confidence,
      createdAt: new Date(data.created_at),
    };
  }

  // Аналогично для других методов...
}
```

## Использование в pipeline

### Вариант 1: Cron job (рекомендуется)

Добавить в конфиг Antfarm (ежедневно в 03:00 UTC):

```json
{
  "jobs": [
    {
      "name": "process-stockout-alerts",
      "schedule": "0 3 * * *",
      "task": "npm run start --prefix ~/clawd/pipeline/active/stockout-alert/phase3-build",
      "timeout": "10m",
      "retry": 3
    }
  ]
}
```

### Вариант 2: Прямой вызов из другого сервиса

```typescript
import { StockOutAlertApp } from './stockout-alert-system';

async function processSeller(sellerId: number) {
  const app = new StockOutAlertApp({
    sellerId,
    alertThresholdDays: 7,
    confidenceThreshold: 50,
  });

  const results = await app.run();
  console.log(`Обработано ${results.length} SKU`);
}
```

### Вариант 3: API endpoint (если нужен фронтенд)

```typescript
import express from 'express';
import { StockOutAlertApp } from './stockout-alert-system';

const app = express();

// GET /forecast/:skuId
app.get('/forecast/:skuId', async (req, res) => {
  const app = new StockOutAlertApp();
  const forecast = await app.forecastSingleSku(Number(req.params.skuId));

  if (!forecast) {
    return res.status(404).json({ error: 'No forecast' });
  }

  res.json(forecast);
});

// POST /alerts/seller/:sellerId
app.post('/alerts/seller/:sellerId', async (req, res) => {
  const app = new StockOutAlertApp({
    sellerId: Number(req.params.sellerId),
  });

  const results = await app.run();
  res.json({ sent: results.filter(r => r.alerted).length });
});
```

## Workflow: полный цикл

```
1. Builder 2 синхронизирует sales_history
   └─ Ежедневно: Wildberries/Ozon API → sales_history таблица

2. Builder 3 Cron (03:00 UTC)
   └─ Получает все SKU → Прогнозирует → Отправляет алерты
   
3. Telegram Bot получает сообщение
   └─ Покупатель видит: "⚠️ SKU закончится 20.02, закажи 450 шт"

4. Логирование
   └─ forecasts таблица: предсказания
   └─ alerts таблица: отправленные алерты
```

## Мониторинг и отладка

### Логи

```bash
# Просмотреть логи последнего запуска
tail -100 ~/.openclaw/logs/stockout-alerts.log

# Включить debug
DEBUG=stockout-alert:* npm run start
```

### Проверить forecast для конкретного SKU

```bash
# В REPL или скрипте
const app = new StockOutAlertApp();
const forecast = await app.forecastSingleSku(1001);
console.log(JSON.stringify(forecast, null, 2));
```

### Проверить alerts, отправленные за день

```sql
SELECT 
  sku_id, 
  status, 
  days_until_stockout, 
  recommended_order 
FROM alerts 
WHERE DATE(sent_at) = CURRENT_DATE 
ORDER BY sent_at DESC;
```

## Common Issues

### ❌ "Нет данных для SKU 1001"

**Причина:** sales_history пуста или少于 7 дней

**Решение:** 
1. Проверить, что Builder 2 синхронизирует
2. Дождаться 7+ дней данных

### ❌ "Low confidence: 35%"

**Причина:** Непредсказуемые продажи

**Решение:**
- Либо увеличить `alertThresholdDays` с 7 на 14
- Либо снизить `confidenceThreshold` с 50 на 30
- Либо использовать ML модель вместо простого AVG

### ❌ "TELEGRAM_BOT_TOKEN не установлен"

**Решение:**
```bash
export TELEGRAM_BOT_TOKEN="123456:ABC..."
# Или добавить в .env
```

### ❌ Telegram 429 (too many requests)

**Причина:** Слишком много сообщений одновременно

**Решение:** Добавить rate limiter в TelegramService

```typescript
private static requestQueue: Promise<any> = Promise.resolve();

static async sendAlert(...) {
  this.requestQueue = this.requestQueue.then(
    () => new Promise(r => setTimeout(r, 100))  // 100ms delay
  );
  return this.requestQueue.then(() => this.sendMessage(...));
}
```

## Performance

### Масштабирование

Для 10000+ SKU рекомендуется:

1. **Batch forecasting** (текущая реализация уже batch)
2. **Кэширование** (если forecast не изменился - не отправлять алерт)
3. **Параллельные запросы к Telegram** (с rate limiting)
4. **Индексы в БД**:
   ```sql
   CREATE INDEX idx_sales_history_sku_date 
   ON sales_history(sku_id, date DESC);
   
   CREATE INDEX idx_forecasts_sku 
   ON forecasts(sku_id);
   ```

## Roadmap

- [ ] Интеграция с реальной Supabase (текущий mock)
- [ ] Support для нескольких языков Telegram
- [ ] Webhook вместо cron (event-driven)
- [ ] ML модель вместо простого AVG по дням
- [ ] Dashboard для просмотра прогнозов (React/Next.js)
- [ ] A/B тестирование alert_threshold

## Support

При проблемах:
1. Проверить README.md
2. Запустить тесты: `npm test`
3. Посмотреть логи
4. Проверить подключение к БД
5. Проверить TELEGRAM_BOT_TOKEN

---

**Builder 3** ML-Forecasting & Alerts System
