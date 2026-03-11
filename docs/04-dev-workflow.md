# Local Development Workflow

## Architecture

```
Your Laptop
├── Docker
│   ├── backend container  (Node/Express) → localhost:3001
│   └── mongo container    (MongoDB)      → localhost:27017
│
└── Terminal
    └── Vite dev server    (React)        → localhost:5173
```

The frontend runs directly on your laptop (not in Docker).
Docker only manages backend and database.

---

## Why run frontend outside Docker?

- **Hot reload is instant** — Vite detects file changes directly, no Docker layer
- **Simpler setup** — no frontend Dockerfile needed for dev
- **Industry standard** — most teams run frontend locally, Docker for services

In production, there's no Vite dev server — frontend is compiled to static files
and served by Nginx. But in dev, Vite's dev server gives you a much better DX.

---

## How to start

**Terminal 1 — start backend and database:**
```bash
cd /Users/anamikasingh/Work/MyWork/handson
docker compose up
```

This starts:
- Express backend on port 3000 inside container → mapped to localhost:3001
- MongoDB on port 27017 inside container → mapped to localhost:27017

**Terminal 2 — start frontend:**
```bash
cd /Users/anamikasingh/Work/MyWork/handson/frontend
npm run dev
```

Open: http://localhost:5173

---

## Environment variables in dev

Backend reads from `backend/.env`:
```
MONGO_URI=mongodb://localhost:27017/myApp
JWT_SECRET=your_super_secret_key
```

When running in Docker, the backend container uses `mongodb://mongo:27017`
(service name) — not `localhost`. This is handled by docker-compose env_file.

Frontend API URL is auto-detected:
```js
// frontend/src/api/axios.js
baseURL: import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
// DEV=true  → uses localhost:3001 (direct to backend container port)
// DEV=false → uses /api (Nginx proxy in prod)
```

This means you never need to manually change the URL between dev and prod.

---

## Live reload in Docker (backend)

The bind mount in docker-compose.yml makes this work:
```yaml
volumes:
  - ./backend:/app        # your files → container files (live sync)
  - /app/node_modules     # preserve container's node_modules
```

When you edit `server.js` on your laptop:
1. The bind mount syncs the change into the container instantly
2. nodemon (if configured) or node detects the change and restarts

---

## Stopping everything

```bash
# Stop Docker containers (Ctrl+C in Terminal 1, or:)
docker compose down

# Stop Vite (Ctrl+C in Terminal 2)
```

---

## Useful dev commands

```bash
# See what's running in Docker
docker ps

# See backend logs live
docker compose logs -f backend

# Restart just the backend (after config changes)
docker restart backend

# Open a shell inside the backend container
docker exec -it backend sh

# Check if MongoDB has your data
docker exec -it mongo_db mongosh
> use myApp
> db.users.find()
```

---

## Common issues

**Backend not connecting to Mongo:**
Make sure MONGO_URI in .env uses `mongo` (service name) not `localhost`:
```
MONGO_URI=mongodb://mongo:27017/myApp   ✅
MONGO_URI=mongodb://localhost:27017/myApp   ❌ (localhost inside container = container itself)
```

**Frontend API calls failing:**
Check that `import.meta.env.DEV` is true — it should be when running `npm run dev`.
Also verify Docker is running: `docker ps` should show backend and mongo.

**Port already in use:**
```bash
# Find what's using port 3001
lsof -i :3001
# Kill it or stop docker compose
```
