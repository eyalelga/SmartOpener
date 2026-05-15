import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

const router = Router()
router.use(requireAuth)

// GET /api/v1/users
router.get('/', requireRole('super_admin', 'manager'), async (req, res) => {
  const where = req.user.role === 'manager'
    ? { managerId: req.user.id }
    : {}
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, role: true, managerId: true, createdAt: true, pinHash: true },
    orderBy: { createdAt: 'asc' },
  })
  // never expose pinHash to client
  res.json(users.map(({ pinHash, ...u }) => ({ ...u, hasPin: !!pinHash })))
})

// GET /api/v1/users/:id
router.get('/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const id = Number(req.params.id)
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, managerId: true, createdAt: true },
  })
  if (!user) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'manager' && user.managerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(user)
})

// POST /api/v1/users — create user (manager can only create workers)
router.post('/', requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, password, pin, role, managerId } = req.body
  if (!name || !password) return res.status(400).json({ error: 'name and password required' })

  const allowedRole = req.user.role === 'manager' ? 'worker' : (role ?? 'worker')
  const assignedManagerId = req.user.role === 'manager' ? req.user.id : (managerId ?? null)

  const data = {
    name,
    passwordHash: await bcrypt.hash(password, 10),
    role: allowedRole,
    managerId: assignedManagerId,
  }
  if (pin) data.pinHash = await bcrypt.hash(String(pin), 10)

  const user = await prisma.user.create({
    data,
    select: { id: true, name: true, role: true, managerId: true, createdAt: true },
  })
  res.status(201).json(user)
})

// PATCH /api/v1/users/:id
router.patch('/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const id = Number(req.params.id)
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'manager' && existing.managerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { name, password, pin } = req.body
  const data = {}
  if (name) data.name = name
  if (password) data.passwordHash = await bcrypt.hash(password, 10)
  if (pin) data.pinHash = await bcrypt.hash(String(pin), 10)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, role: true, managerId: true, createdAt: true },
  })
  res.json(user)
})

// DELETE /api/v1/users/:id
router.delete('/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const id = Number(req.params.id)
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'manager' && existing.managerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await prisma.user.delete({ where: { id } })
  res.json({ ok: true })
})

export default router
