import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const STATIONS = [
  'CST1042211100016', 'CST1042211100019', 'CST1042211100020',
  'CST1042211100023', 'CST1042211100024', 'CST1042211100025',
  'CST1042211100026', 'CST1042211100027', 'CST1042211100028',
  'CST1042211100029', 'CST1042211100030', 'CST1042211100033',
  'CST1042211100034', 'CST1042211100035', 'CST1042211100037',
  'CST1042410140001', 'CST1042410140002', 'CST1042410140003',
  'CST1042410140004', 'CST1042410140005', 'CST1042410140006',
  'CST1042410140007', 'CST1042410140008', 'CST1042410140009',
  'CST1042410140010', 'CST1042410140011', 'CST1042410140012',
  'CST1042410140013', 'CST1042410140014', 'CST1042410140015',
  'CST1042410140017', 'CST1042410140018', 'CST1042410140019',
]

async function main() {
  // Admin user
  const passwordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'admin', role: 'super_admin', passwordHash },
  })
  console.log(`✓ super_admin: "${admin.name}" (admin123)`)

  // Stations — create only if name doesn't exist yet
  const existing = await prisma.station.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(s => s.name))
  const toCreate = STATIONS.filter(name => !existingNames.has(name))

  if (toCreate.length > 0) {
    await prisma.station.createMany({
      data: toCreate.map(name => ({ name })),
    })
    console.log(`✓ ${toCreate.length} תחנות נוספו`)
  } else {
    console.log(`✓ כל התחנות כבר קיימות (${STATIONS.length})`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
