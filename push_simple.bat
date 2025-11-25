@echo off
REM Simple GitHub Push Script - Uses Git Credential Manager

cd /d "C:\Users\User\Documents\CI Alert System"

echo 🚀 Pushing CI Alert System to GitHub

REM Configure git to use credential manager
git config credential.helper manager-core

REM Set remote URL without token
git remote set-url origin https://github.com/harshasm123/CI-Alerts-System-Manual.git

REM Pull remote changes first
echo 📥 Pulling remote changes...
git pull origin main --allow-unrelated-histories

REM Stage all files
echo 📂 Staging files...
git add .

REM Commit if there are changes
echo 💾 Committing changes...
git commit -m "Update: CI Alert System files" 2>nul || echo No new changes to commit

REM Push to GitHub (will open browser for authentication)
echo 📤 Pushing to GitHub...
git push origin main

echo.
echo ✅ Done! Check: https://github.com/harshasm123/CI-Alerts-System-Manual.git

pause