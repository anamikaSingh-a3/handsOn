# GitHub Actions — CI/CD

## What is CI/CD?

CI/CD stands for **Continuous Integration / Continuous Deployment**.

Instead of manually SSHing into your server and running commands every time you push code, you automate that entire process.

```
You push to main
      ↓
GitHub detects the push
      ↓
GitHub Actions spins up a temporary runner (VM)
      ↓
Did frontend/ files change?
  ├── YES → build React (npm run build) → copy dist/ to EC2
  └── NO  → skip build and copy
      ↓
SSH into EC2 → git pull + docker compose up --build
```

---

## Managing Secrets

Your app needs secrets (JWT keys, DB URIs, etc.) that must never be committed to git. Here are your options:

### Option 1: `export` in SSH session
```bash
export JWT_SECRET=mysecret
docker compose up -d
```
**Problem:** Lost when you exit SSH. Not persistent.

---

### Option 2: `.env` file on the server
```bash
echo "JWT_SECRET=mysecret" > ~/handsOn/.env
```
Docker Compose automatically picks up `.env` from the same directory.

- Persists on the server
- Never commit this file to git
- Simple, works well for small projects

---

### Option 3: Export in `~/.bashrc`
```bash
echo 'export JWT_SECRET=mysecret' >> ~/.bashrc
source ~/.bashrc
```
Persists across SSH sessions, but stored as plain text on the server.

---

### Option 4: GitHub Actions Secrets (recommended with CI/CD)
Store secrets in GitHub — encrypted, never visible in logs or code.

The CI/CD pipeline creates the `.env` file on EC2 automatically during each deploy.

**How to add:**
1. Go to your GitHub repo
2. **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add each secret

**Secrets needed for this project:**

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | your EC2 public IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | full contents of your `.pem` file |
| `JWT_SECRET` | your actual JWT secret value |

**To copy your `.pem` file contents on Mac:**
```bash
cat /path/to/your-key.pem | pbcopy
```
Paste the entire output (including `-----BEGIN RSA PRIVATE KEY-----` lines) as the secret value.

---

### Option 5: AWS Systems Manager — Parameter Store
Store secrets in AWS itself, fetch them at runtime. Most secure option for production, but more setup involved.

---

## The Workflow File

Located at `.github/workflows/deploy.yml`. GitHub automatically detects and runs any `.yml` files in this directory.

```yaml
name: Deploy to EC2

on:
  push:
    branches:
      - main          # triggers only on pushes to main

jobs:
  deploy:
    runs-on: ubuntu-latest    # GitHub spins up a fresh Ubuntu VM

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 2        # fetch last 2 commits so we can diff what changed

      - name: Check for frontend changes
        id: frontend-changes
        run: |
          if git diff --name-only HEAD~1 HEAD | grep -q '^frontend/'; then
            echo "changed=true" >> $GITHUB_OUTPUT
          else
            echo "changed=false" >> $GITHUB_OUTPUT
          fi
        # Compares this commit to the previous one
        # Sets output variable changed=true/false

      - name: Build frontend
        if: steps.frontend-changes.outputs.changed == 'true'
        run: |
          cd frontend
          npm install
          npm run build
        # Only runs if frontend files changed
        # Generates frontend/dist/ — no need to commit dist/ to git

      - name: Copy dist to EC2
        if: steps.frontend-changes.outputs.changed == 'true'
        uses: appleboy/scp-action@v0.1.7
        # Only runs if frontend files changed
        # Transfers built dist/ to EC2 via scp
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          source: "frontend/dist/"
          target: "~/handsOn/frontend/"
          strip_components: 1

      - name: SSH into EC2 and deploy
        uses: appleboy/ssh-action@v1.0.3
        # Always runs — backend always needs to be redeployed
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/handsOn

            # Write .env file from GitHub secret
            echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" > .env
            echo "MONGO_URI=mongodb://mongo:27017/myApp" >> .env

            # Pull latest code
            git pull origin main

            # Rebuild and restart containers
            docker compose -f docker-compose.prod.yml up -d --build
```

### What each step does:

**`Checkout code`**
Clones your repo onto the GitHub runner VM. `fetch-depth: 2` fetches the last 2 commits so we can compare what changed.

**`Check for frontend changes`**
Diffs the current commit against the previous one. If any file inside `frontend/` changed, it sets `changed=true`. This output is used by the next two steps.

**`Build frontend`** _(runs only if frontend changed)_
Runs `npm install && npm run build` on the runner. Generates `frontend/dist/` — the compiled React app ready to be served by Nginx.

**`Copy dist to EC2`** _(runs only if frontend changed)_
Uses `scp` (secure copy) to transfer the built `dist/` folder from the runner to your EC2. This is why you don't need to commit `dist/` to git.

**`SSH into EC2 and deploy`** _(always runs)_
SSHs into EC2 and:

1. Recreates the `.env` file with secrets from GitHub
2. Pulls latest code from main
3. Rebuilds Docker images and restarts containers

---

### When does each step run?

| Push contains | Build frontend | Copy dist | Deploy  |
| ------------- | -------------- | --------- | ------- |
| Backend only  | No             | No        | Yes     |
| Frontend only | Yes            | Yes       | Yes     |
| Both          | Yes            | Yes       | Yes     |

---

## Removing `frontend/dist` from git

Since the CI/CD pipeline now builds and copies `dist/` automatically, you don't need it in git.

```bash
# Remove from git tracking (keeps files on disk)
git rm -r --cached frontend/dist

# Add to .gitignore so it's never tracked again
echo "frontend/dist" >> .gitignore

git add .gitignore
git commit -m "remove frontend/dist from git tracking"
```

---

## How to trigger a deploy

Just push to main:
```bash
git add .
git commit -m "your changes"
git push origin main
```

That's it. GitHub Actions handles the rest.

---

## Monitoring deployments

Go to your GitHub repo → **Actions** tab to see:
- All workflow runs
- Live logs for each step
- Success/failure status

If a deploy fails, the logs will show exactly which step failed and why.

---

## Why not just keep SSHing manually?

| Manual | GitHub Actions |
|--------|----------------|
| SSH in every time | Automatic on push |
| Easy to forget steps | Always runs the same steps |
| Secrets typed in terminal | Secrets stored securely in GitHub |
| No history of deploys | Full audit log in Actions tab |
