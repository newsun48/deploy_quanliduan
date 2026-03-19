@echo off
REM ============================================
REM Start Project Management System
REM Backend + Frontend
REM ============================================

echo.
echo ╔════════════════════════════════════════════════╗
echo ║  🚀 Project Management System Startup Script   ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Check if arguments provided
if "%1"=="" goto show_options
if /i "%1"=="backend" goto start_backend
if /i "%1"=="frontend" goto start_frontend
if /i "%1"=="both" goto start_both
if /i "%1"=="help" goto show_options

echo ❌ Không biết option: %1
goto show_options

:show_options
echo 📋 Options:
echo.
echo   start_system.cmd backend    - 🔧 Chạy Backend (port 8080)
echo   start_system.cmd frontend   - 🎨 Chạy Frontend (port 5173)
echo   start_system.cmd both       - 🚀 Chạy cả Backend + Frontend
echo   start_system.cmd help       - ℹ️  Hiển thị options
echo.
echo 📖 Sau khi chạy:
echo   - Backend: http://localhost:8080
echo   - Frontend: http://localhost:5173
echo.
goto end

:start_backend
echo.
echo [1/1] 🔧 Chạy Backend...
echo ════════════════════════════════════════════════
cd /d "c:\Users\Tan\QUANLYDUAN"
mvn spring-boot:run
goto end

:start_frontend
echo.
echo [1/1] 🎨 Chạy Frontend...
echo ════════════════════════════════════════════════
cd /d "c:\Users\Tan\QUANLYDUAN\client-app"
npm run dev
goto end

:start_both
echo.
echo [1/2] 🔧 Khởi động Backend (trong tab mới)...
start "Backend - Port 8080" cmd /k "cd /d c:\Users\Tan\QUANLYDUAN && mvn spring-boot:run"

REM Đợi 5 giây để backend khởi động
timeout /t 5 /nobreak

echo.
echo [2/2] 🎨 Khởi động Frontend (trong tab mới)...
start "Frontend - Port 5173" cmd /k "cd /d c:\Users\Tan\QUANLYDUAN\client-app && npm run dev"

echo.
echo ✅ Cả hai services đang khởi động!
echo ════════════════════════════════════════════════
echo 🔗 Backend:  http://localhost:8080
echo 🎨 Frontend: http://localhost:5173
echo.
echo 📌 Cửa sổ này sẽ tự đóng sau 10 giây...
timeout /t 10 /nobreak
goto end

:end
