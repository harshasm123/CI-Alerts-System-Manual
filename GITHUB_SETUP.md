# GitHub Repository Setup on Ubuntu

## First Time Setup

### Install Git
```bash
sudo apt update
sudo apt install git -y
git --version
```

### Configure Git
```bash
git config --global user.name "Harsha"
git config --global user.email "harshasm123@gmail.com"
```

### Clone Repository
```bash
# Using HTTPS
git clone https://github.com/username/ci-alert-system.git
cd ci-alert-system

# Using SSH (recommended)
git clone git@github.com:username/ci-alert-system.git
cd ci-alert-system
```

### Setup SSH Key (for SSH clone)
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Start SSH agent
eval "$(ssh-agent -s)"

# Add SSH key
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub
# Add this key to GitHub: Settings → SSH and GPG keys → New SSH key
```

### Install Prerequisites
```bash
# Run prerequisites script
chmod +x prereq.sh
./prereq.sh
```

### Deploy System
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Common Git Commands

```bash
# Check status
git status

# Pull latest changes
git pull origin main

# Create new branch
git checkout -b feature-name

# Commit changes
git add .
git commit -m "Description of changes"

# Push changes
git push origin feature-name

# Switch branches
git checkout main
```

## Troubleshooting

### Permission Denied (SSH)
```bash
# Check SSH connection
ssh -T git@github.com

# If fails, add key to agent
ssh-add ~/.ssh/id_ed25519
```

### Authentication Failed (HTTPS)
```bash
# Use personal access token instead of password
# Generate token: GitHub → Settings → Developer settings → Personal access tokens
```