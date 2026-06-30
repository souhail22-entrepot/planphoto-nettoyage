export type StatutIntervention = 'a_faire' | 'en_cours' | 'complete' | 'valide'

export const STATUTS_INTERVENTION: Record<StatutIntervention, { label: string; color: string; tw: string }> = {
  a_faire:  { label: 'À faire',  color: '#6B7280', tw: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  en_cours: { label: 'En cours', color: '#EAB308', tw: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  complete: { label: 'Complété', color: '#22C55E', tw: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  valide:   { label: 'Validé',   color: '#3B82F6', tw: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
}

/** Options visibles dans le dropdown (complete masqué — non utilisé pour l'instant) */
export const STATUTS_ACTIFS: StatutIntervention[] = ['a_faire', 'en_cours', 'valide']

export type RemplacementHotte = 'hotte' | 'filtres' | 'les_deux'

export const REMPLACEMENT_LABELS: Record<RemplacementHotte, string> = {
  hotte:    'Hotte seule',
  filtres:  'Filtres seuls',
  les_deux: 'Les deux',
}

export interface PhotoIntervention {
  id:        string
  ref:       string    // numéro séquentiel ex. "P001" — clé IndexedDB : `${projectId}_intv_${ref}`
  url:       string    // data URL en mémoire (non persisté dans localStorage)
  timestamp: string
}

export interface Intervention {
  id:                    string
  projectId:             string
  date:                  string                   // YYYY-MM-DD
  appartement:           string
  hotteStatut:           StatutIntervention | null
  sdbStatut:             StatutIntervention | null
  changementHotteStatut: StatutIntervention | null

  // Photos par composante × phase
  photosHotteAvant:      PhotoIntervention[]
  photosHotteApres:      PhotoIntervention[]
  photosSdbAvant:        PhotoIntervention[]
  photosSdbApres:        PhotoIntervention[]
  photosChgtHotteAvant:  PhotoIntervention[]
  photosChgtHotteApres:  PhotoIntervention[]

  // 2e avis
  dateDeuxiemeAvis:    string   // YYYY-MM-DD ou ''
  absentDeuxiemeAvis:  boolean

  // Remplacement hotte — ce qui a été remplacé (null = rien remplacé)
  replHotte30: RemplacementHotte | null   // hotte 30"
  replHotte24: RemplacementHotte | null   // hotte 24"

  notes:     string
  createdAt: string
  updatedAt: string
}

/** Champs photos — utile pour typer les accès dynamiques dans le store */
export type PhotoField =
  | 'photosHotteAvant' | 'photosHotteApres'
  | 'photosSdbAvant'   | 'photosSdbApres'
  | 'photosChgtHotteAvant' | 'photosChgtHotteApres'

export const EMPTY_PHOTOS: Record<PhotoField, PhotoIntervention[]> = {
  photosHotteAvant:    [],
  photosHotteApres:    [],
  photosSdbAvant:      [],
  photosSdbApres:      [],
  photosChgtHotteAvant: [],
  photosChgtHotteApres: [],
}
