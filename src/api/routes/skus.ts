import express from 'express'

const router = express.Router()

router.get('/:skuId/forecast', (req, res) => {
  res.json({ skuId: req.params.skuId, forecast: [], stockOutDate: null, confidence: 0 })
})

export default router
