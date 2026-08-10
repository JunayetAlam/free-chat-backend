# Flexi Chat — Backend

> **REST + WebSocket API** for login-less real-time room chat.

[![Live API](https://img.shields.io/badge/Live-flexi--chat.junayetalam.me-38bdf8?style=flat-square)](https://flexi-chat.junayetalam.me)
[![Express](https://img.shields.io/badge/Express-5-black?style=flat-square&logo=express)](https://expressjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io)

**Flexi Chat Backend** powers a production real-time chat platform where users chat without signup. It issues guest JWT sessions, manages rooms and messages over REST, and delivers live messaging, presence, and conversations over a native WebSocket server.

**Live:** [flexi-chat.junayetalam.me](https://flexi-chat.junayetalam.me)  
**Frontend:** [free-chat-frontend](https://github.com/JunayetAlam/free-chat-frontend)

---

## Highlights

| Area | What it demonstrates |
|------|----------------------|
| **Real-time** | Native `ws` server on `/ws` — messaging, presence, conversations, history pagination |
| **Identity** | Guest JWT access/refresh cookies, bootstrap upsert, WS token auth |
| **Data model** | Prisma + PostgreSQL — rooms, members, messages, soft delete/archive, activity logs |
| **Production** | Tiered rate limiting, daily quotas, Cloudinary uploads, GitHub Actions → VPS deploy |

---

## Features

**Real-time Chat:** WebSocket messaging with live presence, edit/delete, unread tracking, and optimistic send with retry.

**Room Collaboration:** Create/join rooms via invite codes, shareable links, member lists, and archive/search for owned & joined rooms.

**Guest Experience:** Login-less PWA with dark/glass UI, responsive layout, Cloudinary avatars/room images, and daily edit quotas.

**Rate Limiting:** IP + guest-based limits, stricter on writes/uploads, with WS burst control.

---

## Tech Stack

**Backend:** Node.js | Express.js | TypeScript | PostgreSQL | Prisma | JWT | WebSocket | Zod | Cloudinary | Rate Limiting

**Frontend (companion repo):** Next.js | React | TypeScript | Tailwind CSS | Shadcn UI | Redux Toolkit | Redux Persist | React Hook Form | Zod | WebSocket | PWA

**Runtime & tooling:** Bun, PM2, Docker Compose (local Postgres / pgAdmin / Redis)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Express 5 (HTTP)              │  WebSocket Server (/ws)       │
│  /api/v1/* REST endpoints      │  Real-time event handlers     │
├────────────────────────────────┴──────────────────────────────┤
│  Middleware: CORS, cookies, Zod validation, rate limiters    │
├──────────────────────────────────────────────────────────────┤
│  Services: Guest │ Room │ Message │ JoinedRoom │ Activity      │
├──────────────────────────────────────────────────────────────┤
│  Prisma ORM ────────────── PostgreSQL                        │
│  Cloudinary ────────────── Profile & room images               │
└──────────────────────────────────────────────────────────────┘
```

**WebSocket events**

| Incoming | Outgoing |
|----------|----------|
| `ROOM_JOIN`, `ROOM_UNFOCUS`, `ROOM_LEAVE` | `PRESENCE_SNAPSHOT`, `PRESENCE_UPDATE` |
| `MESSAGE_SEND`, `MESSAGE_EDIT`, `MESSAGE_DELETE` | `MESSAGE_HISTORY`, `MESSAGE_HISTORY_MORE` |
| `CONVERSATION_LIST` | `CONVERSATION_LIST`, `CONVERSATION_UPDATE` |
| | `GUEST_PROFILE_UPDATE`, `ERROR` |

**Rate limiting**

- **HTTP** — per-route limiters keyed by IP or `guest:{id}`; global ceiling 800 req/min per IP
- **WebSocket** — connection limit per IP; per-guest event windows + burst intervals (e.g. 400 ms between sends)

**Daily quotas** — profile name/image and room name/image edits capped per Asia/Dhaka calendar day

---

## API Surface

| Route | Description |
|-------|-------------|
| `GET /api/v1/guests/bootstrap` | Create or resume guest session + JWT cookies |
| `GET/PATCH /api/v1/guests/me` | Guest profile read/update |
| `PUT /api/v1/guests/me/profile-image` | Cloudinary profile image upload |
| `POST/GET /api/v1/rooms` | Create room, list owned rooms |
| `GET/PATCH/DELETE /api/v1/rooms/:id` | Room detail, update, soft delete |
| `PATCH /api/v1/rooms/:id/archive` | Archive owned room |
| `GET /api/v1/rooms/:id/members` | Room member list with presence |
| `PUT /api/v1/rooms/:id/image` | Cloudinary room image upload |
| `GET /api/v1/joined-rooms` | Guest's joined room history |
| `GET /api/v1/messages` | Message list (REST fallback) |
| `GET /api/v1/activity-logs` | Activity audit trail |

WebSocket endpoint: `ws://host/ws?token=<accessToken>`

---

## Database Schema

```
Guest ──┬── Room (creator)
        ├── RoomMember
        ├── JoinedRoom
        ├── Message
        └── ActivityLog

Room ───┬── RoomMember
        ├── JoinedRoom
        ├── Message
        └── ActivityLog
```

**Key patterns**

- Soft delete and archive on rooms, messages, memberships, and joined-room history
- `lastOpenedAt` / `leftAt` watermarks for unread conversation tracking
- Indexed queries on `roomId`, `guestId`, `createdAt`, and archive flags

---

## Project Structure

```
src/
├── server.ts                 # HTTP + WebSocket bootstrap
├── app.ts                    # Express app, CORS, global limiter
├── config/                   # Env config, CORS origins
└── app/
    ├── modules/
    │   ├── chatting/         # WS server, handlers, presence, rate limits
    │   ├── guest/          # Bootstrap, profile, quotas
    │   ├── room/           # Room CRUD, members, invite codes
    │   ├── joinedRoom/     # Joined room history
    │   ├── message/        # REST message endpoints
    │   ├── activity/       # Activity log API
    │   └── Upload/         # Cloudinary, Multer middleware
    ├── middlewares/        # guestIdentity, rateLimiters, validation
    ├── utils/              # JWT cookies, daily quotas, soft delete
    └── routes/             # Route aggregator
prisma/
├── schema.prisma           # Generator + datasource
├── guest.prisma            # Guest model
├── chat.prisma             # Room, Message, JoinedRoom
├── activity.prisma         # ActivityLog
└── migrations/             # PostgreSQL migrations
```

---

## Getting Started

### Prerequisites

- **Bun** or **Node.js** 20+
- **PostgreSQL** 16+ (or Docker Compose below)

### Installation

```bash
git clone https://github.com/JunayetAlam/free-chat-backend.git
cd free-chat-backend
bun install
```

### Local Database (Docker)

```bash
docker compose --profile local up -d
```

| Service | Port |
|---------|------|
| PostgreSQL | `8594` |
| pgAdmin | `8595` |
| Redis | `8596` |

### Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=5467
DATABASE_URL=postgresql://postgres:FC@2026@localhost:8594/fc_production

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

BASE_URL_CLIENT=http://localhost:4467
BASE_URL_SERVER=http://localhost:5467

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_PROJECT_NAME=flexi-chat
```

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (default `5467` in dev) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Guest token signing keys |
| `BASE_URL_CLIENT` | Frontend origin for CORS |
| `CLOUDINARY_*` | Image upload credentials |

### Database Setup

```bash
bun run pm          # prisma migrate dev
bun run pgen        # prisma generate
```

### Development

```bash
bun run start:dev
```

Server runs at [http://localhost:5467](http://localhost:5467). WebSocket at `ws://localhost:5467/ws`.

### Production Build

```bash
bun run build
bun run start:prod
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run start:dev` | Dev server with watch (Bun) |
| `bun run start:prod` | Run compiled `dist/server.js` |
| `bun run build` | TypeScript compile |
| `bun run prod:build` | Install, migrate, generate, build, PM2 restart |
| `bun run pm` | `prisma migrate dev` |
| `bun run pgen` | `prisma generate` |
| `bun run studio` | Prisma Studio on port `7548` |
| `bun run check:types` | TypeScript check |

---

## Deployment

CI/CD via **GitHub Actions** — push to `main` deploys to VPS over SSH (`bun run prod:build` → migrate → build → PM2 restart). Telegram notifications on success/failure. See `.github/workflows/deploy.yml`.

---

## Author

**Junayet Alam** — Full-Stack Developer

Backend-focused engineer with experience in real-time systems, API design, and production deployments.

| | |
|---|---|
| Portfolio | [junayetalam.me](https://www.junayetalam.me/) |
| GitHub | [github.com/JunayetAlam](https://github.com/JunayetAlam) |
| LinkedIn | [linkedin.com/in/junayet-alam](https://www.linkedin.com/in/junayet-alam/) |
| Repository | [free-chat-backend](https://github.com/JunayetAlam/free-chat-backend) |

---

## License

Private project. All rights reserved.
