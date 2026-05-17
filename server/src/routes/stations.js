import { Router } from 'express'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

const router = Router()
router.use(requireAuth)

// GET /api/v1/stations — super_admin sees all; manager sees assigned; worker sees assigned
router.get('/', async (req, res) => {
  if (req.user.role === 'super_admin') {
    const stations = await prisma.station.findMany({ orderBy: { name: 'asc' } })
    return res.json(stations)
  }

  const perms = await prisma.permission.findMany({
    where: { userId: req.user.id },
    include: { station: true },
  })
  res.json(perms.map((p) => p.station))
})

// GET /api/v1/stations/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const station = await prisma.station.findUnique({ where: { id } })
  if (!station) return res.status(404).json({ error: 'Not found' })

  if (req.user.role !== 'super_admin') {
    const perm = await prisma.permission.findUnique({
      where: { userId_stationId: { userId: req.user.id, stationId: id } },
    })
    if (!perm) return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(station)
})

// POST /api/v1/stations
router.post('/', requireRole('super_admin'), async (req, res) => {
  const { name, location } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const station = await prisma.station.create({ data: { name, location } })
  res.status(201).json(station)
})

// PATCH /api/v1/stations/:id
router.patch('/:id', requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { name, location } = req.body
  const station = await prisma.station.update({
    where: { id },
    data: { ...(name && { name }), ...(location !== undefined && { location }) },
  })
  res.json(station)
})

// DELETE /api/v1/stations/:id
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  await prisma.station.delete({ where: { id: Number(req.params.id) } })
  res.json({ ok: true })
})

// GET /api/v1/stations/:id/users — list users assigned to a station
router.get('/:id/users', requireRole('super_admin', 'manager'), async (req, res) => {
  const stationId = Number(req.params.id)
  const perms = await prisma.permission.findMany({
    where: { stationId },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  res.json(perms.map(p => p.user))
})

// POST /api/v1/stations/:id/open — open door
router.post('/:id/open', async (req, res) => {
  const stationId = Number(req.params.id)
  const { door, pin } = req.body
  if (!door) return res.status(400).json({ error: 'door required' })

  const logEvent = (status, failureReason = null) =>
    prisma.event.create({ data: { eventType: 'door_open', status, failureReason, userId: req.user.id, stationId, doorNumber: String(door) } })

  // Workers must provide PIN
  if (req.user.role === 'worker') {
    if (!pin) return res.status(400).json({ error: 'pin required' })
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { pinHash: true },
    })
    if (!fullUser?.pinHash) return res.status(403).json({ error: 'PIN לא הוגדר — פנה למנהל' })
    const valid = await import('bcryptjs').then(m => m.default.compare(String(pin), fullUser.pinHash))
    if (!valid) {
      await logEvent('failed', 'wrong_pin')
      return res.status(403).json({ error: 'PIN שגוי' })
    }

    const perm = await prisma.permission.findUnique({
      where: { userId_stationId: { userId: req.user.id, stationId } },
    })
    if (!perm) {
      await logEvent('failed', 'no_permission')
      return res.status(403).json({ error: 'אין הרשאה לתחנה זו' })
    }
  } else if (req.user.role !== 'super_admin') {
    const perm = await prisma.permission.findUnique({
      where: { userId_stationId: { userId: req.user.id, stationId } },
    })
    if (!perm) {
      await logEvent('failed', 'no_permission')
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  await logEvent('success')

  // TODO: forward open command to Android Agent via WebSocket
  res.json({ ok: true, stationId, door })
})

// POST /api/v1/stations/:id/permissions — assign station to user
router.post('/:id/permissions', requireRole('super_admin', 'manager'), async (req, res) => {
  const stationId = Number(req.params.id)
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  if (req.user.role === 'manager') {
    const target = await prisma.user.findUnique({ where: { id: Number(userId) } })
    if (!target || target.managerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  const perm = await prisma.permission.upsert({
    where: { userId_stationId: { userId: Number(userId), stationId } },
    create: { userId: Number(userId), stationId },
    update: {},
  })
  res.status(201).json(perm)
})

// DELETE /api/v1/stations/:id/permissions/:userId
router.delete('/:id/permissions/:userId', requireRole('super_admin', 'manager'), async (req, res) => {
  const stationId = Number(req.params.id)
  const userId = Number(req.params.userId)

  await prisma.permission.delete({
    where: { userId_stationId: { userId, stationId } },
  })
  res.json({ ok: true })
})

export default router
