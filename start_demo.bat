@echo off
echo ========================================================
echo   OmniAgent AI - Universal Website AI Agent Platform
echo ========================================================
echo Starting Backend Server on http://localhost:8000 ...
start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend Server on http://localhost:3000 ...
start "Frontend - Next.js" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Application Servers Starting!
echo Frontend: http://localhost:3000
echo Backend API Docs: http://localhost:8000/docs
echo ========================================================
