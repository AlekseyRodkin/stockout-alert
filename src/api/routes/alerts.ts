import express from 'express'

const router = express.Router()

router.post('/subscribe', (req, res) => {
  res.json({ status: 'ok' })
})

router.get('/history', (req, res) => {
  res.json([])
})

export default router
