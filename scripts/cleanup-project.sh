#!/bin/bash

# Cleanup and organize project structure

echo "🧹 Cleaning up project structure..."
echo ""

# Remove duplicate/unnecessary files
echo "Removing duplicate files..."

# Remove duplicate deployment guides (keep QUICKSTART.md and README.md)
rm -f DEPLOYMENT_GUIDE.md
rm -f DEPLOYMENT_INSTRUCTIONS.md
rm -f MANUAL_DEPLOY.md
rm -f PRODUCTION_DEPLOYMENT_GUIDE.md
rm -f EC2_DEPLOYMENT.md

# Remove duplicate system docs (keep README.md)
rm -f PROJECT_OVERVIEW.md
rm -f SYSTEM_DESIGN.md

# Remove duplicate git guides (keep one)
rm -f GIT_COMMANDS.md
rm -f GITHUB_SETUP.md

# Remove duplicate healthcare docs (merge into one)
rm -f HEALTHCARE_USE_CASE.md

# Remove Windows batch files (use .sh scripts)
rm -f push_simple.bat
rm -f push_to_github.bat

# Remove duplicate key files
rm -f Voregonkey.pem

# Remove get-docker.sh (integrated into prereq.sh)
rm -f get-docker.sh

# Remove quick-deploy.sh (use deploy.sh)
rm -f quick-deploy.sh

# Remove test.sh (integrated into deploy.sh)
rm -f test.sh

# Remove ec2_setup.sh (use prereq.sh)
rm -f ec2_setup.sh

echo "✅ Cleanup complete!"
echo ""
echo "Remaining structure:"
echo "  📁 Root scripts: deploy.sh, prereq.sh, config.sh, fix-region.sh, check-bootstrap.sh, GET_URLS.sh, destroy.sh"
echo "  📁 Docs: README.md, QUICKSTART.md, LICENSE"
echo "  📁 Domain: USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md, USA_MOLECULES_DATABASE.md"
echo "  📁 Infrastructure: infrastructure/"
echo "  📁 Code: lambdas/, frontend/"
echo "  📁 CI/CD: cicd/"
echo "  📁 Monitoring: monitoring/"
echo "  📁 Scripts: scripts/"
