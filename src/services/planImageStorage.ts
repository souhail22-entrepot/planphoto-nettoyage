import { openDB } from 'idb'

const DB_NAME   = 'nettoyage-images'
const STORE_NAME = 'plan-images'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

export async function savePlanImage(planId: string, dataUrl: string): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, dataUrl, planId)
}

export async function getPlanImage(planId: string): Promise<string | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, planId)
}

export async function deletePlanImage(planId: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, planId)
}

export async function getAllPlanImages(): Promise<Record<string, string>> {
  const db = await getDb()
  const result: Record<string, string> = {}
  const tx = db.transaction(STORE_NAME, 'readonly')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    result[cursor.key as string] = cursor.value as string
    cursor = await cursor.continue()
  }
  return result
}

export async function clearAllPlanImages(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_NAME)
}
