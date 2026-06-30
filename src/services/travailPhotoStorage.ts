import { openDB } from 'idb'
import { getActiveSaveDir, writePhotoFileToDisk, deletePhotoFileToDisk } from './fileSystemSave'

const DB_NAME   = 'nettoyage-photos'
const STORE_NAME = 'travail-photos'

async function getDb() {
  // Doit être synchronisé avec interventionPhotoStorage.ts (même DB, même version max)
  return openDB(DB_NAME, 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('section-photos'))    db.createObjectStore('section-photos')
      if (!db.objectStoreNames.contains('travail-photos'))    db.createObjectStore('travail-photos')
      if (!db.objectStoreNames.contains('intervention-photos')) db.createObjectStore('intervention-photos')
    },
  })
}

// Clé : `${projectId}_${ref}` (ex. "proj-123_P001")
// systemeSlug optionnel : nom du système sanitizé → photos/systemes/{slug}/{ref}.jpg
// sinon                                            → photos/travaux/{ref}.jpg
export async function saveTravailPhoto(key: string, dataUrl: string, systemeSlug?: string): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, dataUrl, key)
  const saveDir = getActiveSaveDir()
  if (saveDir) {
    const i = key.lastIndexOf('_')
    if (i !== -1) {
      const projectId = key.slice(0, i)
      const ref       = key.slice(i + 1)
      const subPath   = systemeSlug ? `systemes/${systemeSlug}/${ref}` : `travaux/${ref}`
      writePhotoFileToDisk(saveDir, projectId, subPath, dataUrl)
        .catch((e) => console.error('[FS] Erreur écriture photo travail', key, e))
    }
  }
}

export async function getTravailPhoto(key: string): Promise<string | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, key)
}

export async function deleteTravailPhoto(key: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, key)
  const saveDir = getActiveSaveDir()
  if (saveDir) {
    const i = key.lastIndexOf('_')
    if (i !== -1) {
      deletePhotoFileToDisk(saveDir, key.slice(0, i), key.slice(i + 1))
        .catch((e) => console.error('[FS] Erreur suppression photo travail', key, e))
    }
  }
}

// Récupère toutes les photos d'un projet (préfixe `${projectId}_`)
export async function getProjectTravailPhotos(projectId: string): Promise<Record<string, string>> {
  const db = await getDb()
  const result: Record<string, string> = {}
  const tx = db.transaction(STORE_NAME, 'readonly')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    const key = cursor.key as string
    if (key.startsWith(`${projectId}_`)) {
      result[key] = cursor.value as string
    }
    cursor = await cursor.continue()
  }
  return result
}

export async function saveTravailPhotos(map: Record<string, string>): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await Promise.all(Object.entries(map).map(([key, val]) => tx.store.put(val, key)))
  await tx.done
}

export async function deleteProjectTravailPhotos(projectId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if ((cursor.key as string).startsWith(`${projectId}_`)) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await tx.done
}
