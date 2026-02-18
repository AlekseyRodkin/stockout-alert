import express from 'express'

const router = express.Router()

router.get('/dashboard', (req, res) => {
  res.json({ skusTotal: 0, skusAtRisk: 0, atRiskList: [] })
})

export default router
