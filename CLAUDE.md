# CLAUDE.md — MEIR SMARTOPENER

## Project Overview

**SmartOpener** — מערכת ניהול פתיחת תאי הטענה למאיר יוטיליטיז.
מפרידה בין תפעול שטח (עובד פותח תא) לניהול מערכת (מנהל מגדיר הרשאות).

## Architecture

```
[Browser PWA]  ──HTTPS──→  [Node.js API + PostgreSQL]
                                     │
                                WebSocket (persistent)
                                     │
                             [Android Agent @ Station]
                                     │
                                   RS-485
                                     │
                         [4-Channel Controller → 4 Doors]
```

## User Roles

| Role | Access |
|------|--------|
| `super_admin` | כל המערכת — כל המנהלים, כל העמדות |
| `manager` | העמדות שהוקצו לו + עובדים שלו |
| `worker` | פתיחת תאים בלבד — ללא הגדרות |

## Project Structure

```
smartopener/
├── client/          ← React PWA (Vite + RTL)
│   ├── src/
│   │   ├── pages/   ← Login, WorkerDashboard, AdminDashboard, SuperAdmin
│   │   ├── components/
│   │   └── api/     ← axios calls to server
│   └── package.json
├── server/          ← Node.js + Express
│   ├── src/
│   │   ├── routes/  ← auth, users, stations, doors, events
│   │   ├── middleware/ ← auth JWT, role guard
│   │   ├── db/      ← Prisma schema + migrations
│   │   └── ws/      ← WebSocket server for Android Agent
│   └── package.json
├── .env             ← DATABASE_URL, JWT_SECRET
└── CLAUDE.md        ← this file
```

## Stack

- **Frontend:** React 18 + Vite + PWA + RTL (Hebrew)
- **Backend:** Node.js + Express
- **ORM:** Prisma + PostgreSQL
- **Auth:** JWT (access token in httpOnly cookie)
- **Real-time:** WebSocket (ws package) — server ↔ Android Agent
- **Hosting:** Railway (server + DB)

## Database Schema (core tables)

```
users         — id, name, role, password_hash, manager_id
stations      — id, name, location, agent_connected (bool)
permissions   — user_id, station_id
events        — id, user_id, station_id, door_number, opened_at
```

## API Conventions

- All routes: `/api/v1/...`
- Auth: `POST /api/v1/auth/login` → JWT
- Doors: `POST /api/v1/stations/:id/open` body: `{ door: 1|2|3|4|"all" }`
- Events: `GET /api/v1/events?station_id=&user_id=&from=&to=`

## Development Phases

1. **Foundation** — DB schema, Auth, User/Station CRUD
2. **Admin UI** — Manager dashboard: create workers, assign stations
3. **Worker PWA** — Login → stations → 4 keys + open-all
4. **Android Agent** — WebSocket client, RS-485 bridge
5. **Hardening** — Offline handling, station status, production deploy

## Commands

```bash
# Server
cd server && npm install && npm run dev

# Client
cd client && npm install && npm run dev

# DB migrations
cd server && npx prisma migrate dev
```
