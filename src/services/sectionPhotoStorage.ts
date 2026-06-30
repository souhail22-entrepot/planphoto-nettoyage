import { openDB } from 'idb'

const DB_NAME = 'nettoyage-photos'
const STORE_NAME = 'section-photos'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

export async function savePhoto(photoId: string, dataUrl: string): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, dataUrl, photoId)
}

export async function getPhoto(photoId: string): Promise<string | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, photoId)
}

export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, photoId)
}

export async function getPhotos(photoIds: string[]): Promise<Record<string, string>> {
  const db = await getDb()
  const result: Record<string, string> = {}
  await Promise.all(
    photoIds.map(async (id) => {
      const data = await db.get(STORE_NAME, id)
      if (data) result[id] = data
    })
  )
  return result
}
