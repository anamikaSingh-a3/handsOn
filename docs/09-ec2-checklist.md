# EC2 Deployment Checklist

## Documentation Index
> Refer to these docs to revise any concept.

| File | What it covers |
|---|---|
| [01-docker-basics.md](01-docker-basics.md) | What Docker is, images, containers, Dockerfile, volumes, layer caching |
| [02-docker-compose.md](02-docker-compose.md) | Compose concepts, every line of dev + prod config explained |
| [03-nginx.md](03-nginx.md) | What Nginx does, nginx.conf explained, React Router fallback |
| [04-dev-workflow.md](04-dev-workflow.md) | How to run locally, hot reload, env vars, common issues |
| [05-ec2-deployment.md](05-ec2-deployment.md) | EC2 concepts, security groups, full deployment steps |
| [06-git-basics.md](06-git-basics.md) | Git fundamentals, GitHub, gitignore, deployment flow |
| [07-node-middleware-auth.md](07-node-middleware-auth.md) | Node event loop, Express, middleware, JWT, bcrypt, auth flow |
| [08-worker-threads.md](08-worker-threads.md) | Why workers, blocking vs non-blocking, implementation, UI demo |

---

## One-time setup
> These steps only need to be done once when setting up a new server.

- [ ] Create AWS account
- [ ] Launch EC2 instance (Ubuntu 24.04, t2.micro)
  - t2.micro is free tier — enough for learning and small apps
- [ ] Configure Security Group (port 22 My IP, 80 and 443 anywhere)
  - Port 22 restricted to your IP so bots can't brute-force SSH
  - Never add port 27017 (MongoDB) here — keep it private
- [ ] Download `.pem` key file, run `chmod 400 your-key.pem`
  - chmod 400 = only you can read it. SSH refuses keys with loose permissions
  - If you lose this file, you lose access to the server forever
- [ ] SSH into server: `ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>`
- [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`
  - Gets the latest Docker directly from Docker — more up to date than apt
- [ ] Add user to docker group: `sudo usermod -aG docker ubuntu && newgrp docker`
  - Without this, every docker command needs sudo
  - newgrp applies the change without logging out
- [ ] Install Git: `sudo apt install git -y`
- [ ] Clone repo: `git clone https://github.com/anamikaSingh-a3/handsOn.git`
- [ ] Set environment variables: `export JWT_SECRET=your_secret`
  - Never store secrets in files that get committed to git
  - export sets it for the current session only — see Notes for permanent solution

## Every deployment
> Run these steps every time you make changes and want to deploy.

- [ ] Make code changes on laptop
- [ ] Build frontend: `cd frontend && npm run build`
  - This compiles React into static files in frontend/dist/
  - Must rebuild every time frontend code changes
- [ ] Commit and push: `git add . && git commit -m "message" && git push`
  - Always include frontend/dist/ in the commit — EC2 uses these files directly
- [ ] On EC2: `git pull origin main`
- [ ] On EC2: `docker compose -f docker-compose.prod.yml up -d --build`
  - -f uses prod config instead of dev config
  - -d runs in background (detached)
  - --build rebuilds the image so new backend code is picked up

## Files needed in repo
> These must exist in the repo for deployment to work.

- [ ] `docker-compose.prod.yml` — prod version of compose (no bind mounts, nginx included)
- [ ] `nginx.conf` — routes /api/* to backend, /* to React static files
- [ ] `frontend/dist/` — built React app (Nginx serves these directly)
- [ ] `backend/Dockerfile` — instructions to build the backend image

## Things that should NEVER be in repo
> Git is public (or accessible to others). Never commit these.

- [ ] `.env` files — contain secrets like JWT_SECRET, DB passwords
- [ ] `node_modules/` — huge folder, recreated with npm install
- [ ] AWS keys or secrets
- [ ] `.pem` key files — anyone with this file can access your server

## Useful commands on EC2
```bash
# View running containers (shows status, ports, names)
docker ps

# View live logs from backend (-f = follow, like tail -f)
docker compose -f docker-compose.prod.yml logs -f backend

# Restart a single container (e.g. after nginx.conf change)
docker restart nginx

# Stop all containers (data in volumes is preserved)
docker compose -f docker-compose.prod.yml down

# Check disk usage (make sure you're not running out of space)
df -h

# Check memory usage
free -h
```

## SSH shortcut (add to ~/.ssh/config on laptop)
```
Host handson
  HostName <EC2_PUBLIC_IP>
  User ubuntu
  IdentityFile ~/Downloads/your-key.pem
```
Then just run: `ssh handson`

## Notes
- EC2 public IP changes every time you stop/start the instance
  → Use Elastic IP (fixed public IP) to avoid updating the SSH config every time
- MongoDB data persists in the `mongo_data` Docker named volume
  → Even if containers are removed, data survives as long as the volume exists
  → `docker compose down --volumes` would delete it — be careful
- In prod, backend and mongo have no exposed ports — only Nginx is public
  → Nginx routes /api/* to Express and /* to React static files
- JWT_SECRET set with `export` only lasts for the current SSH session
  → For permanent: add it to ~/.bashrc or use a .env file on the server (not committed)
