# Stock-Out Alert System

ML-система прогнозирования остатков товара и автоматической отправки алертов в Telegram.

## Архитектура

```
┌─────────────────────────────────────────────┐
│   Sales History (30 дней)                    │
│   sku_id, date, daily_sales, stock           │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│   ForecastService                            │
│   ├─ calculateAverageSalesByWeekday()        │
│   ├─ calculateVariance() [confidence]        │
│   └─ forecast() → predictions[28]            │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│   AlertsService                              │
│   ├─ processAlertsForSeller()                │
│   ├─ shouldSendAlert() [дни < threshold]     │
│   └─ Создание alert record в БД              │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│   TelegramService                            │
│   ├─ formatAlertMessage() [красивый текст]   │
│   └─ sendAlert() → Telegram API              │
└────────────┬────────────────────────────────┘
             │
             ▼
        👤 Telegram Bot
```

## Файлы

| Файл | Описание |
|------|---------|
| `src/services/forecast.ts` | Главный ML-алгоритм прогнозирования |
| `src/services/alerts.ts` | Логика отправки алертов для каждого SKU |
| `src/services/telegram.ts` | Интеграция с Telegram Bot API |
| `src/db/queries/forecasts.ts` | Работа с БД (mock + реальная) |
| `src/index.ts` | Main entry point, оркестратор |
| `src/test-forecast.ts` | Тест-сценарии с генерацией данных |

## Алгоритм Forecast

### Входные данные
```typescript
{
  skuId: 1001,
  history: [
    { date: Date, stock: 500, dailySales: 25 },
    { date: Date, stock: 475, dailySales: 30 },
    ...
  ],
  confidenceThreshold: 50
}
```

### Процесс

1. **Берём последние 30 дней** истории продаж

2. **Рассчитываем среднюю продажу по дням недели**
   - Группируем продажи по дням: Пн, Вт, ..., Вс
   - Рассчитываем AVG для каждого дня
   - Учитываем сезонность (выходные часто дают другой объём)

3. **Рассчитываем confidence (точность)**
   - Variance = std_dev(daily_sales)
   - Confidence = 100 - min(100, variance / avg_sales * 100)
   - Высокая confidence = стабильные продажи
   - Низкая confidence = непредсказуемые скачки

4. **Прогнозируем на 28 дней вперёд**
   ```
   for day in 1..28:
     predicted_sales = avg_sales_by_weekday[day_of_week]
     predicted_stock[day] = predicted_stock[day-1] - predicted_sales
     if predicted_stock[day] <= 0:
       stock_out_date = day
       break
   ```

5. **Возвращаем результаты**
   ```typescript
   {
     predictions: [
       { date: Date, predictedStock: 475 },
       { date: Date, predictedStock: 445 },
       ...
     ],
     stockOutDate: Date | null,
     confidence: 78  // 0-100%
   }
   ```

## Логика Alerts

**Условие отправки алерта:**
```
если: stock_out_date <= today + alert_threshold (обычно 7 дней)
то:
  1. Создаём record в alerts таблице
  2. Отправляем сообщение в Telegram
  3. Логируем результат (sent/failed)
```

## Telegram Alert Message

**Формат:** Структурированный, с emoji и информацией

```
⚠️ АЛЕРТ О РИСКЕ STOCK-OUT

📦 SKU: 1001 - Красные носки
📊 Текущий остаток: 50 шт.

🔴 Товар закончится: 20.02.2026 (Вт)
⏳ Дней до stock-out: 5 дн.

🛒 Рекомендуемый заказ: 450 шт.
(хватит на ~30 дней)

🟡 Точность прогноза: 75%
```

## Использование

### Запуск основной системы

```typescript
import { StockOutAlertApp } from './index';

const app = new StockOutAlertApp({
  sellerId: 123,
  alertThresholdDays: 7,
  confidenceThreshold: 50,
});

await app.run();
```

### Тестирование

```bash
# Запуск тест-сценариев с генерацией данных
ts-node src/test-forecast.ts
```

### Один SKU (анализ)

```typescript
const app = new StockOutAlertApp();
const forecast = await app.forecastSingleSku(1001);

console.log(forecast.predictions);  // массив прогнозов
console.log(forecast.stockOutDate); // дата stock-out (или null)
console.log(forecast.confidence);   // 0-100%
```

## Configuration

### Environment

```bash
export TELEGRAM_BOT_TOKEN=123:ABC...
```

### AlertsService Config

```typescript
{
  sellerId: number,           // ID продавца
  alertThresholdDays: 7,      // Алерт если stock-out < 7 дней
  confidenceThreshold: 50,    // Отправить только если confidence >= 50%
  minRecommendedOrder: 10     // Мин. рекомендуемый заказ
}
```

## Database

### Mock (текущая реализация)

Используется in-memory Map. Подходит для тестирования и разработки.

### Реальная БД

При использовании Supabase / PostgreSQL:

```typescript
// Заменить ForecastRepository.saveForecast() на реальный запрос
const { data, error } = await supabase
  .from('forecasts')
  .insert({
    sku_id: skuId,
    predictions_json: JSON.stringify(predictions),
    stock_out_date: stockOutDate,
    confidence: confidence,
  });
```

## Таблицы БД (предполагаемая структура)

### forecasts
```sql
CREATE TABLE forecasts (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL,
  predictions_json JSONB NOT NULL,      -- массив {date, predictedStock}
  stock_out_date TIMESTAMP,             -- null если >28 дней
  confidence INTEGER,                   -- 0-100%
  created_at TIMESTAMP DEFAULT NOW()
);
```

### alerts
```sql
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  days_until_stockout INTEGER,
  recommended_order INTEGER,
  status TEXT,                          -- 'sent' или 'failed'
  message_id TEXT,                      -- Telegram message ID
  error TEXT,                           -- если failed
  sent_at TIMESTAMP DEFAULT NOW()
);
```

### sales_history
```sql
CREATE TABLE sales_history (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL,
  date DATE NOT NULL,
  daily_sales INTEGER,
  stock INTEGER,
  UNIQUE(sku_id, date)
);
```

## Testing

### Сценарий 1: Сезонность

История: высокие продажи в выходные, низкие в рабочие дни

```
Вс: 45 шт/день
Пн-Пт: 25 шт/день
Сб: 50 шт/день
```

Ожидается: хорошая confidence, точный stock-out по дням

### Сценарий 2: Долгоживущий товар

История: очень стабильные продажи (~10 шт/день)

Ожидается: высокая confidence (80-90%), точный stock-out

### Сценарий 3: Быстрые продажи

История: непредсказуемые продажи (20-40 шт/день)

Ожидается: низкая confidence (40-50%), примерный stock-out

## Интеграция с другими компонентами

- **Builder 1 (Scaffold)**: Зависимость от структуры БД
- **Builder 2 (Data Sync)**: Использует sales_history из Wildberries/Ozon API

## Roadmap

- [ ] Интеграция с реальной Supabase
- [ ] Поддержка нескольких маркетплейсов (Wildberries, Ozon, Lamoda, ...)
- [ ] Webhook для автоматических уведомлений (не только крон)
- [ ] Dashboard для просмотра прогнозов
- [ ] A/B тестирование confidence threshold
- [ ] Machine learning модель (вместо просто среднего по дням)

## Troubleshooting

### Нет данных для SKU

```
⚠️ Нет данных истории для SKU 1001
```

**Решение:** Нужно минимум 7 дней истории продаж. Используйте sales_history sync от Builder 2.

### Низкая confidence

```
🟠 Confidence: 35% (низко)
```

**Причина:** Непредсказуемые продажи (скачки в спросе)

**Решение:** Можно увеличить `alertThresholdDays` или использовать более сложный ML

### Telegram ошибка

```
❌ TELEGRAM_BOT_TOKEN не установлен
```

**Решение:**
```bash
export TELEGRAM_BOT_TOKEN="123:ABCxyz..."
```

## Автор

Builder 3 - ML Forecasting & Alerts
