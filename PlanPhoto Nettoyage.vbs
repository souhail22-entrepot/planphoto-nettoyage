Dim objShell, objFSO, projectDir, logFile

Set objShell = WScript.CreateObject("WScript.Shell")
Set objFSO   = WScript.CreateObject("Scripting.FileSystemObject")

' Dossier du projet (même dossier que ce fichier .vbs)
projectDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Lancer le serveur preview en arrière-plan (fenêtre cachée)
objShell.Run "cmd /c cd /d """ & projectDir & """ && npm run preview", 0, False

' Attendre que le serveur démarre (3 secondes)
WScript.Sleep 3000

' Ouvrir l'application dans le navigateur par défaut
objShell.Run "http://localhost:4173", 1, False

Set objShell = Nothing
Set objFSO   = Nothing
