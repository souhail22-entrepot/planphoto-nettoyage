import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  Project, Plan, TravailNettoyage, Systeme, StatutTravail,
  Photo, Signature, PlanAccessDoor, Annotation, HistoryEntry,
  ReportSection, ReportSectionType, EquipmentItem, ObservationItem,
  InspectionExport, AnomalieNettoyage, ZoneConduit,
} from '@/types'
import type { Intervention, PhotoIntervention } from '@/types/interventions'
import { savePlanImage, deletePlanImage, getAllPlanImages } from '@/services/planImageStorage'
import { saveTravailPhotos, getProjectTravailPhotos } from '@/services/travailPhotoStorage'
import {
  deleteInterventionPhoto,
  getProjectInterventionPhotos,
  deleteProjectInterventionPhotos,
} from '@/services/interventionPhotoStorage'

type Tool = 'select' | 'pan' | 'pin' | 'porte' | 'zone' | 'text' | 'note' | 'arrow' | 'rectangle' | 'circle' | 'freehand' | 'measure'

// ── Renumérotation par système (alphabétique) puis par date de création ───────
function orderGroup(group: TravailNettoyage[], sysOrder: string[]): TravailNettoyage[] {
  const bySystem: Record<string, TravailNettoyage[]> = {}
  for (const t of group) {
    if (!bySystem[t.systemeId]) bySystem[t.systemeId] = []
    bySystem[t.systemeId].push(t)
  }
  const result: TravailNettoyage[] = []
  for (const sysId of sysOrder) {
    if (bySystem[sysId]) result.push(...bySystem[sysId].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }
  for (const sysId of Object.keys(bySystem)) {
    if (!sysOrder.includes(sysId)) result.push(...bySystem[sysId].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }
  return result
}

function recomputeNumbers(travaux: TravailNettoyage[], systemes: Systeme[]): TravailNettoyage[] {
  const sysOrder   = systemes.map((s) => s.id)
  // 1. Travaux sur plan (épingles) en premier
  const avecPlan   = travaux.filter((t) => !!t.planId)
  // 2. Travaux sans plan en dernier
  const sansPlan   = travaux.filter((t) => !t.planId)

  const ordered = [
    ...orderGroup(avecPlan,  sysOrder),
    ...orderGroup(sansPlan,  sysOrder),
  ]
  return travaux.map((t) => ({ ...t, numero: ordered.findIndex((x) => x.id === t.id) + 1 }))
}

function makeReportSection(type: ReportSectionType): ReportSection {
  const id = nanoid()
  if (type === 'text')           return { id, type, title: '', content: '' }
  if (type === 'equipment_list') return { id, type, title: '', items: [] }
  if (type === 'subtitle')       return { id, type, title: '' }
  return { id, type: 'observations', title: '', items: [] }
}

function logEntry(
  action: HistoryEntry['action'],
  entity: HistoryEntry['entity'],
  entityId: string,
  description: string,
  user: string,
): HistoryEntry {
  return { id: `h-${Date.now()}-${nanoid(4)}`, action, entity, entityId, user, timestamp: new Date().toISOString(), description }
}

// ── Interface du store ────────────────────────────────────────────────────────

interface AppState {
  // Données
  projects:      Project[]
  plans:         Plan[]
  travaux:       TravailNettoyage[]
  interventions: Intervention[]
  annotations:   Annotation[]
  zones:         ZoneConduit[]
  history:       HistoryEntry[]

  // Navigation
  currentProjectId:  string | null
  currentPlanId:     string | null
  selectedTravailId: string | null
  selectedAnnotationId: string | null
  selectedZoneId:    string | null

  // Outil canvas
  currentTool:          Tool
  annotationColor:      string
  annotationStrokeWidth: number
  annotationFontSize:   number

  // Logo global entreprise (partagé entre tous les projets)
  companyLogo?: string

  // UI
  darkMode:        boolean
  sidebarCollapsed: boolean

  // Sections de rapport (cache du projet courant)
  reportSections: ReportSection[]
  reportGabaritType: 'data-driven' | 'nadca-static' | 'omhm-static' | null

  // ── Actions Projet ────────────────────────────────────────────────────────
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'systemes' | 'signatures' | 'nextPhotoRef'>) => string
  updateProject: (id: string, data: Partial<Project>) => void
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (id: string | null) => void
  importFromInspection: (data: InspectionExport) => string
  exportProject: (overrideProjectId?: string) => unknown | null
  importProjectJSON: (data: unknown) => void

  // ── Actions Systèmes ──────────────────────────────────────────────────────
  addSysteme:    (projectId: string, data: Omit<Systeme, 'id'>) => string
  updateSysteme: (projectId: string, systemeId: string, data: Partial<Omit<Systeme, 'id'>>) => void
  deleteSysteme: (projectId: string, systemeId: string) => void

  // ── Actions Plans ─────────────────────────────────────────────────────────
  addPlan:      (data: Omit<Plan, 'id' | 'createdAt'>) => string
  updatePlan:   (id: string, data: Partial<Plan>) => void
  deletePlan:   (id: string) => Promise<void>
  setCurrentPlan: (id: string | null) => void

  // ── Actions Travaux ───────────────────────────────────────────────────────
  addTravail:    (data: Omit<TravailNettoyage, 'id' | 'numero' | 'createdAt' | 'updatedAt'>) => string
  addStandaloneTravail: () => string
  updateTravail: (id: string, data: Partial<TravailNettoyage>) => void
  deleteTravail: (id: string) => void
  setSelectedTravail: (id: string | null) => void
  updateTravailStatut: (id: string, statut: StatutTravail) => void

  // ── Actions Photos ────────────────────────────────────────────────────────
  consumePhotoRef: () => string
  addPhotoToTravail:    (travailId: string, photo: Photo, type: 'avant' | 'pendant' | 'apres') => void
  removePhotoFromTravail: (travailId: string, photoId: string, type: 'avant' | 'pendant' | 'apres') => void
  starPhoto: (travailId: string, photoId: string, type: 'avant' | 'pendant' | 'apres', starred: boolean) => void
  addPhotoToAnomalie:    (travailId: string, anomalieId: string, photo: Photo) => void
  removePhotoFromAnomalie: (travailId: string, anomalieId: string, photoId: string) => void
  addAnomalie:    (travailId: string, anomalie: Omit<AnomalieNettoyage, 'id' | 'photos'>) => string
  updateAnomalie: (travailId: string, anomalieId: string, data: Partial<Omit<AnomalieNettoyage, 'id'>>) => void
  deleteAnomalie: (travailId: string, anomalieId: string) => void

  // ── Actions Portes d'accès ────────────────────────────────────────────────
  addAccessDoor:    (planId: string, x: number, y: number) => string
  updateAccessDoor: (planId: string, doorId: string, data: Partial<PlanAccessDoor>) => void
  removeAccessDoor: (planId: string, doorId: string) => void
  addPhotoToDoor:    (planId: string, doorId: string, photo: Photo) => void
  removePhotoFromDoor: (planId: string, doorId: string, photoId: string) => void

  // ── Actions Zones ─────────────────────────────────────────────────────────
  addZone:    (zone: ZoneConduit) => void
  updateZone: (id: string, data: Partial<ZoneConduit>) => void
  removeZone: (id: string) => void
  selectZone: (id: string | null) => void

  // ── Actions Annotations ───────────────────────────────────────────────────
  setCurrentTool:          (tool: Tool) => void
  setAnnotationColor:      (color: string) => void
  setAnnotationStrokeWidth: (w: number) => void
  setAnnotationFontSize:   (size: number) => void
  addAnnotation:    (a: Annotation) => void
  updateAnnotation: (id: string, data: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  selectAnnotation: (id: string | null) => void

  // ── Actions Signatures ────────────────────────────────────────────────────
  addSignature:    (projectId: string, sig: Omit<Signature, 'id' | 'timestamp'>) => void
  removeSignature: (projectId: string, sigId: string) => void

  // ── Actions UI ────────────────────────────────────────────────────────────
  toggleDarkMode:    () => void
  toggleSidebar:     () => void
  setCompanyLogo:    (logo: string | undefined) => void

  // ── Actions Rapport ───────────────────────────────────────────────────────
  setReportGabaritType:  (type: 'data-driven' | 'nadca-static' | 'omhm-static' | null) => void
  addReportSection:      (type: ReportSectionType) => void
  updateReportSection:   (id: string, data: Partial<ReportSection>) => void
  removeReportSection:   (id: string) => void
  moveReportSection:     (id: string, dir: 'up' | 'down') => void
  setReportSections:     (sections: ReportSection[]) => void
  addEquipmentItem:      (sectionId: string) => void
  updateEquipmentItem:   (sectionId: string, itemId: string, data: Partial<EquipmentItem>) => void
  removeEquipmentItem:   (sectionId: string, itemId: string) => void
  addObservationItem:    (sectionId: string) => void
  updateObservationItem: (sectionId: string, itemId: string, data: Partial<ObservationItem>) => void
  removeObservationItem: (sectionId: string, itemId: string) => void
  addObservationPhoto:   (sectionId: string, itemId: string, url: string) => void
  removeObservationPhoto:(sectionId: string, itemId: string, idx: number) => void

  // ── Actions Interventions ─────────────────────────────────────────────────
  addIntervention:    (data: Omit<Intervention, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateIntervention: (id: string, data: Partial<Intervention>) => void
  deleteIntervention: (id: string) => Promise<void>

  // ── Persistance images ────────────────────────────────────────────────────
  restorePlanImages:         () => Promise<void>
  restoreTravailPhotos:      () => Promise<void>
  restoreInterventionPhotos: () => Promise<void>
}

// ═════════════════════════════════════════════════════════════════════════════

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects:      [],
      plans:         [],
      travaux:       [],
      interventions: [],
      annotations:   [],
      zones:         [],
      history:       [],
      currentProjectId:     null,
      currentPlanId:        null,
      selectedTravailId:    null,
      selectedAnnotationId: null,
      selectedZoneId:       null,
      currentTool:          'select',
      annotationColor:      '#EF4444',
      annotationStrokeWidth: 2,
      annotationFontSize:   24,
      darkMode:        false,
      sidebarCollapsed: false,
      reportSections:  [],
      reportGabaritType: null,

      // ── Projet ─────────────────────────────────────────────────────────────

      createProject: (data) => {
        const id  = nanoid()
        const now = new Date().toISOString()
        const proj: Project = {
          ...data, id, systemes: [], signatures: [], nextPhotoRef: 1, createdAt: now, updatedAt: now,
        }
        set((s) => ({
          projects: [...s.projects, proj],
          history: [...s.history, logEntry('create', 'projet', id, `Projet "${proj.name}" créé`, proj.technicien ?? 'Technicien')],
        }))
        return id
      },

      updateProject: (id, data) =>
        set((s) => ({
          projects: s.projects.map((p) => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p),
          reportSections: id === s.currentProjectId && data.reportSections !== undefined ? data.reportSections : s.reportSections,
        })),

      deleteProject: async (id) => {
        const state = get()
        const planIds = state.plans.filter((p) => p.projectId === id).map((p) => p.id)
        for (const pid of planIds) await deletePlanImage(pid)
        await deleteProjectInterventionPhotos(id)
        set((s) => ({
          projects:      s.projects.filter((p) => p.id !== id),
          plans:         s.plans.filter((p) => p.projectId !== id),
          travaux:       s.travaux.filter((t) => !planIds.includes(t.planId)),
          interventions: s.interventions.filter((i) => i.projectId !== id),
          annotations:   s.annotations.filter((a) => !planIds.includes(a.planId)),
          zones:         s.zones.filter((z) => !planIds.includes(z.planId)),
          currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
          currentPlanId:    planIds.includes(s.currentPlanId ?? '') ? null : s.currentPlanId,
          reportSections:   s.currentProjectId === id ? [] : s.reportSections,
        }))
      },

      setCurrentProject: (id) =>
        set((s) => {
          const proj = s.projects.find((p) => p.id === id)
          return {
            currentProjectId:  id,
            currentPlanId:     null,
            selectedTravailId: null,
            selectedAnnotationId: null,
            reportSections:    id ? ((proj as any)?.reportSections ?? []) : [],
            reportGabaritType: id ? ((proj as any)?.reportGabaritType ?? null) : null,
          }
        }),

      importFromInspection: (data) => {
        const now  = new Date().toISOString()
        const id   = nanoid()
        const insp = data.project ?? {}

        // Systèmes dynamiques — extraits des numérosSysteme des épingles
        const systemeNoms = Array.from(new Set(
          (data.pins ?? []).map((p: any) => (p.numeroSysteme ?? '').trim()).filter(Boolean)
        )) as string[]
        const hasNoSys = (data.pins ?? []).some((p: any) => !(p.numeroSysteme ?? '').trim())
        const systemes: Systeme[] = systemeNoms.map((nom) => ({ id: nanoid(), nom }))
        const noSysId = hasNoSys ? nanoid() : ''
        if (hasNoSys) systemes.push({ id: noSysId, nom: 'Sans système' })

        const newProject: Project = {
          id,
          name:              `[Nettoyage] ${insp.name ?? 'Projet importé'}`,
          client:            insp.client ?? '',
          adresse:           insp.address ?? '',
          ville:             '',
          codePostal:        '',
          technicien:        insp.technicien ?? '',
          technicienTitre:   insp.technicienTitre ?? '',
          verificateur:      insp.verificateur ?? '',
          verificateurTitre: insp.verificateurTitre ?? '',
          contrat:           insp.contrat ?? '',
          logo:              insp.logo,
          logoClient:        insp.logoClient,
          standards:         insp.standards ?? [],
          description:       insp.description ?? '',
          systemes,
          signatures:        [],
          nextPhotoRef:      1,
          inspectionProjectId: insp.id,
          createdAt: now, updatedAt: now,
        }

        // Plans
        const planIdMap: Record<string, string> = {}
        const newPlans: Plan[] = (data.plans ?? []).map((p: any) => {
          const newId = nanoid()
          planIdMap[p.id] = newId
          return {
            id: newId, projectId: id,
            name: p.name ?? 'Plan',
            type: (p.type ?? 'image') as 'pdf' | 'image',
            width: p.width ?? 1200, height: p.height ?? 900,
            pageNumber: p.pageNumber, totalPages: p.totalPages,
            drawingNumber: p.drawingNumber ?? '',
            rotation: p.rotation ?? 0,
            accessDoors: (p.accessDoors ?? []).map((d: any) => ({ ...d, id: nanoid() })),
            createdAt: now,
          }
        })

        // Épingles → Travaux
        const sysNomMap: Record<string, Systeme> = {}
        systemes.forEach((s) => { sysNomMap[s.nom] = s })

        const newTravaux: TravailNettoyage[] = (data.pins ?? []).map((pin: any, idx: number) => {
          const nomSys = (pin.numeroSysteme ?? '').trim()
          const sys    = nomSys ? (sysNomMap[nomSys] ?? { id: noSysId }) : { id: noSysId }
          const photosBefore: Photo[] = (pin.photosBefore ?? []).map((ph: any) => ({
            id: ph.id ?? nanoid(), ref: ph.ref ?? 'P000',
            url: ph.url ?? '', timestamp: ph.timestamp ? new Date(ph.timestamp).toISOString() : now, note: ph.note ?? '',
          }))
          return {
            id: nanoid(), numero: idx + 1,
            planId:    planIdMap[pin.planId] ?? '',
            systemeId: sys.id,
            inspectionPinId: pin.id,
            x: pin.x ?? 100, y: pin.y ?? 100,
            arrowEndX: pin.arrowEndX ?? (pin.x ?? 100) + 40,
            arrowEndY: pin.arrowEndY ?? (pin.y ?? 100) - 30,
            pinSize: pin.pinSize ?? 'medium',
            typeComposante: pin.typeComposante,
            location:     pin.location ?? '',
            zoneDesservie: pin.zoneDesservie ?? '',
            niveauSalubriteInitial: pin.niveauSalubrite,
            niveauSalubriteFinal:   undefined,
            statut: 'a_faire' as StatutTravail,
            technicien: pin.inspecteur ?? '',
            observationsAvant: pin.observations ?? '',
            observationsApres: '',
            anomalies:       [],
            photosAvant:     photosBefore,
            photosPendant:   [],
            photosApres:     [],
            portesUtilisees: [],
            createdAt: now, updatedAt: now,
          }
        })

        // Sauvegarder images des plans dans IndexedDB
        ;(data.plans ?? []).forEach((p: any, i: number) => {
          if (p.url) savePlanImage(newPlans[i].id, p.url)
        })

        // Sauvegarder photos des épingles
        const photoMap: Record<string, string> = {}
        newTravaux.forEach((t) => {
          const allPhotos = [...t.photosAvant, ...t.photosPendant, ...t.photosApres]
          allPhotos.forEach((ph) => {
            if (ph.url && ph.ref) photoMap[`${id}_${ph.ref}`] = ph.url
          })
        })
        if (Object.keys(photoMap).length > 0) saveTravailPhotos(photoMap)

        const renumbered = recomputeNumbers(newTravaux, systemes)
        const newAnnotations: Annotation[] = (data.annotations ?? []).map((a: any) => {
          const newPlanId = planIdMap[a.planId] ?? ''
          return { ...a, id: nanoid(), planId: newPlanId }
        })

        set((s) => ({
          projects:    [...s.projects, newProject],
          plans:       [...s.plans, ...newPlans],
          travaux:     [...s.travaux, ...renumbered],
          annotations: [...s.annotations, ...newAnnotations],
          history: [...s.history, logEntry('import', 'projet', id, `Projet importé depuis inspection : "${newProject.name}"`, newProject.technicien ?? 'Technicien')],
          currentProjectId:  id,
          currentPlanId:     null,
          selectedTravailId: null,
          reportSections:    [],
        }))
        return id
      },

      exportProject: (overrideProjectId?: string) => {
        const s   = get()
        const pid = overrideProjectId ?? s.currentProjectId
        if (!pid) return null
        const project = s.projects.find((p) => p.id === pid)
        if (!project) return null
        const planIds = s.plans.filter((p) => p.projectId === pid).map((p) => p.id)
        return {
          version:      2,
          project,
          // URLs images de plan strippées — stockées séparément dans IndexedDB ou sur disque
          plans:        s.plans.filter((p) => p.projectId === pid).map((p) => ({ ...p, url: '' })),
          // Inclut les travaux sur plan ET les travaux sans plan (planId vide)
          travaux:      s.travaux.filter((t) => planIds.includes(t.planId) || (!t.planId && t.systemeId && project.systemes.some((sys) => sys.id === t.systemeId))),
          interventions: s.interventions.filter((i) => i.projectId === pid).map((i) => ({
            ...i,
            photosHotteAvant:    (i.photosHotteAvant    ?? []).map((ph) => ({ ...ph, url: '' })),
            photosHotteApres:    (i.photosHotteApres    ?? []).map((ph) => ({ ...ph, url: '' })),
            photosSdbAvant:      (i.photosSdbAvant      ?? []).map((ph) => ({ ...ph, url: '' })),
            photosSdbApres:      (i.photosSdbApres      ?? []).map((ph) => ({ ...ph, url: '' })),
            photosChgtHotteAvant: (i.photosChgtHotteAvant ?? []).map((ph) => ({ ...ph, url: '' })),
            photosChgtHotteApres: (i.photosChgtHotteApres ?? []).map((ph) => ({ ...ph, url: '' })),
          })),
          annotations:  s.annotations.filter((a) => planIds.includes(a.planId)),
          history:      s.history,
          exportedAt:   new Date().toISOString(),
        }
      },

      importProjectJSON: (raw) => {
        const data = raw as any
        const now  = new Date().toISOString()
        if (!data?.project) return
        // Rehydrate dates/IDs
        const proj: Project = { ...data.project, updatedAt: now }
        const planIds = (data.plans ?? []).map((p: any) => p.id)
        set((s) => ({
          projects:    [...s.projects.filter((p) => p.id !== proj.id), proj],
          plans:       [...s.plans.filter((p) => !planIds.includes(p.id)), ...(data.plans ?? [])],
          travaux:     [...s.travaux.filter((t) => !planIds.includes(t.planId)), ...(data.travaux ?? [])],
          annotations: [...s.annotations.filter((a) => !planIds.includes(a.planId)), ...(data.annotations ?? [])],
          history:     data.history ?? s.history,
          currentProjectId:  proj.id,
          currentPlanId:     null,
          selectedTravailId: null,
          reportSections:    proj.reportSections ?? [],
        }))
        // Re-save images
        ;(data.plans ?? []).forEach((p: any) => { if (p.url) savePlanImage(p.id, p.url) })
      },

      // ── Systèmes ────────────────────────────────────────────────────────────

      addSysteme: (projectId, data) => {
        const id = nanoid()
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, systemes: [...p.systemes, { ...data, id }], updatedAt: new Date().toISOString() } : p
          ),
          history: [...s.history, logEntry('create', 'systeme', id, `Système "${data.nom}" ajouté`, '')],
        }))
        return id
      },

      updateSysteme: (projectId, systemeId, data) => {
        set((s) => {
          const updated = s.projects.map((p) =>
            p.id !== projectId ? p : {
              ...p,
              systemes: p.systemes.map((sys) => sys.id === systemeId ? { ...sys, ...data } : sys),
              updatedAt: new Date().toISOString(),
            }
          )
          const newTravaux = 'nom' in data ? recomputeNumbers(
            s.travaux,
            updated.find((p) => p.id === projectId)?.systemes ?? []
          ) : s.travaux
          return { projects: updated, travaux: newTravaux }
        })
      },

      deleteSysteme: (projectId, systemeId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : { ...p, systemes: p.systemes.filter((sys) => sys.id !== systemeId) }
          ),
        })),

      // ── Plans ────────────────────────────────────────────────────────────────

      addPlan: (data) => {
        const id  = nanoid()
        const now = new Date().toISOString()
        set((s) => ({
          plans: [...s.plans, { ...data, id, createdAt: now }],
          history: [...s.history, logEntry('create', 'plan', id, `Plan "${data.name}" ajouté`, s.projects.find((p) => p.id === s.currentProjectId)?.technicien ?? '')],
        }))
        return id
      },

      updatePlan: (id, data) =>
        set((s) => ({ plans: s.plans.map((p) => p.id === id ? { ...p, ...data } : p) })),

      deletePlan: async (id) => {
        await deletePlanImage(id)
        set((s) => ({
          plans:       s.plans.filter((p) => p.id !== id),
          travaux:     recomputeNumbers(
            s.travaux.filter((t) => t.planId !== id),
            s.projects.find((p) => p.id === s.currentProjectId)?.systemes ?? []
          ),
          annotations: s.annotations.filter((a) => a.planId !== id),
          zones:       s.zones.filter((z) => z.planId !== id),
          currentPlanId: s.currentPlanId === id ? null : s.currentPlanId,
        }))
      },

      setCurrentPlan: (id) => set({ currentPlanId: id, selectedTravailId: null, selectedAnnotationId: null }),

      // ── Travaux ──────────────────────────────────────────────────────────────

      addTravail: (data) => {
        const id  = nanoid()
        const now = new Date().toISOString()
        set((s) => {
          const proj    = s.projects.find((p) => p.id === s.currentProjectId)
          const temp    = { ...data, id, numero: 0, createdAt: now, updatedAt: now }
          const updated = recomputeNumbers([...s.travaux, temp], proj?.systemes ?? [])
          return {
            travaux:          updated,
            selectedTravailId: id,
            history: [...s.history, logEntry('create', 'travail', id, `Travail #${updated.find((t) => t.id === id)?.numero} créé`, proj?.technicien ?? '')],
          }
        })
        return id
      },

      addStandaloneTravail: () => {
        const s    = get()
        const proj = s.projects.find((p) => p.id === s.currentProjectId)
        return s.addTravail({
          planId:    '',
          systemeId: proj?.systemes?.[0]?.id ?? '',
          x: 0, y: 0,
          arrowEndX: 0, arrowEndY: 0,
          statut:          'a_faire',
          anomalies:       [],
          photosAvant:     [],
          photosPendant:   [],
          photosApres:     [],
          portesUtilisees: [],
          technicien:      proj?.technicien ?? '',
        })
      },

      updateTravail: (id, data) =>
        set((s) => {
          const proj    = s.projects.find((p) => p.id === s.currentProjectId)
          const updated = s.travaux.map((t) => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t)
          const travaux = 'systemeId' in data ? recomputeNumbers(updated, proj?.systemes ?? []) : updated
          return {
            travaux,
            history: [...s.history, logEntry('update', 'travail', id, `Travail #${s.travaux.find((t) => t.id === id)?.numero} modifié`, proj?.technicien ?? '')],
          }
        }),

      deleteTravail: (id) => {
        const s = get()
        const proj    = s.projects.find((p) => p.id === s.currentProjectId)
        const travail = s.travaux.find((t) => t.id === id)

        // Travaux restants après suppression
        const remainingTravaux = recomputeNumbers(s.travaux.filter((t) => t.id !== id), proj?.systemes ?? [])

        // IDs de portes liées à ce travail
        const doorIdsToCheck = new Set(travail?.portesUtilisees ?? [])

        // Parmi ces portes, garder celles encore référencées par d'autres travaux
        const stillUsed = new Set<string>()
        for (const t of remainingTravaux) {
          for (const did of (t.portesUtilisees ?? [])) {
            if (doorIdsToCheck.has(did)) stillUsed.add(did)
          }
        }

        // Supprimer les portes non-référencées ET renuméroter
        const doorsToDelete = new Set([...doorIdsToCheck].filter((did) => !stillUsed.has(did)))

        let newPlans = s.plans
        if (doorsToDelete.size > 0) {
          newPlans = s.plans.map((p) => ({
            ...p,
            accessDoors: (p.accessDoors ?? []).filter((d) => !doorsToDelete.has(d.id)),
          }))
          // Renuméroter les portes restantes du projet
          const projectId = proj?.id ?? s.currentProjectId ?? ''
          const allRemaining = newPlans
            .filter((p) => p.projectId === projectId)
            .flatMap((p) => (p.accessDoors ?? []).map((d) => ({
              pid: p.id, did: d.id,
              num: parseInt(d.numero.replace(/\D/g, ''), 10) || 0,
            })))
            .sort((a, b) => a.num - b.num)
          const numMap = new Map<string, string>(
            allRemaining.map(({ did }, i) => [did, `PA-${String(i + 1).padStart(2, '0')}`])
          )
          newPlans = newPlans.map((p) =>
            p.projectId !== projectId ? p : {
              ...p,
              accessDoors: (p.accessDoors ?? []).map((d) =>
                numMap.has(d.id) ? { ...d, numero: numMap.get(d.id)! } : d
              ),
            }
          )
        }

        set({
          travaux:          remainingTravaux,
          plans:            newPlans,
          selectedTravailId: s.selectedTravailId === id ? null : s.selectedTravailId,
          history:          [...s.history, logEntry('delete', 'travail', id, `Travail supprimé`, proj?.technicien ?? '')],
        })
      },

      setSelectedTravail: (id) => set({ selectedTravailId: id, selectedAnnotationId: null }),

      updateTravailStatut: (id, statut) =>
        set((s) => ({
          travaux: s.travaux.map((t) => t.id === id ? { ...t, statut, updatedAt: new Date().toISOString() } : t),
        })),

      // ── Photos ────────────────────────────────────────────────────────────────

      consumePhotoRef: () => {
        const state = get()
        const proj  = state.projects.find((p) => p.id === state.currentProjectId)
        const n     = proj?.nextPhotoRef ?? 1
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === s.currentProjectId ? { ...p, nextPhotoRef: n + 1 } : p
          ),
        }))
        return `P${String(n).padStart(3, '0')}`
      },

      addPhotoToTravail: (travailId, photo, type) => {
        const key = type === 'avant' ? 'photosAvant' : type === 'pendant' ? 'photosPendant' : 'photosApres'
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id === travailId ? { ...t, [key]: [...t[key], photo], updatedAt: new Date().toISOString() } : t
          ),
        }))
      },

      removePhotoFromTravail: (travailId, photoId, type) => {
        const key = type === 'avant' ? 'photosAvant' : type === 'pendant' ? 'photosPendant' : 'photosApres'
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id === travailId
              ? { ...t, [key]: t[key].filter((ph: any) => ph.id !== photoId), updatedAt: new Date().toISOString() }
              : t
          ),
        }))
      },

      starPhoto: (travailId, photoId, type, starred) => {
        const key = type === 'avant' ? 'photosAvant' : type === 'pendant' ? 'photosPendant' : 'photosApres'
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id === travailId
              ? {
                  ...t,
                  [key]: t[key].map((ph: any) => ph.id === photoId ? { ...ph, starred } : ph),
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }))
      },

      addAnomalie: (travailId, anomalie) => {
        const id = nanoid()
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id === travailId
              ? { ...t, anomalies: [...t.anomalies, { ...anomalie, id, photos: [] }], updatedAt: new Date().toISOString() }
              : t
          ),
        }))
        return id
      },

      updateAnomalie: (travailId, anomalieId, data) =>
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id !== travailId ? t : {
              ...t,
              anomalies: t.anomalies.map((a) => a.id === anomalieId ? { ...a, ...data } : a),
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      deleteAnomalie: (travailId, anomalieId) =>
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id !== travailId ? t : {
              ...t,
              anomalies: t.anomalies.filter((a) => a.id !== anomalieId),
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      addPhotoToAnomalie: (travailId, anomalieId, photo) =>
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id !== travailId ? t : {
              ...t,
              anomalies: t.anomalies.map((a) =>
                a.id === anomalieId ? { ...a, photos: [...a.photos, photo] } : a
              ),
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      removePhotoFromAnomalie: (travailId, anomalieId, photoId) =>
        set((s) => ({
          travaux: s.travaux.map((t) =>
            t.id !== travailId ? t : {
              ...t,
              anomalies: t.anomalies.map((a) =>
                a.id === anomalieId ? { ...a, photos: a.photos.filter((ph) => ph.id !== photoId) } : a
              ),
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      // ── Portes d'accès ────────────────────────────────────────────────────────

      addAccessDoor: (planId, x, y) => {
        const plan = get().plans.find((p) => p.id === planId)
        if (!plan) return ''
        const allDoors = get().plans
          .filter((p) => p.projectId === plan.projectId)
          .flatMap((p) => p.accessDoors ?? [])
        const n = allDoors.length + 1
        const door: PlanAccessDoor = {
          id: nanoid(), x, y,
          arrowEndX: x + 60, arrowEndY: y + 60,
          numero: `PA-${String(n).padStart(2, '0')}`,
          type: 'acces', dimensions: '', statut: 'ajoutee', remarques: '', photosPorte: [],
        }
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id !== planId ? p : { ...p, accessDoors: [...(p.accessDoors ?? []), door] }
          ),
          history: [...s.history, logEntry('create', 'porte', door.id, `Porte ${door.numero} ajoutée`, '')],
        }))
        return door.id
      },

      updateAccessDoor: (planId, doorId, data) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              accessDoors: (p.accessDoors ?? []).map((d) => d.id === doorId ? { ...d, ...data } : d),
            }
          ),
        })),

      removeAccessDoor: (planId, doorId) => {
        const s = get()
        const plan = s.plans.find((p) => p.id === planId)
        if (!plan) return
        const projectId = plan.projectId

        // 1. Supprimer la porte
        const plansAfterDelete = s.plans.map((p) =>
          p.id !== planId ? p : { ...p, accessDoors: (p.accessDoors ?? []).filter((d) => d.id !== doorId) }
        )

        // 2. Collecter toutes les portes restantes du projet, triées par numéro actuel
        const allRemaining = plansAfterDelete
          .filter((p) => p.projectId === projectId)
          .flatMap((p) => (p.accessDoors ?? []).map((d) => ({
            pid: p.id, did: d.id,
            num: parseInt(d.numero.replace(/\D/g, ''), 10) || 0,
          })))
          .sort((a, b) => a.num - b.num)

        // 3. Renuméroter sans trou
        const numMap = new Map<string, string>(
          allRemaining.map(({ did }, i) => [did, `PA-${String(i + 1).padStart(2, '0')}`])
        )

        // 4. Appliquer les nouveaux numéros
        const newPlans = plansAfterDelete.map((p) =>
          p.projectId !== projectId ? p : {
            ...p,
            accessDoors: (p.accessDoors ?? []).map((d) =>
              numMap.has(d.id) ? { ...d, numero: numMap.get(d.id)! } : d
            ),
          }
        )

        set({ plans: newPlans })
      },

      addPhotoToDoor: (planId, doorId, photo) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              accessDoors: (p.accessDoors ?? []).map((d) =>
                d.id === doorId ? { ...d, photosPorte: [...(d.photosPorte ?? []), photo] } : d
              ),
            }
          ),
        })),

      removePhotoFromDoor: (planId, doorId, photoId) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              accessDoors: (p.accessDoors ?? []).map((d) =>
                d.id === doorId ? { ...d, photosPorte: (d.photosPorte ?? []).filter((ph) => ph.id !== photoId) } : d
              ),
            }
          ),
        })),

      // ── Zones ─────────────────────────────────────────────────────────────────

      addZone:    (zone) => set((s) => ({ zones: [...s.zones, zone] })),
      updateZone: (id, data) => set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, ...data } : z) })),
      removeZone: (id) => set((s) => ({ zones: s.zones.filter((z) => z.id !== id), selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId })),
      selectZone: (id) => set({ selectedZoneId: id }),

      // ── Annotations ───────────────────────────────────────────────────────────

      setCurrentTool:           (tool)  => set({ currentTool: tool }),
      setAnnotationColor:       (color) => set({ annotationColor: color }),
      setAnnotationStrokeWidth: (w)     => set({ annotationStrokeWidth: w }),
      setAnnotationFontSize:    (size)  => set({ annotationFontSize: size }),

      addAnnotation: (a) =>
        set((s) => ({
          annotations: [...s.annotations, a],
          history: [...s.history, logEntry('create', 'annotation', a.id, `Annotation ${a.type} ajoutée`, '')],
        })),

      updateAnnotation: (id, data) =>
        set((s) => ({ annotations: s.annotations.map((a) => a.id === id ? { ...a, ...data } : a) as any })),

      deleteAnnotation: (id) =>
        set((s) => ({
          annotations: s.annotations.filter((a) => a.id !== id),
          selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
        })),

      selectAnnotation: (id) => set({ selectedAnnotationId: id }),

      // ── Signatures ────────────────────────────────────────────────────────────

      addSignature: (projectId, sig) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : {
              ...p,
              signatures: [...p.signatures, { ...sig, id: nanoid(), timestamp: new Date().toISOString() }],
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      removeSignature: (projectId, sigId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId ? p : { ...p, signatures: p.signatures.filter((sg) => sg.id !== sigId) }
          ),
        })),

      // ── UI ────────────────────────────────────────────────────────────────────

      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode
          if (next) document.documentElement.classList.add('dark')
          else      document.documentElement.classList.remove('dark')
          return { darkMode: next }
        }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setCompanyLogo: (logo) => set({ companyLogo: logo }),

      // ── Rapport ───────────────────────────────────────────────────────────────

      setReportGabaritType: (type) =>
        set((s) => ({
          reportGabaritType: type,
          projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportGabaritType: type ?? undefined } : p),
        })),

      addReportSection: (type) =>
        set((s) => {
          const sec     = makeReportSection(type)
          const updated = [...s.reportSections, sec]
          return {
            reportSections: updated,
            projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p),
          }
        }),

      updateReportSection: (id, data) =>
        set((s) => {
          const updated = s.reportSections.map((sec) => sec.id === id ? ({ ...sec, ...data } as ReportSection) : sec)
          return {
            reportSections: updated,
            projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p),
          }
        }),

      removeReportSection: (id) =>
        set((s) => {
          const updated = s.reportSections.filter((sec) => sec.id !== id)
          return {
            reportSections: updated,
            projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p),
          }
        }),

      moveReportSection: (id, dir) =>
        set((s) => {
          const idx  = s.reportSections.findIndex((sec) => sec.id === id)
          if (idx < 0) return {}
          const arr  = [...s.reportSections]
          const swap = dir === 'up' ? idx - 1 : idx + 1
          if (swap < 0 || swap >= arr.length) return {}
          ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
          return {
            reportSections: arr,
            projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: arr } : p),
          }
        }),

      setReportSections: (sections) =>
        set((s) => ({
          reportSections: sections,
          projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: sections } : p),
        })),

      addEquipmentItem: (sectionId) =>
        set((s) => {
          const item: EquipmentItem = { id: nanoid(), systeme: '', composante: '', zone: '', etat: '', observations: '' }
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'equipment_list' ? { ...sec, items: [...sec.items, item] } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      updateEquipmentItem: (sectionId, itemId, data) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'equipment_list'
              ? { ...sec, items: sec.items.map((it) => it.id === itemId ? { ...it, ...data } : it) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      removeEquipmentItem: (sectionId, itemId) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'equipment_list'
              ? { ...sec, items: sec.items.filter((it) => it.id !== itemId) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      addObservationItem: (sectionId) =>
        set((s) => {
          const item: ObservationItem = { id: nanoid(), severity: 'info', text: '', photos: [] }
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'observations' ? { ...sec, items: [...sec.items, item] } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      updateObservationItem: (sectionId, itemId, data) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'observations'
              ? { ...sec, items: sec.items.map((it) => it.id === itemId ? { ...it, ...data } : it) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      removeObservationItem: (sectionId, itemId) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'observations'
              ? { ...sec, items: sec.items.filter((it) => it.id !== itemId) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      addObservationPhoto: (sectionId, itemId, url) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'observations'
              ? { ...sec, items: sec.items.map((it) => it.id === itemId ? { ...it, photos: [...it.photos, url] } : it) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      removeObservationPhoto: (sectionId, itemId, idx) =>
        set((s) => {
          const updated = s.reportSections.map((sec) =>
            sec.id === sectionId && sec.type === 'observations'
              ? { ...sec, items: sec.items.map((it) => it.id === itemId ? { ...it, photos: it.photos.filter((_, i) => i !== idx) } : it) } : sec
          )
          return { reportSections: updated, projects: s.projects.map((p) => p.id === s.currentProjectId ? { ...p, reportSections: updated } : p) }
        }),

      // ── Interventions ─────────────────────────────────────────────────────────

      addIntervention: (data) => {
        const id  = nanoid()
        const now = new Date().toISOString()
        const intv: Intervention = { ...data, id, createdAt: now, updatedAt: now }
        set((s) => ({ interventions: [...s.interventions, intv] }))
        return id
      },

      updateIntervention: (id, data) =>
        set((s) => ({
          interventions: s.interventions.map((i) =>
            i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i
          ),
        })),

      deleteIntervention: async (id) => {
        const state = get()
        const intv  = state.interventions.find((i) => i.id === id)
        if (intv) {
          const allPh = [
            ...(intv.photosHotteAvant    ?? []),
            ...(intv.photosHotteApres    ?? []),
            ...(intv.photosSdbAvant      ?? []),
            ...(intv.photosSdbApres      ?? []),
            ...(intv.photosChgtHotteAvant ?? []),
            ...(intv.photosChgtHotteApres ?? []),
          ]
          for (const ph of allPh) {
            await deleteInterventionPhoto(`${intv.projectId}_intv_${ph.ref}`)
          }
        }
        set((s) => ({ interventions: s.interventions.filter((i) => i.id !== id) }))
      },

      // ── Persistance images ────────────────────────────────────────────────────

      restorePlanImages: async () => {
        const images = await getAllPlanImages()
        if (!Object.keys(images).length) return
        set((s) => ({ plans: s.plans.map((p) => p.url ? p : { ...p, url: images[p.id] || '' }) }))
      },

      restoreTravailPhotos: async () => {
        const state = get()
        if (!state.currentProjectId) return
        let photos: Record<string, string>
        try {
          photos = await getProjectTravailPhotos(state.currentProjectId)
        } catch (e) {
          console.error('[Store] restoreTravailPhotos — erreur IndexedDB :', e)
          return
        }
        if (!Object.keys(photos).length) return
        const pid = state.currentProjectId
        const restore = (arr: Photo[]): Photo[] =>
          arr.map((ph) => ph.url ? ph : { ...ph, url: photos[`${pid}_${ph.ref}`] || '' })
        set((s) => ({
          travaux: s.travaux.map((t) => ({
            ...t,
            photosAvant:   restore(t.photosAvant),
            photosPendant: restore(t.photosPendant),
            photosApres:   restore(t.photosApres),
            anomalies:     t.anomalies.map((a) => ({ ...a, photos: restore(a.photos) })),
          })),
          plans: s.plans.map((p) => ({
            ...p,
            accessDoors: (p.accessDoors ?? []).map((d) => ({
              ...d,
              photosPorte: restore(d.photosPorte ?? []),
            })),
          })),
        }))
      },

      restoreInterventionPhotos: async () => {
        const state = get()
        if (!state.currentProjectId) return
        let photos: Record<string, string>
        try {
          photos = await getProjectInterventionPhotos(state.currentProjectId)
        } catch (e) {
          console.error('[Store] restoreInterventionPhotos — erreur IndexedDB :', e)
          return
        }
        if (!Object.keys(photos).length) return
        const pid = state.currentProjectId
        const restorePh = (arr: PhotoIntervention[]): PhotoIntervention[] =>
          arr.map((ph) => ph.url ? ph : { ...ph, url: photos[`${pid}_intv_${ph.ref}`] || '' })
        set((s) => ({
          interventions: s.interventions.map((i) => ({
            ...i,
            photosHotteAvant:    restorePh(i.photosHotteAvant    ?? []),
            photosHotteApres:    restorePh(i.photosHotteApres    ?? []),
            photosSdbAvant:      restorePh(i.photosSdbAvant      ?? []),
            photosSdbApres:      restorePh(i.photosSdbApres      ?? []),
            photosChgtHotteAvant: restorePh(i.photosChgtHotteAvant ?? []),
            photosChgtHotteApres: restorePh(i.photosChgtHotteApres ?? []),
          })),
        }))
      },
    }),
    {
      name: 'nettoyage-storage',
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        interventions: (persisted.interventions ?? []).map((i: any) => {
          const compDefaults = {
            photosHotteAvant:    [] as any[],
            photosHotteApres:    [] as any[],
            photosSdbAvant:      [] as any[],
            photosSdbApres:      [] as any[],
            photosChgtHotteAvant: [] as any[],
            photosChgtHotteApres: [] as any[],
            dateDeuxiemeAvis:    '',
            absentDeuxiemeAvis:  false,
            replHotte30:         false,
            replHotte24:         false,
          }

          // Format actuel avec photos par composante — juste compléter les champs manquants
          if ('photosHotteAvant' in i) {
            return { changementHotteStatut: null, ...compDefaults, ...i }
          }

          // Format intermédiaire : hotteStatut mais photos génériques (photosAvant/photosApres)
          if ('hotteStatut' in i) {
            return {
              changementHotteStatut: null,
              ...compDefaults,
              ...i,
              photosHotteAvant: i.photosAvant ?? [],
              photosHotteApres: i.photosApres ?? [],
            }
          }

          // Migration depuis modèle multi-travaux (travaux: TravailIntervention[])
          if (Array.isArray(i.travaux)) {
            const hotteT = i.travaux.find((t: any) => t.type === 'hotte' || t.type === 'hotte_cuisine')
            const sdbT   = i.travaux.find((t: any) => t.type === 'sdb'   || t.type === 'extracteur_sdb')
            const notes  = i.travaux.map((t: any) => t.notes).filter(Boolean).join(' | ')
            return {
              ...compDefaults,
              id: i.id, projectId: i.projectId, date: i.date, appartement: i.appartement,
              hotteStatut: hotteT?.statut ?? null,
              sdbStatut:   sdbT?.statut   ?? null,
              changementHotteStatut: null,
              photosHotteAvant: hotteT?.photosAvant ?? [],
              photosHotteApres: hotteT?.photosApres ?? [],
              photosSdbAvant:   sdbT?.photosAvant   ?? [],
              photosSdbApres:   sdbT?.photosApres   ?? [],
              notes,
              createdAt: i.createdAt, updatedAt: i.updatedAt,
            }
          }

          // Migration depuis très ancien format (typeTravail au niveau racine)
          return {
            ...compDefaults,
            id: i.id, projectId: i.projectId, date: i.date, appartement: i.appartement,
            hotteStatut: i.typeTravail === 'hotte' ? (i.statut ?? 'a_faire') : null,
            sdbStatut:   i.typeTravail === 'sdb'   ? (i.statut ?? 'a_faire') : null,
            changementHotteStatut: null,
            photosHotteAvant: i.photosAvant ?? [],
            photosHotteApres: i.photosApres ?? [],
            notes: i.notes ?? '',
            createdAt: i.createdAt, updatedAt: i.updatedAt,
          }
        }),
        zones: persisted.zones ?? [],
        // Restaurer le cache rapport depuis le projet courant
        ...((() => {
          const projId = persisted.currentProjectId
          const proj   = (persisted.projects ?? []).find((p: any) => p.id === projId)
          return {
            reportSections:    proj?.reportSections    ?? [],
            reportGabaritType: proj?.reportGabaritType ?? null,
          }
        })()),
        // Migration données anciennes
        projects: (persisted.projects ?? []).map((p: any) => ({
          ...p,
          systemes:     p.systemes     ?? [],
          signatures:   p.signatures   ?? [],
          nextPhotoRef: p.nextPhotoRef ?? 1,
        })),
        // Migration portes : ajouter statut/arrowEnd si absents, supprimer anciens champs
        plans: (persisted.plans ?? []).map((p: any) => ({
          ...p,
          accessDoors: (p.accessDoors ?? []).map((d: any) => ({
            id:         d.id,
            x:          d.x,
            y:          d.y,
            arrowEndX:  d.arrowEndX  ?? d.x + 60,
            arrowEndY:  d.arrowEndY  ?? d.y + 60,
            numero:     d.numero     ?? 'PA-01',
            type:       d.type       ?? 'acces',
            dimensions: d.dimensions ?? '',
            statut:     d.statut     ?? (d.existante ? 'existante' : 'ajoutee'),
            remarques:  d.remarques  ?? '',
            photosPorte: (d.photosPorte ?? []).map((ph: any) => ({ ...ph, url: ph.url ?? '' })),
          })),
        })),
      }),
      partialize: (state) => ({
        projects:         state.projects,
        // Plans sans URLs d'images (stockées dans IndexedDB) mais avec portes
        plans: state.plans.map((p) => ({
          ...p,
          url: undefined,
          accessDoors: (p.accessDoors ?? []).map((d) => ({
            ...d,
            photosPorte: (d.photosPorte ?? []).map((ph) => ({ ...ph, url: '' })),
          })),
        })),
        currentProjectId: state.currentProjectId,
        currentPlanId:    state.currentPlanId,
        darkMode:         state.darkMode,
        history:          state.history,
        // Travaux sans URLs de photos (stockées dans IndexedDB)
        travaux: state.travaux.map((t) => ({
          ...t,
          photosAvant:   t.photosAvant.map((ph)   => ({ ...ph, url: '' })),
          photosPendant: t.photosPendant.map((ph)  => ({ ...ph, url: '' })),
          photosApres:   t.photosApres.map((ph)    => ({ ...ph, url: '' })),
          anomalies:     t.anomalies.map((a)        => ({ ...a, photos: a.photos.map((ph) => ({ ...ph, url: '' })) })),
        })),
        annotations: state.annotations,
        zones:       state.zones,
        // Interventions sans URLs photos (stockées dans IndexedDB)
        interventions: state.interventions.map((i) => ({
          ...i,
          photosHotteAvant:    (i.photosHotteAvant    ?? []).map((ph) => ({ ...ph, url: '' })),
          photosHotteApres:    (i.photosHotteApres    ?? []).map((ph) => ({ ...ph, url: '' })),
          photosSdbAvant:      (i.photosSdbAvant      ?? []).map((ph) => ({ ...ph, url: '' })),
          photosSdbApres:      (i.photosSdbApres      ?? []).map((ph) => ({ ...ph, url: '' })),
          photosChgtHotteAvant: (i.photosChgtHotteAvant ?? []).map((ph) => ({ ...ph, url: '' })),
          photosChgtHotteApres: (i.photosChgtHotteApres ?? []).map((ph) => ({ ...ph, url: '' })),
        })),
      }),
    }
  )
)
