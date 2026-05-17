import { Router } from 'express'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

const router = Router()
router.use(requireAuth)
router.use(requireRole('super_admin'))

// GET /api/v1/events
router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      user: { select: { id: true, name: true, role: true } },
      station: { select: { id: true, name: true } },
    },
  })
  res.json(events)
})

export default router
