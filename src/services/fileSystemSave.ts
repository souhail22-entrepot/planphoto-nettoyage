// File System Access API — sauvegarde dans un dossier choisi par l'utilisateur
// Compatible Chrome/Edge. Fallback silencieux sur Firefox/Safari.

const FS_HANDLE_KEY = 'nettoyage_save_dir_handle'
const LOG = '[FS]'

let activeSaveDir: FileSystemDirectoryHandle | null = null

// Handle du dossier projet chargé via "Charger depuis dossier" — utilisé comme
// fallback pour lire les images de plans directement depuis le disque.
let loadedProjectDirHandle: { projectId: string; dir: FileSystemDirectoryHandle } | null = null

export function setLoadedProjectDirHandle(projectId: string, dir: FileSystemDirectoryHandle): void {
  loadedProjectDirHandle = { projectId, dir }
}

/** Lit l'image d'un plan directement depuis le dossier projet sur disque. */
export async function getPlanImageFromDisk(projectId: string, planId: string): Promise<string | null> {
  if (!loadedProjectDirHandle || loadedProjectDirHandle.projectId !== projectId) return null
  try {
    const photosDir = await loadedProjectDirHandle.dir.getDirectoryHandle('photos')
    const plansDir  = await photosDir.getDirectoryHandle('plans')
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const fh = await plansDir.getFileHandle(`plan_${planId}.${ext}`).catch(() => null)
      if (fh) return fileToDataUrl(await fh.getFile())
    }
  } catch (e) {
    console.warn(LOG, `getPlanImageFromDisk(${planId}):`, e)
  }
  return null
}

// ── API de base ───────────────────────────────────────────────────────────────

export function isFileSystemSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function setActiveSaveDir(handle: FileSystemDirectoryHandle | null) {
  activeSaveDir = handle
  console.info(LOG, handle ? `Dossier actif : ${handle.name}` : 'Dossier déconnecté')
}

export function getActiveSaveDir(): FileSystemDirectoryHandle | null {
  return activeSaveDir
}

// ── Nommage des dossiers ──────────────────────────────────────────────────────

/** Retire les accents, remplace les caractères spéciaux par des tirets. */
export function sanitizeFolderName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\-_.]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Construit le nom de dossier projet lisible : `{client}_{mandat}`.
 * Ex. : "Copropriete-Laval_M2024-001"
 */
export function buildProjectFolderName(project: {
  client?: string; name: string; mandat?: string
}): string {
  const base = sanitizeFolderName(project.client || project.name || 'projet')
  const sfx  = project.mandat ? `_${sanitizeFolderName(project.mandat)}` : ''
  return (`${base}${sfx}`).slice(0, 64) || 'projet'
}

// Cache projectId → nom de dossier (alimenté par registerProjectFolderName)
const projectFolderCache = new Map<string, string>()

export function registerProjectFolderName(projectId: string, folderName: string): void {
  projectFolderCache.set(projectId, folderName)
  console.info(LOG, `Dossier projet : "${folderName}" (id: ${projectId.slice(0, 8)}…)`)
}

function resolveFolder(projectId: string): string {
  return projectFolderCache.get(projectId) ?? projectId
}

// ── Sélection et restauration ─────────────────────────────────────────────────

export async function pickSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemSupported()) {
    console.warn(LOG, 'File System Access API non supportée')
    return null
  }
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
    console.info(LOG, `Dossier sélectionné : ${handle.name}`)
    await persistDirectoryHandle(handle)
    return handle
  } catch (e) {
    console.info(LOG, 'Sélection annulée', e)
    return null
  }
}

export async function restoreSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb()
    const handle: FileSystemDirectoryHandle | undefined = await db.get('handles', FS_HANDLE_KEY)
    if (!handle) return null
    const perm = await (handle as any).queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') {
      activeSaveDir = handle
      console.info(LOG, `Dossier restauré : ${handle.name}`)
      return handle
    }
    console.info(LOG, `Permission non accordée (statut : ${perm})`)
    return null
  } catch (e) {
    console.error(LOG, 'Erreur restauration dossier', e)
    return null
  }
}

export async function requestSaveDirPermission(): Promise<boolean> {
  if (!activeSaveDir) return false
  try {
    const perm = await (activeSaveDir as any).requestPermission({ mode: 'readwrite' })
    console.info(LOG, `Permission : ${perm}`)
    return perm === 'granted'
  } catch (e) {
    console.error(LOG, 'Erreur permission', e)
    return false
  }
}

// ── Structure disque ──────────────────────────────────────────────────────────
//
//   {dossier choisi}/
//     Projects/
//       {client}_{mandat}/            ← nom lisible (ex. "Copropriete-Laval_M2024-001")
//         project.json
//         project.tmp.json            ← temporaire, écriture atomique
//         photos/
//           systemes/
//             VA-1/                   ← travaux par système
//               P001.jpg
//               P002.jpg
//           interventions/
//             Apt-101/                ← interventions par appartement
//               intv_I1718640000.jpg
//           portes/                   ← photos de portes d'accès
//               P010.jpg
//           plans/                    ← images de fond de plan
//               plan_abc123.png

async function getProjectDir(
  dir: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectsDir = await dir.getDirectoryHandle('Projects', { create: true })
  return projectsDir.getDirectoryHandle(resolveFolder(projectId), { create: true })
}

async function getPhotosDir(
  dir: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectDir = await getProjectDir(dir, projectId)
  return projectDir.getDirectoryHandle('photos', { create: true })
}

// ── Backups ───────────────────────────────────────────────────────────────────

const MAX_BACKUPS = 20

/**
 * Sauvegarde project.json existant vers :
 *   - project.json.bak  (dernière version rapide)
 *   - backups/project_YYYY-MM-DDTHH-MM-SS.json  (historique horodaté)
 * Puis élimine les backups excédentaires (> MAX_BACKUPS).
 */
async function backupProjectJson(projectDir: FileSystemDirectoryHandle): Promise<void> {
  try {
    const fh = await projectDir.getFileHandle('project.json').catch(() => null)
    if (!fh) return
    const text = await (await fh.getFile()).text()
    if (!text.trim() || text.trim() === '{}') return

    // project.json.bak — écrasé à chaque save (accès rapide à la dernière version)
    const bakFh = await projectDir.getFileHandle('project.json.bak', { create: true })
    const bakW  = await bakFh.createWritable()
    await bakW.write(text)
    await bakW.close()

    // backups/project_YYYY-MM-DDTHH-MM-SS.json
    const ts         = new Date().toISOString().replace(/:/g, '-').slice(0, 19)
    const backupsDir = await projectDir.getDirectoryHandle('backups', { create: true })
    const tsFh       = await backupsDir.getFileHandle(`project_${ts}.json`, { create: true })
    const tsW        = await tsFh.createWritable()
    await tsW.write(text)
    await tsW.close()

    // Élagage : ne conserver que les MAX_BACKUPS plus récents
    const names: string[] = []
    for await (const entry of (backupsDir as any).values() as AsyncIterable<FileSystemHandle>) {
      if (entry.kind === 'file' && (entry as FileSystemFileHandle).name.endsWith('.json')) {
        names.push((entry as FileSystemFileHandle).name)
      }
    }
    names.sort() // ordre chronologique (noms ISO → tri lexicographique = tri temporel)
    const toDelete = names.slice(0, Math.max(0, names.length - MAX_BACKUPS))
    for (const name of toDelete) {
      await backupsDir.removeEntry(name).catch(() => {})
    }
    console.info(LOG, `Backup → backups/project_${ts}.json (${names.length - toDelete.length} conservés)`)
  } catch (e) {
    console.warn(LOG, 'Erreur backup project.json (non bloquant)', e)
  }
}

// ── project.json (écriture atomique) ─────────────────────────────────────────

export async function writeProjectJson(
  dir: FileSystemDirectoryHandle,
  projectId: string,
  data: unknown,
): Promise<boolean> {
  try {
    const projectDir = await getProjectDir(dir, projectId)

    // 0. Backup du fichier existant avant écrasement
    await backupProjectJson(projectDir)

    const json = JSON.stringify(data, null, 2)

    // 1. Écriture dans le fichier temporaire
    const tmpFh = await projectDir.getFileHandle('project.tmp.json', { create: true })
    const tmpW  = await tmpFh.createWritable()
    await tmpW.write(json)
    await tmpW.close()

    // 2. Seulement si le .tmp a réussi → écriture du vrai fichier
    const fh = await projectDir.getFileHandle('project.json', { create: true })
    const w  = await fh.createWritable()
    await w.write(json)
    await w.close()

    // 3. Nettoyage
    await projectDir.removeEntry('project.tmp.json').catch(() => {})

    console.info(LOG, `project.json → Projects/${resolveFolder(projectId)}/`)
    return true
  } catch (e) {
    console.error(LOG, `Erreur écriture project.json (${projectId})`, e)
    return false
  }
}

// ── Photos ────────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = (header.match(/:(.*?);/) ?? [])[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function photoExt(dataUrl: string): 'png' | 'jpg' {
  return dataUrl.startsWith('data:image/png') ? 'png' : 'jpg'
}

/**
 * Écrit une photo sur le disque.
 *
 * `subPath` est relatif à `photos/` et supporte les `/` pour créer des sous-dossiers :
 *   `"systemes/VA-1/P001"`              → photos/systemes/VA-1/P001.jpg
 *   `"interventions/Apt-101/intv_I123"` → photos/interventions/Apt-101/intv_I123.jpg
 *   `"portes/P010"`                     → photos/portes/P010.jpg
 *   `"plans/plan_abc"`                  → photos/plans/plan_abc.png
 */
export async function writePhotoFileToDisk(
  dir: FileSystemDirectoryHandle,
  projectId: string,
  subPath: string,
  dataUrl: string,
): Promise<void> {
  let current = await getPhotosDir(dir, projectId)

  const parts    = subPath.split('/')
  const filename = parts.pop()!  // dernier segment = nom du fichier

  for (const part of parts) {
    const safe = sanitizeFolderName(part) || part
    current = await current.getDirectoryHandle(safe, { create: true })
  }

  const ext      = photoExt(dataUrl)
  const fullName = `${filename}.${ext}`
  const fh       = await current.getFileHandle(fullName, { create: true })
  const w        = await fh.createWritable()
  await w.write(dataUrlToBlob(dataUrl))
  await w.close()
  console.info(LOG, `Photo → Projects/${resolveFolder(projectId)}/photos/${subPath}.${ext}`)
}

// ── Suppression (recherche dans tous les sous-dossiers) ───────────────────────

async function removeFileVariants(d: FileSystemDirectoryHandle, basename: string): Promise<void> {
  for (const ext of ['jpg', 'png']) {
    await d.removeEntry(`${basename}.${ext}`).catch(() => {})
  }
}

async function deleteInSubdirs(parent: FileSystemDirectoryHandle, basename: string): Promise<void> {
  try {
    for await (const entry of (parent as any).values() as AsyncIterable<FileSystemHandle>) {
      if (entry.kind === 'directory') {
        await removeFileVariants(entry as FileSystemDirectoryHandle, basename)
      }
    }
  } catch { /* répertoire non itérable */ }
}

/**
 * Supprime une photo.
 * Cherche dans la racine `photos/` puis dans tous les sous-dossiers thématiques.
 */
export async function deletePhotoFileToDisk(
  dir: FileSystemDirectoryHandle,
  projectId: string,
  filename: string,
): Promise<void> {
  try {
    const photosDir = await getPhotosDir(dir, projectId)

    // Plat (ancienne structure)
    await removeFileVariants(photosDir, filename)

    // Sous-dossiers thématiques
    for (const group of ['systemes', 'interventions', 'portes', 'plans']) {
      const groupDir = await photosDir.getDirectoryHandle(group).catch(() => null)
      if (groupDir) await deleteInSubdirs(groupDir, filename)
    }

    console.info(LOG, `Photo supprimée : ${filename} (${resolveFolder(projectId)})`)
  } catch (e) {
    console.error(LOG, `Erreur suppression photo ${filename}`, e)
  }
}

// ── Enregistrer sous (téléchargement) ────────────────────────────────────────

export async function saveProjectAs(projectName: string, data: unknown): Promise<boolean> {
  const safeName = projectName.replace(/[^a-z0-9\-_\s]/gi, '_').trim() || 'projet'
  const date     = new Date().toISOString().slice(0, 10)

  if (isFileSystemSupported() && 'showSaveFilePicker' in window) {
    try {
      const fh = await (window as any).showSaveFilePicker({
        suggestedName: `${safeName}_${date}.json`,
        types: [{ description: 'Projet nettoyage', accept: { 'application/json': ['.json'] } }],
      })
      const w = await fh.createWritable()
      await w.write(JSON.stringify(data, null, 2))
      await w.close()
      return true
    } catch {
      return false
    }
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${safeName}_${date}.json`; a.click()
  URL.revokeObjectURL(url)
  return true
}

// ── Chargement depuis un dossier projet ──────────────────────────────────────

/**
 * Lit project.json depuis un dossier projet sélectionné par l'utilisateur.
 * Retourne les données parsées ou null si le fichier est absent/invalide.
 */
export async function readProjectJsonFromFolder(
  projectDir: FileSystemDirectoryHandle,
): Promise<unknown | null> {
  try {
    const fh   = await projectDir.getFileHandle('project.json').catch(() => null)
    if (!fh) return null
    const text = await (await fh.getFile()).text()
    return JSON.parse(text)
  } catch (e) {
    console.error(LOG, 'Erreur lecture project.json', e)
    return null
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// Itère les entrées d'un FileSystemDirectoryHandle de façon explicite et fiable
async function* iterEntries(dir: FileSystemDirectoryHandle): AsyncGenerator<[string, FileSystemHandle]> {
  // Méthode 1 : entries() — Chrome/Edge standard
  if (typeof (dir as any).entries === 'function') {
    yield* (dir as any).entries()
    return
  }
  // Méthode 2 : values() comme fallback
  if (typeof (dir as any).values === 'function') {
    for await (const handle of (dir as any).values() as AsyncIterable<FileSystemHandle>) {
      yield [handle.name, handle]
    }
  }
}

async function restorePlanPhotos(
  photosDir: FileSystemDirectoryHandle,
  counts: { plan: number },
): Promise<void> {
  const plansDir = await photosDir.getDirectoryHandle('plans').catch(() => null)
  if (!plansDir) { console.warn(LOG, "Pas de dossier plans/ trouvé"); return }
  const { savePlanImage } = await import('./planImageStorage')
  for await (const [name, handle] of iterEntries(plansDir)) {
    if (handle.kind !== 'file') continue
    if (!/\.(jpg|jpeg|png|webp)$/i.test(name)) continue
    try {
      const file   = await (handle as FileSystemFileHandle).getFile()
      const url    = await fileToDataUrl(file)
      const ref    = name.replace(/\.(jpg|jpeg|png|webp)$/i, '')
      const planId = ref.startsWith('plan_') ? ref.slice(5) : ref
      await savePlanImage(planId, url)
      counts.plan++
      console.info(LOG, `Plan restauré: ${planId} (${Math.round(file.size / 1024)} Ko)`)
    } catch (e) {
      console.warn(LOG, `Erreur restauration plan ${name}:`, e)
    }
  }
}

async function restoreInterventionPhotos(
  photosDir: FileSystemDirectoryHandle,
  projectId: string,
  counts: { intervention: number },
): Promise<void> {
  const intvsDir = await photosDir.getDirectoryHandle('interventions').catch(() => null)
  if (!intvsDir) return
  const { saveInterventionPhoto } = await import('./interventionPhotoStorage')
  for await (const [, aptHandle] of iterEntries(intvsDir)) {
    if (aptHandle.kind !== 'directory') continue
    for await (const [name, fileHandle] of iterEntries(aptHandle as FileSystemDirectoryHandle)) {
      if (fileHandle.kind !== 'file') continue
      if (!/\.(jpg|jpeg|png|webp)$/i.test(name)) continue
      try {
        const file     = await (fileHandle as FileSystemFileHandle).getFile()
        const url      = await fileToDataUrl(file)
        const ref      = name.replace(/\.(jpg|jpeg|png|webp)$/i, '')
        const cleanRef = ref.startsWith('intv_') ? ref.slice(5) : ref
        await saveInterventionPhoto(`${projectId}_intv_${cleanRef}`, url)
        counts.intervention++
      } catch (e) {
        console.warn(LOG, `Erreur restauration intervention ${name}:`, e)
      }
    }
  }
}

async function restoreTravailPhotoDir(
  photosDir: FileSystemDirectoryHandle,
  subDirName: string,
  projectId: string,
  counts: { travail: number },
): Promise<void> {
  const dir = await photosDir.getDirectoryHandle(subDirName).catch(() => null)
  if (!dir) return
  const { saveTravailPhoto } = await import('./travailPhotoStorage')

  async function scanDir(d: FileSystemDirectoryHandle): Promise<void> {
    for await (const [name, handle] of iterEntries(d)) {
      if (handle.kind === 'directory') {
        await scanDir(handle as FileSystemDirectoryHandle)
      } else if (handle.kind === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(name)) {
        try {
          const file = await (handle as FileSystemFileHandle).getFile()
          const url  = await fileToDataUrl(file)
          const ref  = name.replace(/\.(jpg|jpeg|png|webp)$/i, '')
          await saveTravailPhoto(`${projectId}_${ref}`, url)
          counts.travail++
        } catch (e) {
          console.warn(LOG, `Erreur restauration travail ${name}:`, e)
        }
      }
    }
  }
  await scanDir(dir)
}

/**
 * Restaure toutes les photos d'un dossier projet dans IndexedDB.
 * Appeler restoreTravailPhotos() / restoreInterventionPhotos() / restorePlanImages()
 * du store ensuite pour mettre à jour l'état React.
 */
export async function restorePhotosFromFolder(
  projectDir: FileSystemDirectoryHandle,
  projectId: string,
): Promise<{ travail: number; intervention: number; plan: number }> {
  const counts = { travail: 0, intervention: 0, plan: 0 }
  try {
    const photosDir = await projectDir.getDirectoryHandle('photos').catch(() => null)
    if (!photosDir) { console.warn(LOG, 'Pas de dossier photos/ dans le projet'); return counts }

    await restorePlanPhotos(photosDir, counts)
    await restoreInterventionPhotos(photosDir, projectId, counts)
    for (const sub of ['systemes', 'travaux', 'portes']) {
      await restoreTravailPhotoDir(photosDir, sub, projectId, counts)
    }
    console.info(LOG, `Restauration terminée — travaux: ${counts.travail}, interventions: ${counts.intervention}, plans: ${counts.plan}`)
  } catch (e) {
    console.warn(LOG, 'Erreur restauration photos depuis dossier', e)
  }
  return counts
}

/** @deprecated — utiliser writeProjectJson(dir, projectId, data) */
export async function writeProjectFile(
  dir: FileSystemDirectoryHandle,
  projectNameOrId: string,
  data: unknown,
): Promise<boolean> {
  return writeProjectJson(dir, projectNameOrId, data)
}

// ── IndexedDB pour la persistance du handle ───────────────────────────────────

async function openHandleDb() {
  const { openDB } = await import('idb')
  return openDB('nettoyage-fs-handles', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
    },
  })
}

async function persistDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDb()
    await db.put('handles', handle, FS_HANDLE_KEY)
    console.info(LOG, 'Handle persisté dans IndexedDB')
  } catch (e) {
    console.warn(LOG, 'Impossible de persister le handle', e)
  }
}
