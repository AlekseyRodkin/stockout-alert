import express from 'express'

const router = express.Router()

router.post('/login', (req, res) => {
  res.json({ token: 'test_token', sellerId: 'test_seller', skus: [] })
})

export default router
