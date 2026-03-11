# Docker Compose

## What is Docker Compose?

Docker Compose lets you define and run multiple containers together using a single file.

Without it, you'd manually run each container, create networks, manage volumes,
pass environment variables — all from the command line every time.

With Compose:
```bash
docker compose up   # starts everything defined in docker-compose.yml
docker compose down # stops everything
```

---

## How containers communicate

Compose automatically creates a **private network** for all services.
Every service can reach every other service using its **service name as hostname**.

```
Private Docker Network (handson_default)
├── mongo    → reachable at hostname "mongo"   (internal only)
├── backend  → reachable at hostname "backend" (internal only)
└── nginx    → reachable at hostname "nginx"   (internal only)
```

From inside the backend container:
```
mongodb://mongo:27017   ← "mongo" resolves to the mongo container's IP
```

From outside (your browser):
Only what you expose via `ports:` is accessible.

---

## Dev docker-compose.yml (explained line by line)

```yaml
services:

  mongo:
    image: mongo:7
    # Use the official MongoDB 7 image from Docker Hub
    # "image:" means use a pre-built image — no Dockerfile needed

    container_name: mongo_db
    # Give it a fixed name instead of the auto-generated one
    # Useful for docker logs mongo_db, docker restart mongo_db etc.

    restart: unless-stopped
    # If the container crashes or server reboots, restart it automatically
    # "unless-stopped" = restart always EXCEPT if you manually stopped it

    ports:
      - "27017:27017"
    # host_port:container_port
    # Exposes MongoDB to your laptop so you can use MongoDB Compass etc.
    # FORMAT: "HOST:CONTAINER" — left is your machine, right is inside container
    # In PROD: remove this — never expose Mongo to the internet

    volumes:
      - mongo_data:/data/db
    # Named volume — MongoDB stores data at /data/db inside container
    # mongo_data is managed by Docker on your host machine
    # Data survives container restarts and deletions

  backend:
    build: ./backend
    # "build:" means build an image from a Dockerfile
    # Points to the folder containing the Dockerfile
    # Different from "image:" — this builds instead of pulling

    container_name: backend

    restart: unless-stopped

    ports:
      - "3001:3000"
    # Your laptop's port 3001 maps to container's port 3000
    # Access backend at localhost:3001 from your browser
    # In PROD: remove this — Nginx sits in front

    env_file:
      - ./backend/.env
    # Load environment variables from a file
    # The .env file is NOT committed to git (it has secrets)
    # In PROD: use "environment:" with real values instead

    depends_on:
      - mongo
    # Don't start backend until mongo container is running
    # Note: "running" doesn't mean "ready" — just that the process started

    volumes:
      - ./backend:/app
      # BIND MOUNT — maps your local ./backend folder into /app in container
      # Any file change on your laptop instantly appears in the container
      # This enables hot reload (nodemon picks up changes)
      # DEV ONLY — in prod, code is baked into the image

      - /app/node_modules
      # Anonymous volume — preserves the container's node_modules
      # WHY: The bind mount above would overwrite /app entirely,
      # including node_modules. This tells Docker: "keep the container's
      # node_modules, don't let the bind mount replace them"

volumes:
  mongo_data:
  # Declare named volumes here so Docker creates and manages them
  # This volume persists on your host even if containers are deleted
```

---

## Prod docker-compose.prod.yml (what changes and why)

```yaml
services:

  mongo:
    image: mongo:7
    container_name: mongo_db
    restart: unless-stopped
    # NO ports: — Mongo is completely hidden from the internet
    # Only the backend container can reach it (via internal Docker network)
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./backend
    container_name: backend
    restart: unless-stopped
    # NO ports: — backend is not directly accessible from outside
    # Nginx proxies requests to it internally

    # NO volumes: — no bind mount in prod
    # Code is baked into the image via COPY . . in Dockerfile
    # We don't need live reload on a production server

    environment:
      MONGO_URI: mongodb://mongo:27017/myApp
      JWT_SECRET: ${JWT_SECRET}
      # ${JWT_SECRET} reads from the shell environment on the server
      # Set it with: export JWT_SECRET=your_secret before running compose
      # Never hardcode secrets here — this file is in git
    depends_on:
      - mongo

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
    # Only Nginx is exposed to the internet
    # It acts as the single entry point for all traffic
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      # Mount our nginx config into the container (read-only)
      - ./frontend/dist:/usr/share/nginx/html:ro
      # Mount built React files for Nginx to serve (read-only)
    depends_on:
      - backend

volumes:
  mongo_data:
```

---

## Dev vs Prod comparison

| Feature | Dev (docker-compose.yml) | Prod (docker-compose.prod.yml) |
|---|---|---|
| Mongo port exposed | Yes (27017) | No |
| Backend port exposed | Yes (3001) | No |
| Backend bind mount | Yes (live reload) | No (code in image) |
| Nginx | No | Yes (serves frontend + proxies API) |
| Secrets | From .env file | From shell env vars |
| Frontend in Docker | No (npm run dev) | Yes (static files in Nginx) |

---

## Common commands

```bash
# Start all services (dev)
docker compose up

# Start in background (detached)
docker compose up -d

# Use a specific compose file (prod)
docker compose -f docker-compose.prod.yml up -d

# Rebuild images (after code changes)
docker compose up --build
docker compose -f docker-compose.prod.yml up -d --build

# Stop all containers (volumes preserved)
docker compose down

# Stop AND delete volumes (careful — deletes DB data)
docker compose down --volumes

# View running containers
docker ps

# View logs of a service
docker compose logs backend
docker compose logs -f backend   # -f = follow (live stream)

# Restart a single container
docker restart nginx

# Open a shell inside a container
docker exec -it backend sh
```

---

## build vs image in Compose

```yaml
# "image:" — use a pre-built image from Docker Hub or registry
mongo:
  image: mongo:7   # pulls from Docker Hub, no Dockerfile needed

# "build:" — build from a local Dockerfile
backend:
  build: ./backend   # looks for Dockerfile in ./backend folder
```

Use `image:` for third-party software (databases, Nginx).
Use `build:` for your own code that has a Dockerfile.
