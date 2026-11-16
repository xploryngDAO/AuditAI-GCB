@echo off
setlocal EnableExtensions
title AuditAI GCB - Instalacao e configuracao local
cd /d "%~dp0"

echo ==============================================================
echo  AuditAI GCB - instalacao e configuracao local
echo  Tudo local: sem nuvem, sem banco externo, sem landing page.
echo ==============================================================
echo.

if not exist "package.json" (
  echo [ERRO] Execute este arquivo na raiz do repositorio AuditAI GCB.
  goto :fail
)

REM --------------------------------------------------------------
REM [1/7] Node.js 24+
REM --------------------------------------------------------------
set "NODE_MAJOR="
where node >nul 2>&1
if errorlevel 1 goto :install_node
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :install_node
if %NODE_MAJOR% LSS 24 goto :install_node
echo [1/7] Node.js OK:
node -v
goto :deps

:install_node
echo [1/7] Node.js 24+ nao encontrado. Tentando instalar o LTS via winget...
where winget >nul 2>&1
if errorlevel 1 goto :node_manual
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 goto :node_manual
set "NODE_MAJOR="
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :node_manual
if %NODE_MAJOR% LSS 24 goto :node_manual
echo [1/7] Node.js instalado:
node -v
goto :deps

:node_manual
echo.
echo [ERRO] Nao foi possivel instalar o Node.js automaticamente.
echo        Baixe o Node.js LTS 24 ou superior em https://nodejs.org
echo        e execute este INSTALAR.bat novamente.
goto :fail

REM --------------------------------------------------------------
REM [2/7] Dependencias
REM --------------------------------------------------------------
:deps
echo.
echo [2/7] Instalando dependencias (npm)...
if exist "node_modules\express\package.json" (
  call npm install --no-audit --no-fund --prefer-offline
) else (
  call npm ci --no-audit --no-fund
)
if errorlevel 1 goto :fail
echo [2/7] Dependencias OK.

REM --------------------------------------------------------------
REM [3/7] .env local
REM --------------------------------------------------------------
if exist ".env" goto :env_ok
echo.
echo [3/7] Criando arquivo .env local (segredos aleatorios)...
set "SECRET="
for /f "delims=" %%s in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "SECRET=%%s"
if not defined SECRET goto :fail
set "PORT=3000"
call :find_free_port
>".env" echo # Gerado automaticamente por INSTALAR.bat - ambiente local AuditAI GCB
>>".env" echo NODE_ENV="development"
>>".env" echo PORT="%PORT%"
>>".env" echo APP_URL="http://localhost:%PORT%"
>>".env" echo SESSION_SECRET="%SECRET%"
>>".env" echo MAX_REQUEST_BODY="25mb"
>>".env" echo ALLOW_EPHEMERAL_PERSISTENCE="false"
>>".env" echo # Para usar Postgres local no futuro, descomente e ajuste DATABASE_URL.
>>".env" echo # DATABASE_URL="postgresql://usuario:senha@127.0.0.1:5432/auditai_gcb"
echo [3/7] .env criado (porta %PORT%).
goto :seed

:env_ok
for /f "tokens=2 delims==" %%p in ('findstr /b /c:"PORT=" .env') do set "PORT=%%~p"
if not defined PORT set "PORT=3000"
echo.
echo [3/7] .env existente mantido (porta %PORT%).

REM --------------------------------------------------------------
REM [4/7] Banco local + contas iniciais
REM --------------------------------------------------------------
:seed
echo.
echo [4/7] Preparando banco de dados local e contas iniciais...
call node scripts\seed-local.mjs
if errorlevel 1 goto :fail
echo [4/7] Banco local OK (database_store.json).

REM --------------------------------------------------------------
REM [5/7] Build de producao
REM --------------------------------------------------------------
echo.
echo [5/7] Compilando a aplicacao (build de producao)...
call npm run build
if errorlevel 1 goto :fail
if not exist "dist\server.cjs" goto :fail
if not exist "dist\index.html" goto :fail
echo [5/7] Build OK.

REM --------------------------------------------------------------
REM [6/7] Porta livre
REM --------------------------------------------------------------
echo.
echo [6/7] Verificando se a porta %PORT% esta livre...
call :is_port_busy %PORT%
if "%PORT_BUSY%"=="1" (
  echo [ERRO] A porta %PORT% ja esta em uso.
  echo        Feche o programa que a utiliza ou edite a linha PORT= do arquivo .env
  echo        e execute este INSTALAR.bat novamente.
  goto :fail
)
echo [6/7] Porta %PORT% livre.

REM --------------------------------------------------------------
REM [7/7] Inicio do sistema
REM --------------------------------------------------------------
echo.
if "%AUDITAI_GCB_NO_START%"=="1" goto :skip_start

:start_server
echo [7/7] Iniciando o servidor local em modo producao...
echo.
echo   Endereco : http://localhost:%PORT%
echo   Master   : marcel.andre@viavarejo.com.br / Mudar@123
echo   Tenant   : Grupo Casas Bahia
echo   Admin    : marcel.andre@casasbahia.com.br / Mudar@123
echo.
echo   O navegador abrira automaticamente quando o servidor responder.
echo   Para encerrar o servidor pressione Ctrl+C nesta janela.
echo.
set "PORT=%PORT%"
set "NODE_ENV=production"
start "" /b node scripts\open-when-ready.mjs
call npm start
echo.
echo Servidor encerrado.
goto :success_pause

:skip_start
echo [7/7] AUDITAI_GCB_NO_START=1 - inicio automatico ignorado (modo de automacao).
echo.
echo Instalacao e configuracao concluidas com sucesso.
goto :success_nopause

REM --------------------------------------------------------------
REM Rotinas auxiliares
REM --------------------------------------------------------------
:find_free_port
set "PORT=3000"
:find_free_port_loop
call :is_port_busy %PORT%
if "%PORT_BUSY%"=="0" goto :eof
set /a PORT+=1
if %PORT% GTR 3010 goto :eof
goto :find_free_port_loop

:is_port_busy
set "PORT_BUSY=0"
node -e "const n=require('net');const s=n.connect(+process.argv[1],'127.0.0.1');s.setTimeout(700);s.on('connect',()=>{s.destroy();process.exit(1)});s.on('timeout',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(0));" %1 >nul 2>&1
if errorlevel 1 set "PORT_BUSY=1"
goto :eof

:success_nopause
if not "%AUDITAI_GCB_NO_PAUSE%"=="1" pause
exit /b 0

:success_pause
if not "%AUDITAI_GCB_NO_PAUSE%"=="1" pause
exit /b 0

:fail
echo.
echo [FALHA] A instalacao nao foi concluida. Veja as mensagens acima.
if not "%AUDITAI_GCB_NO_PAUSE%"=="1" pause
exit /b 1
