@echo off
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS and run: npm install -g pnpm
  pause
  exit /b 1
)
if not exist node_modules call pnpm install
call pnpm dev --open
