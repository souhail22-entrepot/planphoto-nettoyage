@echo off
title PlanPhoto Nettoyage — Démarrage...
color 1F

echo.
echo  =========================================
echo   PlanPhoto Nettoyage  ^|  SDC inc
echo  =========================================
echo.
echo  Démarrage du serveur...
echo.

cd /d "%~dp0"

:: Vérifier que le dossier dist existe
if not exist "dist\index.html" (
    echo  [!] Premier lancement : compilation en cours...
    call npm run build
    echo.
)

:: Lancer le serveur preview en arrière-plan
start "" /B cmd /c "npm run preview > nul 2>&1"

:: Attendre que le serveur soit prêt
echo  Attente du serveur...
timeout /t 3 /nobreak > nul

:: Ouvrir automatiquement dans le navigateur par défaut
start "" "http://localhost:4173"

echo  Application ouverte dans le navigateur.
echo.
echo  Gardez cette fenêtre ouverte tant que vous utilisez l'application.
echo  Fermez-la pour arrêter le serveur.
echo.
echo  =========================================
echo.

:: Garder le serveur actif
npm run preview
