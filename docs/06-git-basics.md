# Git Basics

## What is Git?

Git tracks changes to your code over time. Think of it as a save system —
you can snapshot your code at any point and go back to any previous snapshot.

```
Without Git                    With Git
────────────                   ────────
project/                       project/  (one folder, full history inside)
project_v2/
project_v2_final/
project_v2_REAL_FINAL/
```

---

## Three places your code lives

```
Working Directory  →  Staging Area  →  Repository (commits)
(files you edit)      (what you're       (permanent snapshots)
                       about to save)
```

1. **Working directory** — your actual files on disk
2. **Staging area** — you choose what goes into the next commit
3. **Repository** — permanent history of all commits

---

## Core commands

```bash
# Check status (always start here — shows what changed)
git status

# Stage specific file
git add server.js

# Stage everything in current folder
git add .

# Commit (save a snapshot with a message)
git commit -m "add login route"

# See commit history
git log --oneline

# See what changed (unstaged)
git diff

# See what's staged
git diff --staged
```

---

## GitHub = cloud storage for Git

Git lives on your machine. GitHub hosts your repo in the cloud.

```
Your Laptop (git)  ←→  GitHub (cloud copy)
```

Benefits:
- Backup your code
- Access from any machine (EC2 server can clone it)
- Collaborate with others

```bash
# Connect local repo to GitHub
git remote add origin https://github.com/username/repo.git

# Push your commits to GitHub
git push -u origin main
# -u sets the default — after this, just run: git push

# Get latest changes from GitHub
git pull

# See what remotes are connected
git remote -v
```

---

## Branches

A branch is a separate line of development. The main branch is usually `main` or `master`.

```bash
# Create and switch to a new branch
git checkout -b feature/login

# Switch between branches
git checkout main

# See all branches
git branch -a

# Merge a branch into current branch
git merge feature/login
```

---

## .gitignore — what NOT to track

Some files should never be in git:

```
node_modules/   — huge (100k+ files), recreated with npm install
.env            — contains secrets (JWT_SECRET, DB passwords)
*.pem           — SSH private keys — anyone with this can access your server
```

Our `.gitignore`:
```
node_modules/
.env
```

If you accidentally commit something sensitive:
```bash
git rm --cached .env          # stop tracking (file stays on disk)
git commit -m "remove .env from tracking"
```

---

## Fixing mistakes

```bash
# Undo last commit but keep the changes (staged)
git reset --soft HEAD~1

# Change the last commit (message or add forgotten files)
git commit --amend --no-edit

# Completely discard unstaged changes to a file
git checkout -- filename.js
```

---

## Changing git author name

```bash
# Set for all future commits
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Verify
git config --global user.name
git config --global user.email

# Fix the last commit's author (if already committed)
git commit --amend --reset-author --no-edit
git push --force   # needed if already pushed
```

---

## The deployment flow with Git

```
Your Laptop                GitHub               EC2 Server
───────────                ──────               ──────────
edit code
git add .
git commit -m "..."
git push           →    stores commit
                                        git pull origin main
                                        docker compose up --build
```

Git is the bridge between your laptop and the EC2 server.
The server never gets code directly — it always goes through GitHub.

---

## Common workflow

```bash
# Start of day — get latest
git pull

# Make changes
# ... edit files ...

# Save progress
git add .
git commit -m "describe what you did"

# Share with GitHub / deploy
git push
```
