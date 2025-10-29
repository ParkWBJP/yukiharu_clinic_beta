@echo off
REM Launch server and client in separate windows (Windows only)
start "YukiHaru Server" cmd /k "npm run server"
start "YukiHaru Client" cmd /k "npm run client"

