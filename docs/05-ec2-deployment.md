# EC2 Deployment Guide

## Architecture in production

```
Internet
  ↓ port 80
EC2 Instance (Ubuntu)
  └── Docker
      ├── nginx container    ← only public-facing container
      │   ├── /* → serves frontend/dist/ (React static files)
      │   └── /api/* → proxies to backend container
      ├── backend container  ← internal only, not exposed
      └── mongo container    ← internal only, NEVER exposed
```

---

## EC2 concepts

### What is EC2?
A virtual machine (server) running in AWS's data center.
You get a public IP, an OS (Ubuntu), CPU, RAM, and disk.
SSH into it and it feels like a regular Linux terminal.

### AMI (Amazon Machine Image)
The operating system pre-installed on your instance.
We use **Ubuntu 24.04 LTS** — popular, well-documented, long-term support.

### Instance type
How powerful your server is.
- `t2.micro` — 1 vCPU, 1GB RAM. Free tier eligible. Enough for learning.
- `t3.medium` — 2 vCPU, 4GB RAM. For small production apps.
- `t` family = burstable general purpose (can spike to full CPU when needed)

### Security Group (firewall)
Controls which ports are open to the internet.

```
Port 22   (SSH)   → My IP only (so only you can access the server)
Port 80   (HTTP)  → Anywhere  (your web app)
Port 443  (HTTPS) → Anywhere  (your web app, encrypted)
Port 27017 (Mongo) → NEVER open this — bots will wipe your DB within hours
Port 3000 (Node)  → Don't expose — Nginx handles this internally
```

### Key pair (.pem file)
How you authenticate to SSH in. No passwords — uses cryptographic keys.
- AWS stores the public key on the instance
- You download the private key (.pem file)
- **Never lose it** — no recovery option
- `chmod 400 key.pem` — SSH refuses to use keys with loose permissions

---

## One-time server setup

```bash
# 1. SSH into server
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@<EC2_PUBLIC_IP>

# 2. Install Docker
sudo apt update
curl -fsSL https://get.docker.com | sh
# WHY curl instead of apt: Gets latest Docker directly from Docker's own repo

# 3. Add ubuntu user to docker group
sudo usermod -aG docker ubuntu
# WHY: Without this, every docker command needs sudo
newgrp docker
# WHY: Applies the group change without logging out

# 4. Install Git
sudo apt install git -y

# 5. Clone your repo
git clone https://github.com/anamikaSingh-a3/handsOn.git
cd handsOn
git checkout main
```

---

## Every deployment

```bash
# On your laptop — make changes, build frontend, push
cd frontend && npm run build
# WHY: Compiles React into static files. Must rebuild when frontend changes.
# The dist/ folder is committed to git so EC2 can use it directly.

cd ..
git add .
git commit -m "describe your changes"
git push

# On EC2 — pull and redeploy
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# -f = use prod config file
# -d = detached (background)
# --build = rebuild backend image with latest code
```

---

## Prod vs Dev docker-compose differences

| Setting | Dev | Prod | Why |
|---|---|---|---|
| Mongo ports | 27017 exposed | Not exposed | Security — never public |
| Backend ports | 3001 exposed | Not exposed | Nginx handles it |
| Bind mount | ./backend:/app | None | No live reload needed in prod |
| Nginx | Not present | Present | Serves frontend + proxies API |
| Secrets | From .env file | From env vars | .env not on server |

---

## Environment variables in production

Never commit secrets. On the EC2 server:

```bash
# For current session only (lost when you disconnect)
export JWT_SECRET=your_secret_here

# For permanent (survives reconnects)
echo 'export JWT_SECRET=your_secret_here' >> ~/.bashrc
source ~/.bashrc
```

Then docker-compose.prod.yml reads it:
```yaml
environment:
  JWT_SECRET: ${JWT_SECRET}   # picks up from shell environment
```

---

## SSH shortcut setup

Instead of remembering the full SSH command, add to `~/.ssh/config` on your laptop:

```
Host handson
  HostName <EC2_PUBLIC_IP>
  User ubuntu
  IdentityFile ~/Downloads/your-key.pem
```

Then just: `ssh handson`

**Note:** EC2 public IP changes every time you stop/start the instance.
Update the HostName when this happens, or use an Elastic IP (fixed IP).

---

## Useful server commands

```bash
# See all running containers
docker ps

# Live logs from backend
docker compose -f docker-compose.prod.yml logs -f backend

# Restart Nginx (after nginx.conf change — no rebuild needed)
docker restart nginx

# Stop everything (data preserved in volumes)
docker compose -f docker-compose.prod.yml down

# Check disk space (t2.micro has 8GB — Docker images take space)
df -h

# Check memory
free -h

# See Docker image sizes
docker images
```

---

## Important notes

- **MongoDB data** lives in `mongo_data` Docker named volume
  - Survives container restarts and `docker compose down`
  - Deleted only with `docker compose down --volumes` — be careful

- **Public IP changes** every time you stop/start the EC2 instance
  - Use Elastic IP for a permanent address

- **Costs**: t2.micro is free for 12 months (750 hours/month)
  - Stop the instance when not using it to save the free tier hours
  - Elastic IP costs money if not attached to a running instance

- **HTTPS**: Currently running on HTTP (port 80)
  - For production apps, add SSL with Let's Encrypt + certbot
  - Nginx handles SSL termination
