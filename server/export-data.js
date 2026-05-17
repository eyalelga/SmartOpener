import prisma from './src/db/index.js'

const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
const stations = await prisma.station.findMany({ orderBy: { id: 'asc' } })
const permissions = await prisma.permission.findMany()

console.log('-- USERS')
for (const u of users) {
  const pin = u.pinHash ? `'${u.pinHash}'` : 'NULL'
  const mgr = u.managerId ?? 'NULL'
  console.log(`INSERT INTO "users" ("id","name","role","password_hash","pin_hash","manager_id","created_at") VALUES (${u.id},'${u.name}','${u.role}','${u.passwordHash}',${pin},${mgr},'${u.createdAt.toISOString()}') ON CONFLICT ("id") DO NOTHING;`)
}

console.log('\n-- STATIONS')
for (const s of stations) {
  console.log(`INSERT INTO "stations" ("id","name") VALUES (${s.id},'${s.name}') ON CONFLICT ("id") DO NOTHING;`)
}

console.log('\n-- PERMISSIONS')
for (const p of permissions) {
  console.log(`INSERT INTO "permissions" ("user_id","station_id") VALUES (${p.userId},${p.stationId}) ON CONFLICT DO NOTHING;`)
}

console.log('\n-- Reset sequences')
console.log(`SELECT setval('"users_id_seq"', (SELECT MAX(id) FROM "users"));`)
console.log(`SELECT setval('"stations_id_seq"', (SELECT MAX(id) FROM "stations"));`)

await prisma.$disconnect()
