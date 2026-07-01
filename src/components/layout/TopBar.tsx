import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Wind, MousePointer2, MapPin, Hand, Save,
  Type, MessageSquare, ArrowRight, Square, Circle, Edit3, Ruler, DoorOpen, Hexagon,
  Sun, Moon, Download, Info, X, FileImage, FolderOpen, FolderCheck, FileDown,
  Lock, Unlock, Building2,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import SaveIndicator from '@/components/SaveIndicator'
import {
  pickSaveDirectory, writeProjectJson, writePhotoFileToDisk, isFileSystemSupported,
  getActiveSaveDir, setActiveSaveDir, restoreSaveDirectory,
  buildProjectFolderName, registerProjectFolderName,
} from '@/services/fileSystemSave'
import { getProjectTravailPhotos } from '@/services/travailPhotoStorage'
import { getProjectInterventionPhotos } from '@/services/interventionPhotoStorage'
import { getAllPlanImages } from '@/services/planImageStorage'

type View = 'plan' | 'dashboard' | 'systemes' | 'travaux' | 'portes' | 'photos' | 'report' | 'intervention' | 'matching' | 'templates' | 'debit'

interface Props {
  currentView:    View
  setCurrentView: (v: View) => void
}

export default function TopBar({ currentView, setCurrentView }: Props) {
  const currentTool      = useAppStore((s) => s.currentTool)
  const setCurrentTool   = useAppStore((s) => s.setCurrentTool)
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project          = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const updateProject    = useAppStore((s) => s.updateProject)
  const currentPlanId    = useAppStore((s) => s.currentPlanId)
  const plans            = useAppStore((s) => s.plans)
  const darkMode         = useAppStore((s) => s.darkMode)
  const toggleDarkMode   = useAppStore((s) => s.toggleDarkMode)
  const exportProject    = useAppStore((s) => s.exportProject)

  const annotationColor    = useAppStore((s) => s.annotationColor)
  const setAnnotationColor = useAppStore((s) => s.setAnnotationColor)

  const [showProjectInfo, setShowProjectInfo]   = useState(false)
  const [showBuildingInfo, setShowBuildingInfo] = useState(false)
  const [lastSaveTime, setLastSaveTime]       = useState<Date | null>(new Date())
  const [hasChanges, setHasChanges]           = useState(false)
  const [saveDir, setSaveDir]                 = useState<FileSystemDirectoryHandle | null>(getActiveSaveDir)
  const [syncing, setSyncing]                 = useState(false)

  // Refs pour éviter les closures périmées
  const saveDirRef   = useRef(saveDir)
  const projectRef   = useRef(project)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { saveDirRef.current = saveDir }, [saveDir])
  useEffect(() => { projectRef.current = project }, [project])

  // Restauration du dossier au montage
  useEffect(() => {
    restoreSaveDirectory().then((h) => {
      if (h) { setSaveDir(h); setActiveSaveDir(h) }
    })
  }, [])

  // Enregistrement du nom de dossier dès que le projet change
  useEffect(() => {
    if (project) {
      const folderName = buildProjectFolderName(project)
      registerProjectFolderName(project.id, folderName)
    }
  }, [project])

  const saveNow = useCallback(async () => {
    const dir  = saveDirRef.current
    const proj = projectRef.current
    if (!dir || !proj) { setHasChanges(false); setLastSaveTime(new Date()); return }
    // On passe l'ID explicitement pour éviter toute désynchronisation avec currentProjectId
    const data = exportProject(proj.id)
    if (!data) { setHasChanges(false); setLastSaveTime(new Date()); return }
    await writeProjectJson(dir, proj.id, data)
    setHasChanges(false)
    setLastSaveTime(new Date())
  }, [exportProject])

  // Subscription store → dirty flag + debounce 5 s pour écriture disque
  useEffect(() => {
    return useAppStore.subscribe(() => {
      setHasChanges(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => saveNow(), 5_000)
    })
  }, [saveNow])

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        saveNow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveNow])

  // Exposition globale
  useEffect(() => {
    ;(window as any).__saveCurrentProject = saveNow
    return () => { delete (window as any).__saveCurrentProject }
  }, [saveNow])

  // Sync complète : écrit toutes les photos dans la structure systemes/interventions/plans
  const syncAllPhotosToDisk = useCallback(async (dir: FileSystemDirectoryHandle) => {
    const proj = projectRef.current
    if (!proj) return
    const pid = proj.id

    const state = useAppStore.getState()
    const currentPlans   = state.plans.filter((p) => p.projectId === pid)
    const currentTravaux = state.travaux.filter((t) => currentPlans.some((p) => p.id === t.planId))
    const currentIntervs = state.interventions.filter((i) => i.projectId === pid)

    const [travailPhotos, interventionPhotos, planImages] = await Promise.all([
      getProjectTravailPhotos(pid),
      getProjectInterventionPhotos(pid),
      getAllPlanImages(),
    ])

    // ── Mapping ref → subPath pour les photos de travaux ──────────────────────
    // Sources : travaux (systemes) + portes d'accès
    const travailSubPath = new Map<string, string>()

    for (const t of currentTravaux) {
      const systeme = proj.systemes?.find((s) => s.id === t.systemeId)
      const slug    = systeme?.nom ?? 'sans-systeme'
      for (const ph of [...(t.photosAvant ?? []), ...(t.photosApres ?? [])]) {
        travailSubPath.set(ph.ref, `systemes/${slug}/${ph.ref}`)
      }
      for (const anomalie of (t.anomalies ?? [])) {
        for (const ph of (anomalie.photos ?? [])) {
          travailSubPath.set(ph.ref, `systemes/${slug}/${ph.ref}`)
        }
      }
    }
    for (const plan of currentPlans) {
      for (const door of (plan.accessDoors ?? [])) {
        for (const ph of (door.photosPorte ?? [])) {
          travailSubPath.set(ph.ref, `portes/${ph.ref}`)
        }
      }
    }

    // ── Mapping ref → subPath pour les interventions ───────────────────────────
    const intervSubPath = new Map<string, string>()
    for (const intv of currentIntervs) {
      const apt = intv.appartement || ''
      const allIntervPh = [
        ...(intv.photosHotteAvant    ?? []),
        ...(intv.photosHotteApres    ?? []),
        ...(intv.photosSdbAvant      ?? []),
        ...(intv.photosSdbApres      ?? []),
        ...(intv.photosChgtHotteAvant ?? []),
        ...(intv.photosChgtHotteApres ?? []),
      ]
      for (const ph of allIntervPh) {
        intervSubPath.set(ph.ref, apt
          ? `interventions/${apt}/intv_${ph.ref}`
          : `interventions/intv_${ph.ref}`)
      }
    }

    const writes: Promise<void>[] = []

    // Photos de travaux
    for (const [key, dataUrl] of Object.entries(travailPhotos)) {
      const i = key.lastIndexOf('_')
      if (i !== -1) {
        const ref     = key.slice(i + 1)
        const subPath = travailSubPath.get(ref) ?? `travaux/${ref}`
        writes.push(
          writePhotoFileToDisk(dir, key.slice(0, i), subPath, dataUrl)
            .catch((e) => console.error('[FS] Sync travail', key, e))
        )
      }
    }

    // Photos d'interventions
    for (const [key, dataUrl] of Object.entries(interventionPhotos)) {
      const idx = key.indexOf('_intv_')
      if (idx !== -1) {
        const ref     = key.slice(idx + 6)
        const subPath = intervSubPath.get(ref) ?? `interventions/intv_${ref}`
        writes.push(
          writePhotoFileToDisk(dir, key.slice(0, idx), subPath, dataUrl)
            .catch((e) => console.error('[FS] Sync intervention', key, e))
        )
      }
    }

    // Images de plans → photos/plans/
    const currentPlanIds = new Set(currentPlans.map((p) => p.id))
    for (const [planId, dataUrl] of Object.entries(planImages)) {
      if (currentPlanIds.has(planId)) {
        writes.push(
          writePhotoFileToDisk(dir, pid, `plans/plan_${planId}`, dataUrl)
            .catch((e) => console.error('[FS] Sync plan', planId, e))
        )
      }
    }

    console.info('[FS] Sync initiale :', writes.length, 'fichier(s)')
    await Promise.all(writes)
    console.info('[FS] Sync initiale terminée')
  }, [])

  const handlePickDir = async () => {
    const handle = await pickSaveDirectory()
    if (!handle) return
    setSaveDir(handle)
    setActiveSaveDir(handle)
    setSyncing(true)

    const tid = toast.loading('Synchronisation du dossier en cours…')
    try {
      await syncAllPhotosToDisk(handle)
      await saveNow()
      toast.success('Dossier configuré — données synchronisées', { id: tid })
    } catch (e) {
      console.error('[FS] Erreur sync initiale', e)
      toast.error('Erreur lors de la synchronisation', { id: tid })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnectDir = () => { setSaveDir(null); setActiveSaveDir(null) }

  const drawTools = [
    { id: 'select',    icon: MousePointer2, label: 'Sélection',     group: 'nav' },
    { id: 'pan',       icon: Hand,          label: 'Déplacer',       group: 'nav' },
    { id: 'pin',       icon: MapPin,        label: 'Travail',        group: 'create' },
    { id: 'porte',     icon: DoorOpen,      label: 'Porte',          group: 'create' },
    { id: 'zone',      icon: Hexagon,       label: 'Zone conduit',   group: 'create' },
    { id: 'arrow',     icon: ArrowRight,    label: 'Flèche',         group: 'annot' },
    { id: 'rectangle', icon: Square,        label: 'Rectangle',      group: 'annot' },
    { id: 'circle',    icon: Circle,        label: 'Cercle',         group: 'annot' },
    { id: 'freehand',  icon: Edit3,         label: 'Dessin libre',   group: 'annot' },
    { id: 'measure',   icon: Ruler,         label: 'Mesure',         group: 'annot' },
    { id: 'text',      icon: Type,          label: 'Texte',          group: 'annot' },
    { id: 'note',      icon: MessageSquare, label: 'Note',           group: 'annot' },
  ] as const

  const navTools    = drawTools.filter((t) => t.group === 'nav')
  const createTools = drawTools.filter((t) => t.group === 'create')
  const annotTools  = drawTools.filter((t) => t.group === 'annot')

  const PRESET_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#000000', '#FFFFFF']

  const handleDownloadPlan = () => {
    const capture = (window as any).__captureCurrentPlan?.()
    if (!capture?.dataUrl) return
    const plan = plans.find((p) => p.id === capture.planId)
    const planName = plan?.name ?? 'plan'
    const projectName = project?.name ?? 'projet'
    const filename = `${projectName}_${planName}`.replace(/[^a-z0-9\-_]/gi, '_')
    const a = document.createElement('a')
    a.href = capture.dataUrl
    a.download = `${filename}.png`
    a.click()
  }

  const handleExport = () => {
    if (!project) return
    const data = exportProject(project.id)
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${project.name.replace(/[^a-z0-9\-_]/gi, '_')}_nettoyage.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 gap-2 flex-shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2 mr-1 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wind className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm hidden lg:block whitespace-nowrap">
            PlanPhoto Nettoyage
          </span>
        </div>

        {/* Projet actif */}
        {project && (
          <div className="text-xs border-l border-gray-200 dark:border-gray-700 pl-3 hidden sm:flex flex-col leading-tight">
            <span className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{project.name}</span>
            <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {[project.client, project.mandat].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* Outils canvas — uniquement en vue plan */}
        {currentView === 'plan' && currentPlanId && (
          <div className="flex items-center gap-0.5 ml-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
            {navTools.map((t) => (
              <ToolBtn key={t.id} tool={t} currentTool={currentTool} setCurrentTool={setCurrentTool} />
            ))}
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            {createTools.map((t) => (
              <ToolBtn key={t.id} tool={t} currentTool={currentTool} setCurrentTool={setCurrentTool} />
            ))}
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            {annotTools.map((t) => (
              <ToolBtn key={t.id} tool={t} currentTool={currentTool} setCurrentTool={setCurrentTool} />
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Actions droite */}
        <div className="flex items-center gap-1.5">

          {/* Bouton Rapport PDF — visible quand un projet est ouvert */}
          {currentProjectId && (
            <button
              onClick={() => {
                setCurrentView('report')
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('planphoto:goto-export'))
                }, 60)
              }}
              title="Générer le rapport PDF"
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:block">Rapport PDF</span>
            </button>
          )}

          {/* Télécharger le plan épinglé */}
          {currentView === 'plan' && currentPlanId && (
            <button
              onClick={handleDownloadPlan}
              title="Télécharger le plan avec épingles (PNG)"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Plan épinglé</span>
            </button>
          )}

          {/* Bouton Information Projet */}
          {currentProjectId && project && (
            <button
              onClick={() => setShowProjectInfo(true)}
              title="Informations du projet"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Info projet</span>
            </button>
          )}

          {/* Bouton Information Bâtiment */}
          {currentProjectId && project && (
            <button
              onClick={() => setShowBuildingInfo(true)}
              title="Informations du bâtiment"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Info bâtiment</span>
            </button>
          )}

          {currentProjectId && (
            <button onClick={handleExport} title="Exporter le projet (JSON)"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Exporter</span>
            </button>
          )}

          <button onClick={toggleDarkMode} title="Mode sombre"
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Groupe sauvegarde + indicateur de mode */}
          {currentProjectId && (
            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1">

              {/* Badge mode — visible en permanence */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border select-none transition-colors ${
                saveDir
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                  saveDir ? 'bg-green-500' : 'bg-amber-500'
                } ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Sync…' : saveDir ? 'Mode local' : 'Mode navigateur'}
              </div>

              {/* Enregistrer */}
              <button
                onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); saveNow() }}
                title="Sauvegarder (Ctrl+S)"
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden md:block">Enregistrer</span>
              </button>

              {/* Choix dossier */}
              {isFileSystemSupported() && (
                <button
                  onClick={saveDir ? handleDisconnectDir : handlePickDir}
                  disabled={syncing}
                  title={saveDir ? `Dossier : ${saveDir.name} — cliquer pour déconnecter` : 'Choisir un dossier de sauvegarde automatique'}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-40"
                >
                  {saveDir
                    ? <FolderCheck className="w-4 h-4 text-green-500" />
                    : <FolderOpen className="w-4 h-4" />
                  }
                </button>
              )}

              <SaveIndicator lastSaveTime={lastSaveTime} hasChanges={hasChanges} />
            </div>
          )}
        </div>
      </header>

      {/* Modal Information Projet */}
      {showProjectInfo && project && (
        <ProjectInfoModal
          project={project}
          onUpdate={(data) => updateProject(project.id, data)}
          onClose={() => setShowProjectInfo(false)}
        />
      )}

      {/* Modal Information Bâtiment */}
      {showBuildingInfo && project && (
        <BuildingInfoModal
          project={project}
          onUpdate={(data) => updateProject(project.id, data)}
          onClose={() => setShowBuildingInfo(false)}
        />
      )}
    </>
  )
}

// ── Bouton outil ──────────────────────────────────────────────────────────────
function ToolBtn({ tool, currentTool, setCurrentTool }: {
  tool:           { id: string; icon: any; label: string }
  currentTool:    string
  setCurrentTool: (t: any) => void
}) {
  const Icon = tool.icon
  return (
    <button
      onClick={() => setCurrentTool(tool.id)}
      title={tool.label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
        currentTool === tool.id
          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Utilitaire : redimensionner un logo (max 1800×900 px, PNG sans perte) ──────
async function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX_W = 1800, MAX_H = 900
        const ratio = Math.min(MAX_W / img.width, MAX_H / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Upload logo (bouton + aperçu) ─────────────────────────────────────────────
function LogoUpload({ label, value, onChange }: {
  label:    string
  value:    string | undefined
  onChange: (url: string | undefined) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await resizeLogo(file)
      onChange(url)
    } catch { /* ignore */ }
    e.target.value = ''
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="w-24 h-14 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          {value
            ? <img src={value} alt={label} className="max-w-full max-h-full object-contain p-1" />
            : <span className="text-xs text-gray-300 text-center px-1">Aucun logo</span>
          }
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors">
            {value ? 'Changer' : 'Téléverser'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(undefined)}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
              Supprimer
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

// ── Modal Information Projet ──────────────────────────────────────────────────
function ProjectInfoModal({
  project,
  onUpdate,
  onClose,
}: {
  project:  any
  onUpdate: (data: any) => void
  onClose:  () => void
}) {
  const companyLogo    = useAppStore((s) => s.companyLogo)
  const setCompanyLogo = useAppStore((s) => s.setCompanyLogo)
  const DEFAULT_TITRE = "Rapport d'intervention – Nettoyage des systèmes de ventilation"

  const [form, setForm] = useState({
    name:            project.name            ?? '',
    client:          project.client          ?? '',
    adresse:         project.adresse         ?? '',
    adresseClient:   project.adresseClient   ?? '',
    preparePar:      project.preparePar      ?? '',
    mandat:          project.mandat          ?? '',
    contrat:         project.contrat         ?? '',
    referenceClient: project.referenceClient ?? '',
    titreRapport:       project.titreRapport       ?? DEFAULT_TITRE,
    documentsConnexes:  project.documentsConnexes  ?? '',
    bonCommande:        project.bonCommande        ?? '',
    numeroRapport:      project.numeroRapport      ?? '',
    versionRapport:     project.versionRapport     ?? '',
    emisPour:           project.emisPour           ?? 'RAPPORT FINAL',
    technicien:         project.technicien         ?? '',
    verificateur:       project.verificateur       ?? '',
    verificateurTitre:  project.verificateurTitre  ?? '',
    prepareParTitre:    project.prepareParTitre    ?? '',
    dateDebut:       project.dateDebut       ?? '',
    dateFin:         project.dateFin         ?? '',
    contact:         project.contact         ?? '',
    logo:            project.logo            as string | undefined,
    logoClient:      project.logoClient      as string | undefined,
  })

  const [titreLocked, setTitreLocked] = useState(true)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSave = () => {
    onUpdate(form)
    onClose()
  }

  const fields: { key: string; label: string; type?: string }[] = [
    { key: 'name',            label: 'Nom du projet' },
    { key: 'client',          label: 'Client' },
    { key: 'adresse',         label: 'Adresse des travaux' },
    { key: 'adresseClient',   label: 'Adresse du client' },
    { key: 'mandat',          label: 'Mandat' },
    { key: 'contrat',         label: 'N° contrat SDC' },
    { key: 'referenceClient', label: 'Référence client / BT (optionnel)' },
    { key: 'titreRapport',      label: 'Titre du rapport (page de garde)' },
    { key: 'documentsConnexes', label: 'Documents connexes (ex: plans, normes…)' },
    { key: 'bonCommande',       label: 'N° bon de commande (mandat autorisé par)' },
    { key: 'numeroRapport',     label: 'N° du rapport' },
    { key: 'versionRapport',    label: 'Version du rapport' },
    { key: 'technicien',        label: 'Technicien responsable' },
    { key: 'preparePar',        label: 'Préparé par' },
    { key: 'prepareParTitre',   label: 'Titre (Préparé par)' },
    { key: 'verificateur',      label: 'Vérifié par' },
    { key: 'verificateurTitre', label: 'Titre (Vérifié par)' },
    { key: 'dateDebut',       label: 'Date de début', type: 'date' },
    { key: 'dateFin',         label: 'Date de fin',   type: 'date' },
    { key: 'contact',         label: 'Contact client' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 bg-blue-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white">Informations du projet</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-blue-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 gap-4">

            {/* Logos */}
            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100 dark:border-gray-700">
              {/* Logo entreprise — global, partagé entre tous les projets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Logo entreprise
                  </label>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700">
                    <Lock className="w-2.5 h-2.5" /> Tous projets
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-24 h-14 border-2 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${
                    companyLogo ? 'border-green-300 bg-white dark:bg-gray-800' : 'border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10'
                  }`}>
                    {companyLogo
                      ? <img src={companyLogo} alt="Logo entreprise" className="max-w-full max-h-full object-contain p-1" />
                      : <span className="text-[10px] text-amber-500 text-center px-1 leading-tight">Aucun logo</span>
                    }
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {companyLogo && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">✓ Configuré</span>
                    )}
                    <label className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                      {companyLogo ? 'Changer' : 'Téléverser'}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return
                        try { setCompanyLogo(await resizeLogo(file)) } catch { /* ignore */ }
                        e.target.value = ''
                      }} />
                    </label>
                    {companyLogo && (
                      <button type="button" onClick={() => setCompanyLogo(undefined)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <LogoUpload
                label="Logo client (optionnel)"
                value={form.logoClient}
                onChange={(url) => setForm((prev) => ({ ...prev, logoClient: url }))}
              />
            </div>

            {/* Émis pour */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Émis pour
              </label>
              <div className="flex flex-wrap gap-2">
                {['RAPPORT FINAL', 'INFORMATION', 'APPROBATION', 'CONSTRUCTION', 'SOUMISSION'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, emisPour: opt }))}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      form.emisPour === opt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Champs texte */}
            {fields.map(({ key, label, type }) => {
              if (key === 'titreRapport') {
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {label}
                      </label>
                      <button
                        type="button"
                        onClick={() => setTitreLocked((v) => !v)}
                        title={titreLocked ? 'Déverrouiller pour modifier' : 'Verrouiller'}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                          titreLocked
                            ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700'
                            : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                        }`}
                      >
                        {titreLocked
                          ? <><Lock className="w-3 h-3" /> Verrouillé</>
                          : <><Unlock className="w-3 h-3" /> Modifiable</>
                        }
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.titreRapport}
                        disabled={titreLocked}
                        onChange={set('titreRapport')}
                        className={`w-full px-3 py-2 text-sm border rounded-lg transition ${
                          titreLocked
                            ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed select-none'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-blue-300 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                      {!titreLocked && form.titreRapport !== DEFAULT_TITRE && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, titreRapport: DEFAULT_TITRE }))}
                          title="Remettre le titre par défaut"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  </div>
                )
              }
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type={type ?? 'text'}
                    value={(form as any)[key]}
                    onChange={set(key)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Information Bâtiment ────────────────────────────────────────────────
function BuildingInfoModal({
  project,
  onUpdate,
  onClose,
}: {
  project:  any
  onUpdate: (data: any) => void
  onClose:  () => void
}) {
  const [form, setForm] = useState({
    nomImmeuble:       project.nomImmeuble       ?? '',
    typeBatiment:      project.typeBatiment      ?? '',
    nbEtages:          project.nbEtages          ?? '',
    nbLogements:       project.nbLogements       ?? '',
    zonesSpecifiques:  project.zonesSpecifiques  ?? '',
    anneeConstruction: project.anneeConstruction ?? '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSave = () => { onUpdate(form); onClose() }

  const TYPES_BATIMENT = [
    'Résidentiel multilogement',
    'Commercial',
    'Institutionnel',
    'Industriel',
    'Mixte (résidentiel / commercial)',
    'Autre',
  ]

  const adresseComplete = [project.adresse, project.ville, project.codePostal].filter(Boolean).join(', ') || '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 bg-teal-600">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white">Informations du bâtiment</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-teal-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">

          {/* Champs automatiques (lecture seule) */}
          <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Depuis Info projet</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">Adresse</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{adresseComplete}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">Propriétaire / Client</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{project.client || '—'}</p>
              </div>
            </div>
          </div>

          {/* Nom de l'immeuble */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Nom de l'immeuble <span className="text-gray-400 font-normal normal-case">(si applicable)</span>
            </label>
            <input
              type="text"
              value={form.nomImmeuble}
              onChange={set('nomImmeuble')}
              placeholder="ex : Les Résidences du Parc"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          {/* Type de bâtiment */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Type de bâtiment
            </label>
            <select
              value={form.typeBatiment}
              onChange={set('typeBatiment')}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            >
              <option value="">— Sélectionner —</option>
              {TYPES_BATIMENT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Nombre d'étages + logements */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Nombre d'étages
              </label>
              <input
                type="text"
                value={form.nbEtages}
                onChange={set('nbEtages')}
                placeholder="ex : 6"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Nombre d'unités / logements
              </label>
              <input
                type="text"
                value={form.nbLogements}
                onChange={set('nbLogements')}
                placeholder="ex : 48"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          {/* Zones spécifiques */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Zones spécifiques
            </label>
            <textarea
              value={form.zonesSpecifiques}
              onChange={set('zonesSpecifiques')}
              rows={2}
              placeholder="ex : locaux techniques, salles communautaires, buanderies, parkings…"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none"
            />
          </div>

          {/* Année de construction */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Année de construction <span className="text-gray-400 font-normal normal-case">(optionnel)</span>
            </label>
            <input
              type="text"
              value={form.anneeConstruction}
              onChange={set('anneeConstruction')}
              placeholder="ex : 1975"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
