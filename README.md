# 📦 StockOut Alert MVP

AI-powered early warning system for marketplace stockouts. Analyzes sales velocity, predicts stock depletion dates, and sends Telegram alerts to sellers.

## ✨ Features

- **Smart Forecasting:** Predicts when inventory will run out 7-14 days in advance
- **Multi-Marketplace:** Supports Wildberries (WB) and Ozon with their native APIs
- **Automated Sync:** Syncs inventory every hour via background workers
- **Telegram Alerts:** Instant notifications + action recommendations
- **Real-time Dashboard:** Web & Telegram interfaces for monitoring

## 🚀 Tech Stack

- **Backend:** Node.js + Express.js + TypeScript
- **Database:** Supabase (PostgreSQL + Real-time)
- **ML/Forecasting:** Simple Time-Series (ARIMA-like) with seasonality
- **Deployment:** Vercel (API) + GitHub Actions (CI/CD)
- **Notifications:** Telegram Bot API

## 📋 Prerequisites

```bash
node >= 18
npm >= 9
```

Create `.env` with:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
TELEGRAM_BOT_TOKEN=your-telegram-token
PORT=3000
```

## 🛠️ Installation

```bash
npm install
npm run build
npm start
```

Server runs on `http://localhost:3000`

## 📡 API Endpoints

### Authentication
```
POST /api/auth/login
Body: { marketplace: "wb" | "ozon", code: "oauth_code" }
Response: { token, sellerId, skus: [...] }
```

### Forecasting
```
GET /api/skus/{sku_id}/forecast?days=28
Response: { sku_id, forecast: [{ date, predicted_stock }], stockOutDate, recommendation }
```

### Alerts
```
POST /api/alerts/subscribe
Body: { sku_id, alert_days: 7, telegram_chat_id: "..." }
```

### Dashboard
```
GET /api/dashboard
Response: { skus_total, skus_at_risk, at_risk_list: [...] }
```

## 📊 Data Model

### Sellers
```
seller_id (PK) | marketplace | oauth_token | oauth_refresh_token
```

### SKUs
```
sku_id (PK) | seller_id | marketplace_sku_id | name | category
```

### Inventory History (Time-Series)
```
id | sku_id | date | stock_level | daily_sales | price
```

### Forecasts (Cache)
```
sku_id | forecast_date | predicted_stock | predicted_stockout_date | confidence
```

### Alerts
```
id | sku_id | alert_type | sent_at | telegram_status
```

## 🔄 Background Workers

### Sync Worker (Hourly)
1. For each seller: fetch current inventory from WB/Ozon API
2. Update `inventory_history` table
3. Recalculate forecasts
4. Check: are there SKUs with stockOut ≤ 7 days?
5. If yes → send Telegram alert

### Forecast Algorithm
```javascript
// Simple but effective for MVP
avgDailySales = history.reduce((sum, h) => sum + h.dailySales) / history.length
currentStock = lastHistoryPoint.stock
for (day = 1 to 28) {
  currentStock -= avgDailySales
  if (currentStock <= 0) return { stockOutDate: day, confidence: 80% }
}
return { stockOutDate: null, confidence: 60% }
```

## 🧪 Testing

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

## 🌐 Deployment

### Option 1: Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Option 2: Heroku
```bash
npm install -g heroku
heroku login
heroku create stockout-alert
git push heroku main
```

### Option 3: Docker
```bash
docker build -t stockout-alert .
docker run -p 3000:3000 stockout-alert
```

## 📈 Success Metrics

- Forecast accuracy: ≥ 80% (±1 day)
- Alert delivery rate: ≥ 95%
- False positive rate: < 10%
- Response time: < 100ms for API endpoints

## 🐛 Known Issues

- Forecast confidence is static (should vary by variance)
- No user authentication frontend (OAuth only)
- Telegram bot requires manual setup (BotFather)
- WB/Ozon API rate limits not yet implemented

## 📚 Documentation

- `./API.md` — Full API reference
- `../PHASE_4_TESTING.md` — Testing guide
- `../phase2-architecture/spec.md` — Product spec

## 🤝 Contributing

This is an MVP. Open issues for bugs, improvements welcome.

## 📄 License

MIT

---

**Made with ❤️ by the Pipeline Team**
