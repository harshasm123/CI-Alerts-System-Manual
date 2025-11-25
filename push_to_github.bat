@echo off
REM CI Alert System - GitHub Push Script (Windows)
REM Repository: https://github.com/harshasm123/CI-Alerts-System-Manual.git

setlocal enabledelayedexpansion

set REPO_URL=https://github.com/harshasm123/CI-Alerts-System-Manual.git
cd /d "C:\Users\User\Documents\CI Alert System"

echo 🚀 Pushing CI Alert System to GitHub

REM Initialize git if not already initialized
if not exist ".git" (
    echo 📦 Initializing git repository...
    git init
    git branch -M main
)

REM Add remote if not exists
git remote | findstr /C:"origin" >nul
if errorlevel 1 (
    echo 🔗 Adding remote origin...
    git remote add origin %REPO_URL%
) else (
    echo ✓ Remote origin already exists
    git remote set-url origin %REPO_URL%
)

REM Create .gitignore if not exists
if not exist ".gitignore" (
    echo 📝 Creating .gitignore...
    (
        echo # Dependencies
        echo node_modules/
        echo __pycache__/
        echo *.pyc
        echo .venv/
        echo venv/
        echo.
        echo # CDK
        echo cdk.out/
        echo .cdk.staging/
        echo.
        echo # Environment
        echo .env
        echo .env.local
        echo *.pem
        echo *.key
        echo.
        echo # AWS
        echo .aws/
        echo aws-exports.js
        echo.
        echo # IDE
        echo .vscode/
        echo .idea/
        echo *.swp
        echo *.swo
        echo.
        echo # OS
        echo .DS_Store
        echo Thumbs.db
        echo.
        echo # Build
        echo dist/
        echo build/
        echo *.zip
        echo.
        echo # Logs
        echo *.log
        echo npm-debug.log*
    ) > .gitignore
)

REM Stage all files
echo 📂 Staging files...
git add .

REM Commit changes
echo 💾 Committing changes...
set COMMIT_MSG=%~1
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Initial commit: CI Alert System for Healthcare Competitive Intelligence
git commit -m "%COMMIT_MSG%" 2>nul || echo No changes to commit

REM Push to GitHub
echo ⬆️  Pushing to GitHub...
set /p GITHUB_TOKEN="Enter your GitHub Personal Access Token: "

echo.
echo Choose push option:
echo 1. Normal push (will fail if remote has changes)
echo 2. Pull and merge first (recommended)
echo 3. Force push (overwrites remote - use with caution)
set /p PUSH_OPTION="Enter option (1/2/3): "

if "%PUSH_OPTION%"=="1" (
    git push https://%GITHUB_TOKEN%@github.com/harshasm123/CI-Alerts-System-Manual.git main
) else if "%PUSH_OPTION%"=="2" (
    echo 📥 Pulling remote changes...
    git pull https://%GITHUB_TOKEN%@github.com/harshasm123/CI-Alerts-System-Manual.git main --no-rebase
    echo 📤 Pushing merged changes...
    git push https://%GITHUB_TOKEN%@github.com/harshasm123/CI-Alerts-System-Manual.git main
) else if "%PUSH_OPTION%"=="3" (
    echo ⚠️  Force pushing...
    git push https://%GITHUB_TOKEN%@github.com/harshasm123/CI-Alerts-System-Manual.git main --force
) else (
    echo Invalid option. Exiting.
    exit /b 1
)

if errorlevel 1 (
    echo ❌ Push failed!
    exit /b 1
)

echo ✅ Successfully pushed to GitHub!
echo 🔗 Repository: %REPO_URL%

endlocal