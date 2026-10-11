@echo off
echo =================================================================
echo                    Starting FinAI Application
echo =================================================================

start "FinAI - Node.js Backend (Port 5000)" cmd /k "cd /d %~dp0 && npm start"
start "FinAI - Python AI Service (Port 5001)" cmd /k "cd /d %~dp0 && python run.py"
start "FinAI - React Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo All services are launching!
echo App will be available at: http://localhost:5173
timeout /t 3
start http://localhost:5173
