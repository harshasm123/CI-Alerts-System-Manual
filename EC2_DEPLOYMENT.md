# EC2 Ubuntu Deployment Guide

## Quick Setup on EC2 Ubuntu Instance

### 1. Connect to EC2 Instance
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 2. Download and Run Setup Script
```bash
# Download setup script
curl -O https://raw.githubusercontent.com/harshasm123/CI-Alerts-System-Manual/main/ec2_setup.sh

# Make executable
chmod +x ec2_setup.sh

# Run setup
./ec2_setup.sh
```

### 3. Manual Git Pull (Alternative Method)
```bash
# Install Git
sudo apt-get update
sudo apt-get install -y git

# Clone repository
git clone https://github.com/harshasm123/CI-Alerts-System-Manual.git
cd CI-Alerts-System-Manual

# Pull latest changes
git pull origin main
```

### 4. Configure AWS Credentials
```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

### 5. Deploy Infrastructure
```bash
cd ~/CI-Alerts-System-Manual
chmod +x deploy.sh
./deploy.sh
```

## Update Existing Deployment

### Pull Latest Changes
```bash
cd ~/CI-Alerts-System-Manual
git pull origin main
```

### Redeploy
```bash
./deploy.sh
```

## Troubleshooting

### Git Authentication Issues
```bash
# Use HTTPS with token
git clone https://ghp_YOUR_TOKEN@github.com/harshasm123/CI-Alerts-System-Manual.git

# Or configure credential helper
git config --global credential.helper store
git pull
# Enter username and token when prompted
```

### Permission Issues
```bash
# Fix script permissions
chmod +x *.sh

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker
```

### AWS CLI Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```