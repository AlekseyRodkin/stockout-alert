export interface HistoryPoint {
  date: Date
  stock: number
  dailySales: number
}

export interface ForecastInput {
  skuId: number
  history: HistoryPoint[]
  confidenceThreshold: number
}

export interface ForecastOutput {
  predictions: { date: Date; predictedStock: number }[]
  stockOutDate: Date | null
  confidence: number
}

export class ForecastService {
  static forecast(input: ForecastInput): ForecastOutput {
    if (input.history.length === 0) {
      return { predictions: [], stockOutDate: null, confidence: 0 }
    }

    const avgSales = input.history.reduce((sum, h) => sum + h.dailySales, 0) / input.history.length
    const predictions: { date: Date; predictedStock: number }[] = []
    let currentStock = input.history[input.history.length - 1].stock

    for (let i = 1; i <= 28; i++) {
      currentStock -= avgSales
      predictions.push({ date: new Date(), predictedStock: Math.max(0, currentStock) })
      if (currentStock <= 0) {
        return {
          predictions,
          stockOutDate: new Date(),
          confidence: 80,
        }
      }
    }

    return { predictions, stockOutDate: null, confidence: 60 }
  }

  static daysUntilStockOut(stockOutDate: Date): number | null {
    const now = new Date()
    const diff = stockOutDate.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? days : null
  }
}
