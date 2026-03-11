# Docker Basics

## What problem does Docker solve?

Without Docker, code that works on your laptop might fail on someone else's machine
because of different Node versions, OS differences, or missing dependencies.

Docker solves this by packaging your code AND its environment together.
You ship the environment along with the code — so it runs the same everywhere.

```
Without Docker:
  "Does this server have Node 20? The right npm? MongoDB installed?"

With Docker:
  "Run this container." ← Everything is inside.
```

---

## Key concepts

### Image
A frozen, read-only snapshot of an environment + code.
Think of it like a cake mold — you use it to create containers.

```
Dockerfile  →  build  →  Image  →  run  →  Container
(recipe)                 (mold)            (actual cake)
```

- Images are built once and reused
- You can run multiple containers from the same image
- Images are stored locally or pushed to a registry (Docker Hub, ECR)

### Container
A running instance of an image. It is:
- Isolated — has its own filesystem, network, process space
- Lightweight — shares the host OS kernel (unlike a VM)
- Ephemeral — when it stops, changes inside are lost (unless using volumes)

### Registry
A place to store and share images.
- Docker Hub — public registry (like GitHub for images)
- AWS ECR — private registry in AWS
- You push images here so servers can pull them

---

## Dockerfile — the recipe

A Dockerfile is a set of instructions to build an image.

```dockerfile
FROM node:20-alpine
# Start from an existing base image (Node 20 on tiny Alpine Linux)
# You don't start from scratch — you build on top of official images
# Alpine is ~5MB vs Ubuntu's ~70MB — keeps images small

WORKDIR /app
# All subsequent commands run from /app inside the container
# Like doing `cd /app` permanently during the build

COPY package*.json ./
# Copy ONLY dependency files first — before copying source code
# WHY: Docker caches each line as a layer. If package.json hasn't changed,
# Docker reuses the cached npm install result — saves 30+ seconds per build

RUN npm install
# Install dependencies INTO the image
# These node_modules live inside the image, not on your host machine

COPY . .
# Copy your source code into the image
# In DEV: this gets overridden by a volume mount (bind mount)
# In PROD: this IS your code — it's baked into the image

EXPOSE 3000
# Documentation only — tells humans this app uses port 3000
# Does NOT actually open any port (that's done in docker-compose ports:)

CMD ["node", "server.js"]
# The command that runs when a container starts
# If this process exits, the container stops
```

### Layer caching — why order matters

Docker builds images layer by layer. Each line = one layer.
If a layer hasn't changed, Docker reuses the cached version.

```
Layer 1: FROM node:20-alpine     ← almost never changes → always cached
Layer 2: WORKDIR /app            ← never changes → always cached
Layer 3: COPY package*.json      ← only changes when package.json changes
Layer 4: RUN npm install         ← only reruns when layer 3 changes
Layer 5: COPY . .                ← changes every time you edit code
Layer 6: CMD [...]               ← rebuilds when layer 5 changes
```

If you put `COPY . .` before `npm install`, every code change would
trigger a full npm install — wasting 30+ seconds every rebuild.

---

## Volumes — persistent and live data

Containers are ephemeral. When they stop, data inside is lost.
Volumes solve this.

### Named volumes (for databases)
```yaml
volumes:
  - mongo_data:/data/db
```
- Docker manages the storage location
- Data persists even if container is deleted and recreated
- Used for MongoDB, PostgreSQL — anything you can't afford to lose

### Bind mounts (for live dev)
```yaml
volumes:
  - ./backend:/app
```
- Maps a folder from your host into the container
- Changes on your host instantly appear in the container
- Used in DEV only for hot reload
- In PROD: removed — code is baked into the image

---

## Why Docker over just running Node directly?

| Without Docker | With Docker |
|---|---|
| Install Node on every server manually | Node is inside the image |
| Different servers have different versions | Same image everywhere |
| If server reboots, manually restart app | `restart: unless-stopped` handles it |
| Moving servers = setup everything again | Just `docker compose up` |
| Dev and prod environments drift apart | Same image in both |
