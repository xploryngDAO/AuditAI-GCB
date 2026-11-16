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

call :is_port_busy %PORT%
if "%PORT_BUSY%"=="1" (
  echo [ERRO] A porta %PORT% ja esta em uso.
  echo        Feche o programa que a utiliza ou edite a linha PORT= do arquivo .env
  echo        e execute INICIAR.bat novamente.
  pause
  exit /b 1
)

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

:is_port_busy
set "PORT_BUSY=0"
node -e "const n=require('net');const s=n.connect(+process.argv[1],'127.0.0.1');s.setTimeout(700);s.on('connect',()=>{s.destroy();process.exit(1)});s.on('timeout',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(0));" %1 >nul 2>&1
if errorlevel 1 set "PORT_BUSY=1"
goto :eof
