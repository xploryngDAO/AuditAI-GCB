@echo off
setlocal EnableExtensions
title AuditAI GCB - Iniciar sistema
cd /d "%~dp0"

if not exist "package.json" (
  echo [ERRO] Execute este arquivo na raiz do repositorio AuditAI GCB.
  pause
  exit /b 1
)
if not exist ".env" (
  echo [ERRO] Ambiente nao configurado. Execute INSTALAR.bat primeiro.
  pause
  exit /b 1
)
if not exist "dist\server.cjs" (
  echo [ERRO] Build ausente. Execute INSTALAR.bat para configurar e compilar.
  pause
  exit /b 1
)
if not exist "node_modules\express\package.json" (
  echo [ERRO] Dependencias ausentes. Execute INSTALAR.bat primeiro.
  pause
  exit /b 1
)

for /f "tokens=2 delims==" %%p in ('findstr /b /c:"PORT=" .env') do set "PORT=%%~p"
if not defined PORT set "PORT=3000"

echo ==============================================================
echo  AuditAI GCB - iniciando servidor local
echo  Endereco : http://localhost:%PORT%
echo  Para encerrar pressione Ctrl+C nesta janela.
echo ==============================================================
echo.

set "NODE_ENV=production"
start "" /b node scripts\open-when-ready.mjs
call npm start
echo.
echo Servidor encerrado.
pause
exit /b 0
