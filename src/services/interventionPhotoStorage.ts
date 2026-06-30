import { openDB } from 'idb'
import { getActiveSaveDir, writePhotoFileToDisk, deletePhotoFileToDisk } from './fileSystemSave'

// Même DB que les photos de travaux, nouveau store ajouté en v3
const DB_NAME    = 'nettoyage-photos'
const STORE_NAME = 'intervention-photos'

async function getDb() {
  return openDB(DB_NAME, 3, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('section-photos'))    db.createObjectStore('section-photos')
      if (!db.objectStoreNames.contains('travail-photos'))    db.createObjectStore('travail-photos')
      if (!db.objectStoreNames.contains(STORE_NAME))          db.createObjectStore(STORE_NAME)
    },
  })
}

// Clé : `${projectId}_intv_${ref}`
// appartement optionnel → photos/interventions/{apt}/intv_{ref}.jpg
// sinon                 → photos/interventions/intv_{ref}.jpg
export async function saveInterventionPhoto(key: string, dataUrl: string, appartement?: string): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, dataUrl, key)
  const saveDir = getActiveSaveDir()
  if (saveDir) {
    const idx = key.indexOf('_intv_')
    if (idx !== -1) {
      const projectId = key.slice(0, idx)
      const ref       = key.slice(idx + 6)
      const subPath   = appartement
        ? `interventions/${appartement}/intv_${ref}`
        : `interventions/intv_${ref}`
      writePhotoFileToDisk(saveDir, projectId, subPath, dataUrl)
        .catch((e) => console.error('[FS] Erreur écriture photo intervention', key, e))
    }
  }
}

export async function deleteInterventionPhoto(key: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, key)
  const saveDir = getActiveSaveDir()
  if (saveDir) {
    const idx = key.indexOf('_intv_')
    if (idx !== -1) {
      const projectId = key.slice(0, idx)
      const ref       = key.slice(idx + 6)
      deletePhotoFileToDisk(saveDir, projectId, `intv_${ref}`)
        .catch((e) => console.error('[FS] Erreur suppression photo intervention', key, e))
    }
  }
}

export async function getProjectInterventionPhotos(projectId: string): Promise<Record<string, string>> {
  const db = await getDb()
  const result: Record<string, string> = {}
  const tx = db.transaction(STORE_NAME, 'readonly')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    const key = cursor.key as string
    if (key.startsWith(`${projectId}_intv_`)) result[key] = cursor.value as string
    cursor = await cursor.continue()
  }
  return result
}

export async function deleteProjectInterventionPhotos(projectId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if ((cursor.key as string).startsWith(`${projectId}_intv_`)) await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
