@echo off
setlocal

set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
if exist "%CARGO_BIN%\cargo.exe" set "PATH=%CARGO_BIN%;%PATH%"

where cargo >nul 2>nul
if errorlevel 1 (
  echo [wrapx] cargo.exe was not found. Install Rust or add %%USERPROFILE%%\.cargo\bin to PATH.
  exit /b 1
)

set "VCVARS64="
for %%R in ("%ProgramFiles%\Microsoft Visual Studio\2022" "%ProgramFiles(x86)%\Microsoft Visual Studio\2022") do (
  for %%E in (BuildTools Community Professional Enterprise) do (
    if exist "%%~R\%%E\VC\Auxiliary\Build\vcvars64.bat" set "VCVARS64=%%~R\%%E\VC\Auxiliary\Build\vcvars64.bat"
  )
)

if defined VCVARS64 (
  call "%VCVARS64%" >nul 2>nul
) else (
  echo [wrapx] vcvars64.bat was not found. Continuing without MSVC environment.
)

if "%~1"=="" (
  call npx tauri dev
) else (
  call npx tauri %*
)
