// PlanPhoto Nettoyage — modèle de données
// Compatible avec PlanPhoto Inspection (planphoto-pro-source)

// ── Composantes CVAC (vocabulaire commun avec l'inspection) ──────────────────

export type TypeComposanteCVAC =
  | 'conduit_alimentation_principal'
  | 'conduit_alimentation_secondaire'
  | 'conduit_retour'
  | 'conduit_air_frais'
  | 'conduit_air_vicie'
  | 'conduit_evacuation'
  | 'grille_diffuseur'
  | 'plenum'
  | 'transfert'
  | 'ventilateur_transfert'
  | 'unite'
  | 'compartiment_ventilateur'
  | 'compartiment_filtres'
  | 'compartiment_melange'
  | 'compartiment_serpentins'
  | 'plenum_air_frais'
  | 'plenum_air_vicie'
  | 'hotte_cuisine'
  | 'extracteur_sdb'

export const COMPOSANTES_CVAC: Record<TypeComposanteCVAC, { label: string; categorie: 'conduit' | 'equipement' | 'accessoire' }> = {
  conduit_alimentation_principal:  { label: 'Conduit Alimentation Principal',  categorie: 'conduit'     },
  conduit_alimentation_secondaire: { label: 'Conduit Alimentation Secondaire', categorie: 'conduit'     },
  conduit_retour:                  { label: 'Conduit de Retour',               categorie: 'conduit'     },
  conduit_air_frais:               { label: "Conduit d'Air Frais",             categorie: 'conduit'     },
  conduit_air_vicie:               { label: "Conduit d'Air Vicié",             categorie: 'conduit'     },
  conduit_evacuation:              { label: "Conduit d'Évacuation",            categorie: 'conduit'     },
  grille_diffuseur:                { label: 'Grille ou Diffuseur',             categorie: 'accessoire'  },
  plenum:                          { label: 'Plenum',                          categorie: 'equipement'  },
  transfert:                       { label: 'Transfert',                       categorie: 'conduit'     },
  ventilateur_transfert:           { label: 'Ventilateur de Transfert',        categorie: 'equipement'  },
  unite:                           { label: 'Unité',                           categorie: 'equipement'  },
  compartiment_ventilateur:        { label: 'Compartiment Ventilateur',        categorie: 'equipement'  },
  compartiment_filtres:            { label: 'Compartiment Filtres',            categorie: 'equipement'  },
  compartiment_melange:            { label: 'Compartiment de Mélange',         categorie: 'equipement'  },
  compartiment_serpentins:         { label: 'Compartiment Serpentins',         categorie: 'equipement'  },
  plenum_air_frais:                { label: 'Plénum Air Frais',                categorie: 'equipement'  },
  plenum_air_vicie:                { label: 'Plénum Air Vicié',                categorie: 'equipement'  },
  hotte_cuisine:                   { label: 'Hotte de Cuisine',                categorie: 'equipement'  },
  extracteur_sdb:                  { label: 'Extracteur SDB',                  categorie: 'equipement'  },
}

// ── Couleurs par groupe de composante ─────────────────────────────────────────

export type GroupeComposante = 'alimentation' | 'retour' | 'evacuation' | 'autre'

export const COMPOSANTE_GROUPE: Record<TypeComposanteCVAC, GroupeComposante> = {
  conduit_alimentation_principal:  'alimentation',
  conduit_alimentation_secondaire: 'alimentation',
  conduit_air_frais:               'alimentation',
  plenum_air_frais:                'alimentation',
  grille_diffuseur:                'alimentation',
  conduit_retour:                  'retour',
  transfert:                       'retour',
  ventilateur_transfert:           'retour',
  conduit_evacuation:              'evacuation',
  conduit_air_vicie:               'evacuation',
  plenum_air_vicie:                'evacuation',
  plenum:                          'autre',
  unite:                           'autre',
  compartiment_ventilateur:        'autre',
  compartiment_filtres:            'autre',
  compartiment_melange:            'autre',
  compartiment_serpentins:         'autre',
  hotte_cuisine:                   'autre',
  extracteur_sdb:                  'autre',
}

export const GROUPE_COLOR: Record<GroupeComposante, string> = {
  alimentation: '#2563EB',  // bleu
  retour:       '#059669',  // vert
  evacuation:   '#DC2626',  // rouge
  autre:        '#64748B',  // gris ardoise
}

export const GROUPE_RGB: Record<GroupeComposante, [number, number, number]> = {
  alimentation: [37,  99, 235],
  retour:       [5,  150, 105],
  evacuation:   [220, 38,  38],
  autre:        [100, 116, 139],
}

export function composanteColor(typeComposante: string | undefined): string {
  if (!typeComposante) return GROUPE_COLOR.autre
  const groupe = COMPOSANTE_GROUPE[typeComposante as TypeComposanteCVAC] ?? 'autre'
  return GROUPE_COLOR[groupe]
}

export function composanteRGB(typeComposante: string | undefined): [number, number, number] {
  if (!typeComposante) return GROUPE_RGB.autre
  const groupe = COMPOSANTE_GROUPE[typeComposante as TypeComposanteCVAC] ?? 'autre'
  return GROUPE_RGB[groupe]
}

// ── Niveaux de salubrité IRSST (commun avec l'inspection) ───────────────────

export type NiveauSalubrite = 1 | 2 | 3 | 4

export const NIVEAU_SALUBRITE_INFO: Record<NiveauSalubrite, { label: string; color: string; textColor: string }> = {
  1: { label: 'N1 — Très propre',  color: '#3B82F6', textColor: '#fff' },
  2: { label: 'N2 — Film mince',   color: '#FACC15', textColor: '#1e293b' },
  3: { label: 'N3 — Sale',         color: '#F97316', textColor: '#fff' },
  4: { label: 'N4 — Très sale',    color: '#EF4444', textColor: '#fff' },
}

// ── Portes d'accès (compatible inspection) ────────────────────────────────────

export type AccessDoorType = 'acces' | 'architectural' | 'plaque'

export const ACCESS_DOOR_TYPE_LABELS: Record<AccessDoorType, string> = {
  acces:         "Porte d'accès conduit",
  architectural: 'Porte architecturale',
  plaque:        'Plaque',
}

export type StatutPorte = 'existante' | 'ajoutee' | 'requise'

export const STATUT_PORTE: Record<StatutPorte, { label: string; color: string; rgb: [number,number,number] }> = {
  existante: { label: 'Existante',    color: '#10B981', rgb: [16,  185, 129] },
  ajoutee:   { label: 'Nouvellement installée', color: '#3B82F6', rgb: [59,  130, 246] },
  requise:   { label: 'Requise',      color: '#F97316', rgb: [249, 115,  22] },
}

export interface PlanAccessDoor {
  id:         string
  x:          number
  y:          number
  arrowEndX?: number
  arrowEndY?: number
  numero:     string
  type:       AccessDoorType
  dimensions: string
  statut:     StatutPorte
  doorSize?:  'small' | 'medium' | 'large'
  remarques?: string
  photosPorte?: Photo[]
  systemeId?: string
}

// ── Méthodes de nettoyage ────────────────────────────────────────────────────

export type MethodeNettoyage =
  | 'mecanique'
  | 'air_comprime'
  | 'aspiration'
  | 'brossage'
  | 'chimique'
  | 'mixte'

export const METHODES_NETTOYAGE: Record<MethodeNettoyage, string> = {
  mecanique:    'Mécanique (contact)',
  air_comprime: 'Air comprimé',
  aspiration:   'Aspiration HEPA',
  brossage:     'Brossage rotatif',
  chimique:     'Chimique',
  mixte:        'Mixte',
}

// ── Statuts de travail ───────────────────────────────────────────────────────

export type StatutTravail = 'a_faire' | 'en_cours' | 'complete' | 'valide'

export const STATUT_TRAVAIL: Record<StatutTravail, { label: string; color: string }> = {
  a_faire:  { label: 'À faire',   color: '#6B7280' },
  en_cours: { label: 'En cours',  color: '#F59E0B' },
  complete: { label: 'Complété',  color: '#10B981' },
  valide:   { label: 'Validé',    color: '#3B82F6' },
}

// ── Annotations (7 types — identiques à l'inspection) ───────────────────────

export type AnnotationType = 'text' | 'note' | 'arrow' | 'rectangle' | 'circle' | 'freehand' | 'measure'
export type AnnotationColor = 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white'

export const ANNOTATION_COLORS: Record<AnnotationColor, string> = {
  red:    '#EF4444',
  blue:   '#3B82F6',
  green:  '#10B981',
  yellow: '#F59E0B',
  black:  '#000000',
  white:  '#FFFFFF',
}

interface BaseAnnotation {
  id: string
  type: AnnotationType
  planId: string
  color: AnnotationColor
  strokeWidth: number
  createdAt: string
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number; y: number; text: string; fontSize: number
  bold?: boolean; italic?: boolean; underline?: boolean
  fontFamily?: string; align?: 'left' | 'center' | 'right'
  rotation?: number; bgColor?: string; opacity?: number
  width?: number; height?: number
}
export interface NoteAnnotation extends BaseAnnotation {
  type: 'note'
  x: number; y: number; text: string; width: number; height: number
  arrowEndX?: number; arrowEndY?: number; fontSize?: number
}
export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow'; points: number[]
}
export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle'; x: number; y: number; width: number; height: number; fill?: string
}
export interface CircleAnnotation extends BaseAnnotation {
  type: 'circle'; x: number; y: number; radius: number; fill?: string
}
export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand'; points: number[]
}
export interface MeasureAnnotation extends BaseAnnotation {
  type: 'measure'; points: number[]; distance: number; unit: 'm' | 'cm' | 'ft'
}

export type Annotation =
  | TextAnnotation | NoteAnnotation | ArrowAnnotation | RectangleAnnotation
  | CircleAnnotation | FreehandAnnotation | MeasureAnnotation

// ── Photo (compatible inspection) ────────────────────────────────────────────

export interface Photo {
  id: string
  ref: string         // P001, P002… (séquentiel au niveau du projet)
  url: string
  timestamp: string   // ISO
  note?: string
  starred?: boolean   // inclus dans le rapport PDF
}

// ── Signature (compatible inspection) ────────────────────────────────────────

export interface Signature {
  id: string
  type: 'client' | 'technicien'
  name: string
  dataUrl: string
  timestamp: string
}

// ── Système CVAC — dynamique, créé par l'utilisateur ────────────────────────
// Jamais codé en dur. L'utilisateur crée ses propres systèmes (VA-1, EV-1, AHU-1…)

export interface Systeme {
  id: string
  nom: string              // entièrement libre : VA-1, EV-1, AHU-1, Cuisine, etc.
  description?: string
  type?: string            // ex. ventilation, extraction, climatisation…
  localisation?: string    // ex. sous-sol, toit, salle mécanique 3e étage…
  zonesDesservies?: string // ex. bureaux 2e-4e, cuisine, stationnement…
}

// ── Anomalie de nettoyage ────────────────────────────────────────────────────

export type TypeAnomalie =
  | 'corrosion'
  | 'moisissure'
  | 'fuite'
  | 'deformation'
  | 'obstruction'
  | 'autre'

export const ANOMALIE_LABELS: Record<TypeAnomalie, string> = {
  corrosion:   'Corrosion',
  moisissure:  'Moisissure',
  fuite:       'Fuite d\'air',
  deformation: 'Déformation',
  obstruction: 'Obstruction',
  autre:       'Autre',
}

export interface AnomalieNettoyage {
  id: string
  type: TypeAnomalie
  description: string
  photos: Photo[]
}

// ── Travail de nettoyage — entité principale ─────────────────────────────────

export interface TravailNettoyage {
  id: string
  numero: number
  planId: string
  projectId?: string            // référence directe au projet (indispensable pour travaux sans plan)
  systemeId: string             // référence à Systeme (jamais de nom en dur ici)

  // Lien optionnel vers l'épingle d'inspection source
  inspectionPinId?: string

  // Position sur le canvas (compatible inspection Pin)
  x: number
  y: number
  arrowEndX: number
  arrowEndY: number
  arrowExitSide?: 'left' | 'right' | 'top' | 'bottom'  // côté de sortie de la ligne, sinon auto
  pinSize?: 'xsmall' | 'small' | 'medium' | 'large'

  // Composante CVAC (vocabulaire partagé avec l'inspection)
  typeComposante?: TypeComposanteCVAC
  location?: string
  zoneDesservie?: string

  // Salubrité IRSST — avant et après nettoyage
  niveauSalubriteInitial?: NiveauSalubrite
  niveauSalubriteFinal?: NiveauSalubrite

  // Statut du travail
  statut: StatutTravail

  // Données de nettoyage
  methode?: MethodeNettoyage
  technicien?: string
  dateDebut?: string
  dateFin?: string
  dureeHeures?: number

  // Caractéristiques physiques
  diametre?: string
  materiau?: string
  longueur?: string
  epaisseurDepot?: string

  // Observations
  observationsAvant?: string
  observationsApres?: string

  // Anomalies détectées
  anomalies: AnomalieNettoyage[]

  // Photos structurées par phase
  photosAvant:    Photo[]
  photosPendant:  Photo[]
  photosApres:    Photo[]

  // Portes d'accès utilisées (IDs de PlanAccessDoor) — travaux sur plan
  portesUtilisees: string[]

  // Ouvertures de service installées (choix libre par type+dimensions) — travaux sans plan
  portesInstalleesLibres?: { type: AccessDoorType; dimensions: string; statut?: 'existante' | 'ajoutee' }[]

  // Rapport PDF — si false, la fiche de ce travail est exclue du rapport
  includeInReport?: boolean

  createdAt: string
  updatedAt: string
}

// ── Zone de conduit (hachure de zone sur le plan) ────────────────────────────

export interface ZoneConduit {
  id: string
  planId: string
  typeComposante?: string
  points: number[]     // tableau plat [x1, y1, x2, y2, ...]
  opacity: number      // 0–1, par défaut 0.35
}

// ── Plan (compatible inspection) ─────────────────────────────────────────────

export interface Plan {
  id: string
  projectId: string
  name: string
  type: 'pdf' | 'image'
  width: number
  height: number
  url?: string              // image rehydratée depuis IndexedDB (non persistée dans localStorage)
  pageNumber?: number
  totalPages?: number
  drawingNumber?: string
  rotation?: 0 | 90 | 180 | 270
  accessDoors?: PlanAccessDoor[]
  createdAt: string
}

// ── Projet ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  client: string
  adresse: string
  ville?: string
  codePostal?: string
  contact?: string
  telephone?: string
  description?: string
  technicien?: string
  technicienTitre?: string
  verificateur?: string
  verificateurTitre?: string
  dateDebut?: string
  dateFin?: string
  contrat?: string
  adresseClient?: string
  preparePar?: string
  prepareParTitre?: string
  mandat?: string
  referenceClient?: string
  titreRapport?: string
  documentsConnexes?: string
  bonCommande?: string
  emisPour?: string
  numeroRapport?: string
  versionRapport?: string
  logo?: string
  logoClient?: string
  standards?: string[]

  // Informations bâtiment
  nomImmeuble?:       string
  typeBatiment?:      string
  nbEtages?:          string
  nbLogements?:       string
  nbAppartements?:    string
  zonesSpecifiques?:  string
  anneeConstruction?: string

  // Systèmes CVAC — entièrement dynamiques, créés par l'utilisateur
  systemes: Systeme[]

  // Signatures
  signatures: Signature[]

  // Rapport écrit
  reportSections?: ReportSection[]
  reportGabaritType?: 'data-driven' | 'nadca-static' | 'omhm-static'

  // Lien vers le projet d'inspection source (compatibilité future)
  inspectionProjectId?: string

  // Compteur de références photo (P001, P002…)
  nextPhotoRef: number

  createdAt: string
  updatedAt: string
}

// ── Historique des actions ────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string
  action: 'create' | 'update' | 'delete' | 'import' | 'validate'
  entity: 'projet' | 'plan' | 'travail' | 'systeme' | 'porte' | 'annotation'
  entityId: string
  user: string
  timestamp: string
  description: string
}

// ── Sections de rapport (compatible inspection) ───────────────────────────────

export type ReportSectionType = 'text' | 'equipment_list' | 'observations' | 'subtitle'
export type ObservationSeverity = 'info' | 'attention' | 'critique'

export interface TextReportSection {
  id: string; type: 'text'; title: string; content: string
}
export interface EquipmentItem {
  id: string; systeme: string; composante: string; zone: string; etat: string; observations: string
}
export interface EquipmentListReportSection {
  id: string; type: 'equipment_list'; title: string; items: EquipmentItem[]
}
export interface ObservationItem {
  id: string; text: string; photos: string[]; severity: ObservationSeverity
  ref?: string   // ex. "T-03" — référence à l'épingle sur le plan
}
export interface ObservationsReportSection {
  id: string; type: 'observations'; title: string; items: ObservationItem[]
}
export interface SubtitleReportSection {
  id: string; type: 'subtitle'; title: string
}

export type ReportSection =
  | TextReportSection
  | EquipmentListReportSection
  | ObservationsReportSection
  | SubtitleReportSection

// ── Mesures de débit d'air ────────────────────────────────────────────────────

export type TypePointDebit = 'diffuseur' | 'reprise' | 'extraction'

export const TYPE_POINT_DEBIT: Record<TypePointDebit, { label: string; color: string; abbr: string }> = {
  diffuseur:  { label: 'Diffuseur (soufflage)', color: '#2563EB', abbr: 'D' },
  reprise:    { label: 'Grille de reprise',     color: '#059669', abbr: 'R' },
  extraction: { label: "Grille d'extraction",   color: '#DC2626', abbr: 'G' },
}

export type UniteDebit = 'CFM' | 'L/s'

export type MethodeMesure = 'anemometre' | 'cone' | 'pitot' | 'debitmetre'

export const METHODE_MESURE_LABELS: Record<MethodeMesure, string> = {
  anemometre: 'Anémomètre',
  cone:       'Cône / hotte',
  pitot:      'Tube de Pitot',
  debitmetre: 'Débitmètre',
}

export interface PointDebit {
  id: string
  planDebitId: string
  projectId: string
  identifiant: string
  type: TypePointDebit
  local: string
  systemeId?: string
  x: number          // % relatif au plan (0-100)
  y: number          // % relatif au plan (0-100)
  debitAvant?: number
  debitApres?: number
  dateAvant?: string       // ISO date de la mesure avant
  dateApres?: string       // ISO date de la mesure après
  conditions?: string      // ex: filtre neuf, vitesse ventilateur 100%
  methode?: MethodeMesure  // instrument utilisé
  unite: UniteDebit
  observations?: string
  createdAt: string
  updatedAt: string
}

export interface PlanDebit {
  id: string
  projectId: string
  name: string
  width: number
  height: number
  url?: string       // non persisté dans localStorage, rechargé depuis IndexedDB
  createdAt: string
}

// ── Import depuis l'application d'inspection ──────────────────────────────────

export interface InspectionExport {
  project: any
  plans: any[]
  pins: any[]
  annotations: any[]
  history?: any[]
  exportedAt: string
}
