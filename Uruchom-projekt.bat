@echo off
rem =====================================================================================
rem  Cebulion Casino: uruchomienie bez IntelliJ (dwuklik).
rem  Szuka Javy 21, startuje aplikacje przez Maven Wrapper (Maven nie jest potrzebny),
rem  pokazuje konta zespolu z bazy i otwiera http://localhost:8080.
rem  Logika: tools\uruchom\uruchom.ps1. Zatrzymanie: Ctrl+C albo zamkniecie okna.
rem =====================================================================================
title Cebulion Casino
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\uruchom\uruchom.ps1"
if errorlevel 1 pause
