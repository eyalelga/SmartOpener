import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const isProd = process.env.NODE_ENV === 'production'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { name, password } = req.body
  if (!name || !password) {
    return res.status(400).json({ error: 'name and password required' })
  }

  const user = await prisma.user.findFirst({ where: { name } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const payload = { id: user.id, name: user.name, role: user.role }
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

  res.cookie('token', token, COOKIE_OPTIONS)
  res.json({ id: user.id, name: user.name, role: user.role })
})

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

export default router
