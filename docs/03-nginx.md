# Nginx

## What is Nginx?

Nginx is a web server that acts as the **single entry point** for all traffic in production.

In dev, you have:
- Frontend on localhost:5173 (Vite dev server)
- Backend on localhost:3001 (Express)

In prod, there's no Vite dev server. You need something to:
1. Serve the built React files (static HTML/JS/CSS)
2. Forward API requests to the Express backend

Nginx does both.

---

## The flow in production

```
Browser
  ↓ port 80
Nginx container
  ├── /api/*  → proxy_pass → backend:3000 (Express container)
  └── /*      → serve files from /usr/share/nginx/html (React dist)
```

One public IP, one port (80), Nginx routes everything correctly.
Express and Mongo are completely hidden — not accessible from outside.

---

## nginx.conf explained

```nginx
events {}
# Required block — configures worker connections
# Empty = use defaults (fine for our setup)

http {
  include mime.types;
  # Tells Nginx what Content-Type header to send for each file extension
  # Without this, .js files might be served as text/plain and not execute
  # e.g. .html → text/html, .js → application/javascript, .css → text/css

  server {
    listen 80;
    # Listen for incoming connections on port 80 (HTTP)

    # ── Serve React frontend ──────────────────────────────
    location / {
      root /usr/share/nginx/html;
      # Look for files in this directory
      # This is where we mounted frontend/dist/ in docker-compose

      index index.html;
      # Default file to serve when a directory is requested

      try_files $uri $uri/ /index.html;
      # Try to find the requested file:
      #   1. Look for exact file match ($uri)
      #   2. Look for directory ($uri/)
      #   3. Fall back to index.html
      # WHY the fallback: React Router handles routing in the browser.
      # If someone visits /dashboard directly, there's no dashboard.html file.
      # Nginx serves index.html and React Router takes over from there.
    }

    # ── Proxy API calls to backend ────────────────────────
    location /api/ {
      proxy_pass http://backend:3000;
      # Forward any request starting with /api/ to the backend container
      # "backend" is the service name in docker-compose — Docker resolves it

      proxy_set_header Host $host;
      # Pass the original Host header to Express
      # So Express knows what domain was requested

      proxy_set_header X-Real-IP $remote_addr;
      # Pass the real client IP to Express
      # Without this, Express would see Nginx's IP, not the user's IP
    }
  }
}
```

---

## Why not just expose the backend port directly?

You could expose port 3000 and have the frontend call it directly.
But then:

- You'd need to expose Mongo too (risky)
- No single entry point — two different ports to manage
- No easy way to add SSL later
- No request logging in one place

With Nginx:
- One public port (80/443)
- Mongo stays completely hidden
- SSL termination happens at Nginx — backend doesn't need to handle it
- All traffic flows through one point — easier to add rate limiting, caching, logging

---

## try_files and React Router

This is the most important Nginx setting for React apps.

React is a Single Page Application (SPA). There's only ONE HTML file: `index.html`.
React Router handles all URL changes in the browser — `/login`, `/dashboard`, etc.

```
User visits: http://56.228.42.126/dashboard

Without try_files fallback:
  Nginx looks for /dashboard file → not found → 404 ❌

With try_files $uri $uri/ /index.html:
  Nginx looks for /dashboard file → not found
  Nginx looks for /dashboard/ dir → not found
  Nginx serves index.html → React Router reads the URL → shows Dashboard ✅
```

---

## Nginx in docker-compose.prod.yml

```yaml
nginx:
  image: nginx:alpine      # official lightweight Nginx image
  ports:
    - "80:80"              # only Nginx is public-facing
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    # Mount our config file (read-only) — replaces default nginx config

    - ./frontend/dist:/usr/share/nginx/html:ro
    # Mount built React files (read-only) — Nginx serves these
  depends_on:
    - backend              # start after backend is running
```
