const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs   = require('fs')

// Dossier userData pour les logs éventuels
app.setAppUserModelId('com.sdcinc.planphoto-nettoyage')

let mainWindow

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  const hasIcon  = fs.existsSync(iconPath)

  mainWindow = new BrowserWindow({
    width:    1440,
    height:   900,
    minWidth: 1100,
    minHeight: 680,
    ...(hasIcon ? { icon: iconPath } : {}),
    title: 'PlanPhoto Nettoyage',
    backgroundColor: '#0a1f4e',
    show: false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      webSecurity:      true,
    },
  })

  // Charger l'app depuis les fichiers compilés
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Masquer la barre de menu
  mainWindow.removeMenu()

  // Afficher une fois prêt (évite l'écran blanc au démarrage)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
  })

  // Ouvrir les liens externes dans le navigateur système
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
