# Git Commands for Merge Conflicts

## Fix "local changes would be overwritten" Error

### Option 1: Stash Changes (Keep for Later)
```bash
# Save local changes
git stash

# Pull latest changes
git pull origin main

# Reapply your changes
git stash pop
```

### Option 2: Discard Local Changes
```bash
# Discard all local changes
git reset --hard HEAD

# Pull latest changes
git pull origin main
```

### Option 3: Commit Local Changes
```bash
# Add changes
git add .

# Commit changes
git commit -m "Local changes to prereq.sh"

# Pull with merge
git pull origin main

# If conflicts, resolve and commit
git add .
git commit -m "Merge remote changes"
```

## Quick Fix for Your Situation
```bash
# Discard local prereq.sh changes and pull
git checkout -- prereq.sh
git pull origin main
```