import {
  FileDown, CheckCircle, AlertTriangle, Loader2,
  Plus, Trash2, GripVertical, BookOpen, ChevronUp, ChevronDown,
  Type, List, Eye, Minus, X, Wand2, Eraser, Star,
  Search, FilePlus, Copy, Check, RefreshCw,
} from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { useTemplateStore } from '@/store/useTemplateStore'
import { generateReport } from '@/services/pdfGenerator'
import { getPlanImage } from '@/services/planImageStorage'
import { getProjectTravailPhotos } from '@/services/travailPhotoStorage'
import { getProjectInterventionPhotos } from '@/services/interventionPhotoStorage'
import type {
  ReportSectionType, EquipmentListReportSection, ObservationsReportSection, TextReportSection,
  ObservationItem, ObservationSeverity,
} from '@/types'
import { ANOMALIE_LABELS } from '@/types'
import RichTextEditor from '@/components/RichTextEditor'
import { REPORT_GABARIT_NADCA, REPORT_GABARIT_OMHM } from '@/data/reportGabarit'
import { applyTemplateVariables, hasVariables } from '@/utils/templateVars'
import { buildProjectReport } from '@/utils/reportBuilder'
import type { ReportSection } from '@/types'
import type { ParagraphTemplate, TemplateCategory } from '@/types/templates'
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_COLORS } from '@/types/templates'

type TabId = 'builder' | 'export'

const OMHM_ANOMALIES_PREDEFINIES: { id: string; text: string; severity: 'info' | 'attention' | 'critique' }[] = [
  { id: 'vent-fin-vie',  text: "Ventilateur en fin de vie — bruit de roulement ou vibration anormale",                         severity: 'attention' },
  { id: 'vent-toit',    text: "Ventilateur de toiture défectueux — débit insuffisant ou bruit anormal",                       severity: 'attention' },
  { id: 'conduit-end',  text: "Conduit endommagé — déformation, perforation ou joint défectueux réduisant l'étanchéité",      severity: 'attention' },
  { id: 'volet-cf',     text: "Volet coupe-feu non fonctionnel — bloqué en position ouverte ou fermée",                       severity: 'critique'  },
  { id: 'humidite',     text: "Condensation ou traces d'humidité dans les conduits ou les composantes",                       severity: 'attention' },
  { id: 'no-trappe',    text: "Absence de trappe d'accès — section de conduit non accessible pour nettoyage complet",         severity: 'info'      },
  { id: 'filtre-colm',  text: "Filtre colmaté, encrassé ou absent",                                                           severity: 'attention' },
  { id: 'debit-insuf',  text: "Débit d'extraction insuffisant — ventilateur sous-performant",                                 severity: 'attention' },
  { id: 'graisse',      text: "Accumulation de graisse importante dans la hotte ou les conduits d'extraction de cuisine",     severity: 'attention' },
  { id: 'flex-sdb',     text: "Conduit flexible endommagé ou déconnecté (salle de bain)",                                     severity: 'attention' },
  { id: 'grille-obs',   text: "Grille ou diffuseur obstrué, endommagé ou absent",                                             severity: 'info'      },
  { id: 'corrosion',    text: "Corrosion visible sur conduits ou composantes mécaniques",                                     severity: 'attention' },
]

function AutosaveIndicator({ dirty }: { dirty: boolean }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!dirty) { setSaved(true); const t = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(t) }
  }, [dirty])
  if (dirty) return <span className="text-xs text-yellow-500 animate-pulse">Sauvegarde…</span>
  if (saved) return <span className="text-xs text-green-500">✓ Sauvegardé</span>
  return null
}

function SectionCard({ children, onDelete, onUp, onDown, isFirst, isLast, dragProps, isSubtitle }: {
  children: React.ReactNode
  onDelete: () => void; onUp: () => void; onDown: () => void
  isFirst: boolean; isLast: boolean
  dragProps: React.HTMLAttributes<HTMLDivElement>
  isSubtitle?: boolean
}) {
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${
      isSubtitle
        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-500'
        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
    }`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${
        isSubtitle ? 'border-blue-100 dark:border-blue-800 bg-blue-100/60 dark:bg-blue-900/20' : 'border-gray-50 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-750'
      }`}>
        <div {...dragProps} className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 transition-colors" title="Réordonner">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onUp} disabled={isFirst} className="p-1 rounded text-gray-400 hover:text-blue-600 disabled:opacity-25 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={onDown} disabled={isLast} className="p-1 rounded text-gray-400 hover:text-blue-600 disabled:opacity-25 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Panel bibliothèque inline (même contenu que TemplateLibraryView) ───────────

function LibraryPanel({
  open, onClose, project,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  project: { id: string } & Record<string, unknown> | undefined
  onInsert: (t: ParagraphTemplate, type: 'chapter' | 'subtitle' | 'text') => void
}) {
  const templates      = useTemplateStore((s) => s.templates)
  const toggleFavorite = useTemplateStore((s) => s.toggleFavorite)
  const [search,     setSearch]     = useState('')
  const [category,   setCategory]   = useState<TemplateCategory | 'all'>('all')
  const [favOnly,    setFavOnly]    = useState(false)
  const [preview,    setPreview]    = useState(true)
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!open) return null

  const filtered = templates.filter((t) => {
    if (favOnly && !t.isFavorite) return false
    if (category !== 'all' && t.category !== category) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q))
    }
    return true
  })

  function handleCopy(t: ParagraphTemplate) {
    const html = (preview && project && hasVariables(t.content))
      ? applyTemplateVariables(t.content, project as any)
      : t.content
    navigator.clipboard.writeText(html).then(() => {
      setCopiedId(t.id)
      toast.success('Copié')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const cats: (TemplateCategory | 'all')[] = ['all', ...Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="font-bold text-gray-900 dark:text-gray-100 flex-1 text-sm">Bibliothèque de modèles</span>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">{templates.length}</span>
          <button onClick={() => setPreview(!preview)}
            title={preview ? 'Afficher HTML brut' : 'Afficher avec données projet'}
            className={`p-1.5 rounded text-xs flex items-center gap-1 ${preview ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { onClose(); window.setAppView('templates') }}
            title="Gérer la bibliothèque complète (ajouter, modifier, supprimer)"
            className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        {/* Filters */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {cats.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                {cat === 'all' ? 'Tous' : TEMPLATE_CATEGORY_LABELS[cat as TemplateCategory]}
              </button>
            ))}
            <button onClick={() => setFavOnly(!favOnly)}
              className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${favOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
              <Star className="w-3 h-3" /> Favoris
            </button>
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              Aucun modèle trouvé
            </div>
          ) : filtered.map((t) => {
            const content  = (preview && project && hasVariables(t.content))
              ? applyTemplateVariables(t.content, project as any)
              : t.content
            const isExpanded = expandedId === t.id
            const plainText  = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            return (
              <div key={t.id} className="border-b border-gray-50 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                {/* Titre + badges */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex-1 leading-snug">{t.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${TEMPLATE_CATEGORY_COLORS[t.category]}`}>
                    {TEMPLATE_CATEGORY_LABELS[t.category]}
                  </span>
                  <button onClick={() => toggleFavorite(t.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-yellow-100 transition-all flex-shrink-0">
                    <Star className={`w-3 h-3 ${t.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                  </button>
                  <button onClick={() => handleCopy(t)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all flex-shrink-0">
                    {copiedId === t.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  </button>
                </div>

                {/* Description */}
                {t.description && <p className="text-[10px] text-gray-400 mb-1.5">{t.description}</p>}

                {/* Contenu — réduit ou étendu */}
                <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                  {isExpanded ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none border border-gray-100 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800"
                      dangerouslySetInnerHTML={{ __html: content }} />
                  ) : (
                    <p className="line-clamp-2 text-gray-500">{plainText}</p>
                  )}
                </div>

                {/* Voir contenu + boutons insertion */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {isExpanded
                      ? <><ChevronUp className="w-3 h-3" />Réduire</>
                      : <><ChevronDown className="w-3 h-3" />Voir le contenu</>}
                  </button>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => { onInsert(t, 'chapter'); onClose() }}
                      title="Nouveau chapitre principal (1. 2. 3.)"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors">
                      <Minus className="w-3 h-3" /> Chapitre
                    </button>
                    <button onClick={() => { onInsert(t, 'subtitle'); onClose() }}
                      title="Sous-section numérotée sous le chapitre précédent (1.1, 1.2…)"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
                      <ChevronDown className="w-3 h-3" /> Sous-titre
                    </button>
                    <button onClick={() => { onInsert(t, 'text'); onClose() }}
                      title="Paragraphe pur sans en-tête"
                      className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                      <FilePlus className="w-3 h-3" /> Sans titre
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ReportView() {
  const [tab, setTab]           = useState<TabId>('builder')
  const [loading, setLoading]   = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [omhmPickerSectionId, setOmhmPickerSectionId] = useState<string | null>(null)
  const [omhmPickerSelected,  setOmhmPickerSelected]  = useState<Set<string>>(new Set())

  // Écouter le raccourci "Rapport PDF" de la TopBar
  useEffect(() => {
    const handler = () => setTab('export')
    window.addEventListener('planphoto:goto-export', handler)
    return () => window.removeEventListener('planphoto:goto-export', handler)
  }, [])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const dragIdRef = useRef<string | null>(null)
  const dropIdRef = useRef<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project      = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const companyLogo  = useAppStore((s) => s.companyLogo)
  const plans        = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const allTravaux      = useAppStore((s) => {
    const planIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) => t.planId ? planIds.has(t.planId) : t.projectId === s.currentProjectId)
  })
  const allZones        = useAppStore((s) => s.zones.filter((z) => plans.map((p) => p.id).includes(z.planId)))
  const allInterventions = useAppStore((s) => s.interventions.filter((i) => i.projectId === currentProjectId))
  const reportSections = useAppStore((s) => s.reportSections)
  const setCurrentPlan = useAppStore((s) => s.setCurrentPlan)
  const savedPlanId    = useAppStore((s) => s.currentPlanId)

  const reportGabaritType  = useAppStore((s) => s.reportGabaritType)
  const setReportGabaritType = useAppStore((s) => s.setReportGabaritType)
  const setReportSections     = useAppStore((s) => s.setReportSections)
  const addReportSection      = useAppStore((s) => s.addReportSection)
  const updateReportSection   = useAppStore((s) => s.updateReportSection)
  const removeReportSection   = useAppStore((s) => s.removeReportSection)
  const moveReportSection     = useAppStore((s) => s.moveReportSection)
  const addEquipmentItem      = useAppStore((s) => s.addEquipmentItem)
  const updateEquipmentItem   = useAppStore((s) => s.updateEquipmentItem)
  const removeEquipmentItem   = useAppStore((s) => s.removeEquipmentItem)
  const addObservationItem    = useAppStore((s) => s.addObservationItem)
  const updateObservationItem = useAppStore((s) => s.updateObservationItem)
  const removeObservationItem = useAppStore((s) => s.removeObservationItem)

  const touch = useCallback(() => { setDirty(true); setTimeout(() => setDirty(false), 800) }, [])

  function handleAddSection(type: ReportSectionType) {
    addReportSection(type)
    touch()
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  function handleClearReport() {
    if (!window.confirm('Vider entièrement le rapport ? Cette action est irréversible.')) return
    setReportSections([])
    setReportGabaritType(null)
    touch()
  }

  if (!project) return <div className="p-8 text-center text-gray-400">Aucun projet sélectionné.</div>

  const total    = allTravaux.length
  const done     = allTravaux.filter((t) => t.statut === 'complete' || t.statut === 'valide').length
  const allDone  = done === total && total > 0

  // ── Export PDF ──────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!project) return
    setLoading(true)
    try {
      const captureFunc = window.__captureCurrentPlan

      const planImages: Record<string, string> = {}

      if (captureFunc && plans.length > 0) {
        for (const plan of plans) {
          // Basculer sur ce plan et attendre que le canvas soit prêt
          setCurrentPlan(plan.id)
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 1500)
            const handler = (e: Event) => {
              if ((e as CustomEvent<string>).detail === plan.id) {
                clearTimeout(timeout)
                window.removeEventListener('planphoto:plan-ready', handler)
                resolve()
              }
            }
            window.addEventListener('planphoto:plan-ready', handler)
          })
          const result = captureFunc()
          if (result?.dataUrl) {
            planImages[plan.id] = result.dataUrl
          } else {
            const img = await getPlanImage(plan.id)
            if (img) planImages[plan.id] = img
          }
        }
        // Restaurer le plan d'origine
        if (savedPlanId) setCurrentPlan(savedPlanId)
      } else {
        for (const plan of plans) {
          const img = await getPlanImage(plan.id)
          if (img) planImages[plan.id] = img
        }
      }

      // Images brutes depuis IndexedDB pour l'annexe portes d'accès
      const rawPlanImages: Record<string, string> = {}
      for (const plan of plans) {
        if ((plan.accessDoors?.length ?? 0) > 0) {
          const img = await getPlanImage(plan.id)
          if (img) rawPlanImages[plan.id] = img
        }
      }

      const travailPhotos      = await getProjectTravailPhotos(project.id)
      const interventionPhotos = await getProjectInterventionPhotos(project.id)
      const sortedInterventions = [...allInterventions].sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      )
      // Injecter le logo entreprise global (priorité sur project.logo)
      const projectWithLogo = companyLogo ? { ...project, logo: companyLogo } : project
      // Les sections sont DÉJÀ le rapport final (peuplées par applyGabarit ou applyStaticGabarit).
      // On ne régénère pas buildReport ici — cela écraserait le gabarit NADCA avec du data-driven.
      const rawSections: ReportSection[] = reportSections.length > 0
        ? reportSections
        : ((project as any)?.reportSections ?? [])
      // Numérotation automatique appliquée à l'export (sans modifier le store)
      const nums = computeSectionNumbers(rawSections)
      const finalSections = rawSections.map((s, i) =>
        s.title?.trim()
          ? { ...s, title: `${nums[i]} ${stripLeadingNumber(s.title.trim())}` }
          : s
      )
      await generateReport(
        projectWithLogo, plans, allTravaux, finalSections as ReportSection[], planImages, travailPhotos, allZones,
        sortedInterventions, interventionPhotos, rawPlanImages,
      )
      toast.success('Rapport exporté avec succès')
    } catch (err) {
      toast.error('Erreur lors de la génération du rapport')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  function makeDragProps(id: string) {
    return {
      draggable: true,
      onDragStart: () => { dragIdRef.current = id },
      onDragOver:  (e: React.DragEvent) => { e.preventDefault(); dropIdRef.current = id },
      onDrop: () => {
        const from = dragIdRef.current, to = dropIdRef.current
        if (!from || !to || from === to) return
        const fi = reportSections.findIndex((s) => s.id === from)
        const ti = reportSections.findIndex((s) => s.id === to)
        if (fi < 0 || ti < 0) return
        const diff = ti - fi
        if (diff > 0) for (let i = 0; i < diff; i++) moveReportSection(from, 'down')
        else          for (let i = 0; i < -diff; i++) moveReportSection(from, 'up')
        touch()
      },
    }
  }

  // ── Gabarit NADCA complet ───────────────────────────────────────────────────

  function applyGabarit() {
    if (reportSections.length > 0 &&
        !window.confirm('Cela remplacera le contenu actuel du rapport. Continuer ?')) return

    const nanoidFn = () => Math.random().toString(36).slice(2, 11)
    const dynamic = buildProjectReport(project!, allTravaux, plans)
    const sections: ReportSection[] = dynamic.map((g) => {
      const id = nanoidFn()
      if (g.type === 'subtitle') return { id, type: 'subtitle', title: g.title }
      if (g.type === 'equipment_list') return { id, type: 'equipment_list', title: g.title, items: [] }
      if (g.type === 'observations')   return { id, type: 'observations',   title: g.title, items: [] }
      const content = g.content ? applyTemplateVariables(g.content, project!) : ''
      return { id, type: 'text', title: g.title, content }
    })
    setReportSections(sections)
    setReportGabaritType('data-driven')
    touch()
    toast.success(`Rapport généré — ${sections.length} sections`)
  }

  // ── Gabarit NADCA statique (modèle générique) ──────────────────────────────

  function applyStaticGabarit() {
    if (reportSections.length > 0 &&
        !window.confirm('Cela remplacera le contenu actuel du rapport. Continuer ?')) return

    const nanoidFn = () => Math.random().toString(36).slice(2, 11)
    const sections: ReportSection[] = REPORT_GABARIT_NADCA.map((g) => {
      const id = nanoidFn()
      if (g.type === 'subtitle') return { id, type: 'subtitle', title: g.title }
      if (g.type === 'equipment_list') return { id, type: 'equipment_list', title: g.title, items: [] }
      if (g.type === 'observations')   return { id, type: 'observations',   title: g.title, items: [] }
      const content = g.content ? applyTemplateVariables(g.content, project!) : ''
      return { id, type: 'text', title: g.title, content }
    })
    setReportSections(sections)
    setReportGabaritType('nadca-static')
    touch()
    toast.success(`Gabarit NADCA appliqué — ${sections.length} sections créées`)
  }

  // ── Gabarit OMHM — helpers ────────────────────────────────────────────────

  function buildOmhmDynamic(interventions: typeof allInterventions) {
    const fmt = (d: string) => d
      ? new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'

    // Absences : uniquement la case "Absent" cochée dans le rapport d'intervention
    const absents = interventions.filter((i) => i.absentDeuxiemeAvis === true)

    // Table absences
    let absencesHtml: string
    if (absents.length === 0) {
      absencesHtml = '<p>Aucune absence de locataire enregistrée lors des interventions.</p>'
    } else {
      const rows = absents.map((i) => {
        const apt  = i.appartement || '—'
        const d1   = fmt(i.date || '')
        const d2   = i.dateDeuxiemeAvis ? fmt(i.dateDeuxiemeAvis) : '—'
        const abs2 = i.absentDeuxiemeAvis ? 'Absent' : 'Non traité'
        return `<tr><td>${apt}</td><td>${d1}</td><td>${d2}</td><td>${abs2}</td></tr>`
      }).join('')
      absencesHtml = `<p>Les logements suivants n'ont pu être traités lors des visites effectuées en raison de l'absence du locataire :</p>
<table>
  <thead><tr><th>Appartement</th><th>Date 1re visite</th><th>Date 2e visite</th><th>Statut 2e visite</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>Ces unités devront faire l'objet d'une planification pour les prochaines interventions.</p>`
    }

    // Dénominateur : nbLogements (Info bâtiment) en priorité, sinon nombre d'interventions saisies
    const nbLogementsInfo = parseInt(project?.nbLogements || '0') || 0
    const totalLogements  = nbLogementsInfo > 0 ? nbLogementsInfo : interventions.length

    // Nettoyés = lignes d'intervention non-absentes
    // Le rapport d'intervention trace le travail par photos, pas par hotteStatut.
    // Une ligne créée et non-absente = logement visité et nettoyé.
    const absentsSet = new Set(absents.map((i) => i.id))
    const nonAbsents = interventions.filter((i) => !absentsSet.has(i.id))
    const hotteOk    = nonAbsents.length
    const sdbOk      = nonAbsents.length

    // Changements de hottes : tracké par replHotte30 / replHotte24 (boutons dans le rapport d'intervention)
    const changtOk = interventions.filter((i) => i.replHotte30 !== null || i.replHotte24 !== null)
    const hotte30  = changtOk.filter((i) => i.replHotte30 !== null).length
    const hotte24  = changtOk.filter((i) => i.replHotte24 !== null).length

    let statsHtml: string
    if (totalLogements === 0) {
      statsHtml = `<!-- BEGIN_OMHM_STATS --><p><em>Renseignez le <strong>nombre de logements</strong> dans Info bâtiment pour afficher les statistiques complètes.</em></p><!-- END_OMHM_STATS -->`
    } else {
      const lignes = [
        `<li>Hottes de cuisine nettoyées : <strong>${hotteOk} / ${totalLogements} logement(s)</strong></li>`,
        `<li>Hottes de cuisine changées : <strong>${changtOk.length} unité(s)</strong>${hotte30 > 0 ? ` · ${hotte30}×30"` : ''}${hotte24 > 0 ? ` · ${hotte24}×24"` : ''}</li>`,
        `<li>Salles de bain nettoyées : <strong>${sdbOk} / ${totalLogements} logement(s)</strong></li>`,
        absents.length > 0
          ? `<li>Absences enregistrées : <strong>${absents.length} logement(s)</strong> — voir section 5.2</li>`
          : `<li>Aucune absence enregistrée lors des interventions</li>`,
      ].filter(Boolean).join('\n  ')
      statsHtml = `<!-- BEGIN_OMHM_STATS --><p><strong>Interventions dans les logements :</strong></p>\n<ul>\n  ${lignes}\n</ul><!-- END_OMHM_STATS -->`
    }

    // Tableau des remplacements de hottes (section 4.1)
    const replDetail = (v: string | null): string => {
      if (!v) return '—'
      if (v === 'hotte')    return 'Hotte'
      if (v === 'filtres')  return 'Filtres'
      if (v === 'les_deux') return 'Hotte + Filtres'
      return v
    }
    const changements = interventions.filter((i) => i.replHotte30 !== null || i.replHotte24 !== null)
    let changementsHtml: string
    if (changements.length === 0) {
      changementsHtml = '<p>Aucun remplacement de hotte de cuisine effectué lors de cette intervention.</p>'
    } else {
      const rows = changements.map((i) => {
        const apt  = i.appartement || '—'
        const h30  = replDetail(i.replHotte30)
        const h24  = replDetail(i.replHotte24)
        const note = i.notes?.trim() || '—'
        return `<tr><td>${apt}</td><td>${h30}</td><td>${h24}</td><td>${note}</td></tr>`
      }).join('')
      changementsHtml = `<table>
  <thead><tr><th>Appartement</th><th>Hotte 30"</th><th>Hotte 24"</th><th>Observations</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`
    }

    // ── Observations / anomalies ────────────────────────────────────────────
    const severityOf: Record<string, ObservationSeverity> = {
      corrosion: 'critique', moisissure: 'critique', fuite: 'critique',
      deformation: 'attention', obstruction: 'attention', autre: 'info',
    }
    const anomalyItems:  ObservationItem[] = []
    const remarqueItems: ObservationItem[] = []

    // Source 1 : anomalies et remarques relevées sur les travaux
    for (const t of allTravaux) {
      const sys        = project?.systemes?.find((s: any) => s.id === t.systemeId)
      const sysNom     = sys?.nom || `Système #${t.numero}`
      const ref        = `T-${String(t.numero).padStart(2, '0')}`
      const location   = [t.location, t.zoneDesservie].filter(Boolean).join(', ')
      const composante = t.typeComposante ? String(t.typeComposante) : ''

      for (const a of (t.anomalies || [])) {
        const desc = [ANOMALIE_LABELS[a.type] ?? a.type, a.description].filter(Boolean).join(' — ')
        anomalyItems.push({
          id:       `trav_${t.id}_${a.id}`,
          ref,
          text:     [sysNom, composante, location, desc].filter(Boolean).join('\n'),
          photos:   a.photos.map((p: any) => p.url).filter(Boolean),
          severity: severityOf[a.type] ?? 'info',
        })
      }
      if (t.observationsAvant?.trim()) {
        remarqueItems.push({
          id: `trav_${t.id}_av`, ref,
          text: [sysNom, composante, location, `Avant : ${t.observationsAvant.trim()}`].filter(Boolean).join('\n'),
          photos: [], severity: 'info',
        })
      }
      if (t.observationsApres?.trim()) {
        remarqueItems.push({
          id: `trav_${t.id}_ap`, ref,
          text: [sysNom, composante, location, `Après : ${t.observationsApres.trim()}`].filter(Boolean).join('\n'),
          photos: [], severity: 'info',
        })
      }
    }

    // Source 2 : notes par appartement (rapport d'intervention)
    for (const i of interventions) {
      if (i.notes?.trim()) {
        remarqueItems.push({
          id:       `intv_${i.id}`,
          ref:      i.appartement || '',
          text:     `Appartement ${i.appartement || '—'}\n${i.notes.trim()}`,
          photos:   [],
          severity: 'info',
        })
      }
    }

    const observationItems = [...anomalyItems, ...remarqueItems]
    return { absencesHtml, statsHtml, changementsHtml, observationItems }
  }

  // ── Rafraîchir les stats OMHM (sans recréer tout le rapport) ──────────────

  function refreshOmhmStats() {
    const { absencesHtml, statsHtml, changementsHtml, observationItems } = buildOmhmDynamic(allInterventions)
    const updated = reportSections.map((s) => {
      if (s.type === 'text') {
        let c = (s as any).content as string
        c = c.replace(/<!--\s*BEGIN_OMHM_STATS\s*-->[\s\S]*?<!--\s*END_OMHM_STATS\s*-->/g, statsHtml)
        if (s.title?.includes('Locataires absents'))      c = absencesHtml
        if (s.title?.includes('Remplacements de hottes')) c = changementsHtml
        return { ...s, content: c }
      }
      if (s.type === 'observations' && s.title?.includes('Constats')) return { ...s, items: observationItems }
      return s
    })
    setReportSections(updated as ReportSection[])
    touch()
    toast.success('Stats OMHM actualisées')
  }

  // ── Gabarit OMHM ──────────────────────────────────────────────────────────

  function applyOmhmGabarit() {
    if (reportSections.length > 0 &&
        !window.confirm('Cela remplacera le contenu actuel du rapport. Continuer ?')) return

    const { absencesHtml, statsHtml, changementsHtml, observationItems } = buildOmhmDynamic(allInterventions)
    const nid = () => Math.random().toString(36).slice(2, 11)

    const sections: ReportSection[] = REPORT_GABARIT_OMHM.map((g) => {
      const id = nid()
      if (g.type === 'subtitle')       return { id, type: 'subtitle',       title: g.title }
      if (g.type === 'equipment_list') return { id, type: 'equipment_list', title: g.title, items: [] }
      if (g.type === 'observations') {
        const items = g.title?.includes('Constats') ? observationItems : []
        return { id, type: 'observations', title: g.title, items }
      }
      let content = g.content ? applyTemplateVariables(g.content, project!) : ''
      content = content.replace('{{absences_tableau}}',   absencesHtml)
      content = content.replace('{{interventions_resume}}', statsHtml)
      content = content.replace('{{changements_tableau}}', changementsHtml)
      return { id, type: 'text', title: g.title, content }
    })
    setReportSections(sections)
    setReportGabaritType('omhm-static')
    touch()
    toast.success(`Gabarit OMHM appliqué — ${sections.length} sections créées`)
  }

  // ── Insertion depuis la bibliothèque ────────────────────────────────────────

  function handleLibraryInsert(t: ParagraphTemplate, sectionType: 'chapter' | 'subtitle' | 'text') {
    const content = (project && hasVariables(t.content))
      ? applyTemplateVariables(t.content, project as any)
      : t.content
    const mkId = () => `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const toAdd =
      sectionType === 'chapter'
        ? [
            { id: mkId(), type: 'subtitle' as const, title: t.title },
            ...(content.replace(/<[^>]+>/g, '').trim()
              ? [{ id: mkId(), type: 'text' as const, title: '', content }]
              : []),
          ]
        : sectionType === 'subtitle'
          ? [{ id: mkId(), type: 'text' as const, title: t.title, content }]
          : [{ id: mkId(), type: 'text' as const, title: '',      content }]
    setReportSections([...reportSections, ...toAdd])
    touch()
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
    const label = sectionType === 'chapter' ? 'chapitre' : sectionType === 'subtitle' ? 'sous-titre' : 'sans titre'
    toast.success(`"${t.title}" inséré (${label})`)
  }

  // ── Numérotation hiérarchique ───────────────────────────────────────────────

  function computeSectionNumbers(sections: ReportSection[]): string[] {
    let chapter = 0, sub = 0
    return sections.map((s) => {
      if (s.type === 'subtitle') { chapter++; sub = 0; return `${chapter}.` }
      const hasTitle = (s as any).title?.trim()
      if (hasTitle) { sub++; return chapter > 0 ? `${chapter}.${sub}` : `${sub}.` }
      return ''
    })
  }

  function stripLeadingNumber(title: string): string {
    return title.replace(/^\d+(\.\d+)*\.?\s+/, '')
  }

  const sectionNumbers = computeSectionNumbers(reportSections)

  const TYPE_META: Record<ReportSectionType, { icon: React.ReactNode; label: string; color: string }> = {
    subtitle:       { icon: <Minus className="w-3.5 h-3.5" />,  label: 'Sous-titre',       color: 'bg-purple-100 text-purple-700' },
    text:           { icon: <Type className="w-3.5 h-3.5" />,   label: 'Texte libre',       color: 'bg-blue-100 text-blue-700' },
    equipment_list: { icon: <List className="w-3.5 h-3.5" />,   label: 'Liste équipements', color: 'bg-green-100 text-green-700' },
    observations:   { icon: <Eye className="w-3.5 h-3.5" />,    label: 'Observations',      color: 'bg-orange-100 text-orange-700' },
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs header */}
      <div className="flex-none px-6 pt-5 pb-0 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-6 mb-0">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-xl mr-4">Rapport</h2>
          {(['builder', 'export'] as TabId[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t === 'builder' ? 'Rapport écrit' : 'Exporter PDF'}
            </button>
          ))}
          <div className="ml-auto pb-3"><AutosaveIndicator dirty={dirty} /></div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">

        {/* ── BUILDER ──────────────────────────────────────────────────────── */}
        {tab === 'builder' && (
          <div className="p-6 max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {(['subtitle', 'text', 'equipment_list', 'observations'] as ReportSectionType[]).map((type) => {
                const m = TYPE_META[type]
                return (
                  <button key={type} onClick={() => handleAddSection(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${m.color} hover:opacity-80`}>
                    <Plus className="w-3 h-3" />{m.icon}{m.label}
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={applyGabarit}
                  title="Rapport construit à partir des données réelles du projet (sections conditionnelles)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    reportGabaritType === 'data-driven'
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}>
                  <Wand2 className="w-3.5 h-3.5" /> Rapport data-driven
                </button>
                <button onClick={applyStaticGabarit}
                  title="Gabarit NADCA complet avec toutes les sections (modèle générique)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    reportGabaritType === 'nadca-static'
                      ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  }`}>
                  <Wand2 className="w-3.5 h-3.5" /> Gabarit NADCA complet
                </button>
                <button onClick={applyOmhmGabarit}
                  title="Rapport d'intervention récurrent pour les immeubles OMHM — concis, orienté résultats"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    reportGabaritType === 'omhm-static'
                      ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                  }`}>
                  <Wand2 className="w-3.5 h-3.5" /> Gabarit OMHM
                </button>
                {reportGabaritType === 'omhm-static' && reportSections.length > 0 && (
                  <button onClick={refreshOmhmStats}
                    title="Recalcule les absences et les stats d'interventions depuis les données actuelles"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualiser les données
                  </button>
                )}
                {reportSections.length > 0 && (
                  <>
                    <button onClick={handleClearReport}
                      title="Vider entièrement le rapport"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Eraser className="w-3.5 h-3.5" /> Vider
                    </button>
                  </>
                )}
                <button onClick={() => setLibraryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" /> Bibliothèque de modèles
                </button>
              </div>
            </div>

            {reportSections.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Aucune section — ajoutez un bloc ou insérez un modèle.</p>
              </div>
            )}

            {reportSections.map((sec, idx) => {
              const isFirst = idx === 0, isLast = idx === reportSections.length - 1
              const m = TYPE_META[sec.type]
              const num = sectionNumbers[idx]
              return (
                <SectionCard key={sec.id} isFirst={isFirst} isLast={isLast}
                  onDelete={() => { removeReportSection(sec.id); touch() }}
                  onUp={() => { moveReportSection(sec.id, 'up'); touch() }}
                  onDown={() => { moveReportSection(sec.id, 'down'); touch() }}
                  dragProps={makeDragProps(sec.id)}
                  isSubtitle={sec.type === 'subtitle'}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono font-bold text-gray-300 min-w-[28px]">{num}</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${m.color}`}>
                      {m.icon} {m.label}
                    </span>
                    {sec.type === 'text' && (
                      <button onClick={() => setLibraryOpen(true)}
                        className="ml-auto text-xs text-amber-600 hover:underline flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Bibliothèque
                      </button>
                    )}
                  </div>

                  {sec.type === 'subtitle' && (
                    <input value={sec.title}
                      onChange={(e) => { updateReportSection(sec.id, { title: e.target.value }); touch() }}
                      placeholder="Titre de section…"
                      className="w-full px-3 py-2 text-base font-bold text-blue-700 border-0 border-b-2 border-blue-200 focus:border-blue-500 focus:outline-none bg-transparent"
                    />
                  )}

                  {sec.type === 'text' && (() => {
                    const txtContent = (sec as TextReportSection).content ?? ''
                    const hasTable   = txtContent.includes('<table')
                    return (
                      <div className="space-y-2">
                        <input value={sec.title}
                          onChange={(e) => { updateReportSection(sec.id, { title: e.target.value }); touch() }}
                          placeholder="Titre (optionnel)…"
                          className="w-full px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        {hasTable ? (
                          <div className="rounded-xl border border-blue-200 bg-blue-50/40 overflow-x-auto">
                            <p className="text-[10px] text-blue-500 px-3 pt-2 pb-1 font-medium">
                              Tableau généré depuis Systèmes CVAC — modifiable dans le menu Systèmes
                            </p>
                            <div className="px-3 pb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_thead_tr]:bg-blue-600 [&_th]:text-white [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1.5 [&_tbody_tr:nth-child(even)]:bg-white [&_tbody_tr:nth-child(odd)]:bg-gray-50"
                              dangerouslySetInnerHTML={{ __html: txtContent }} />
                          </div>
                        ) : (
                          <RichTextEditor
                            content={txtContent}
                            onChange={(json) => { updateReportSection(sec.id, { content: json } as any); touch() }}
                            placeholder="Rédigez votre contenu…"
                          />
                        )}
                      </div>
                    )
                  })()}

                  {sec.type === 'equipment_list' && (() => {
                    const eq = sec as EquipmentListReportSection
                    return (
                      <div className="space-y-3">
                        <input value={sec.title}
                          onChange={(e) => { updateReportSection(sec.id, { title: e.target.value }); touch() }}
                          placeholder="Titre de la liste…"
                          className="w-full px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        {eq.items.length > 0 && (
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-xs border-collapse table-fixed min-w-[560px]">
                              <colgroup>
                                <col className="w-[16%]" />
                                <col className="w-[20%]" />
                                <col className="w-[14%]" />
                                <col className="w-[12%]" />
                                <col />
                                <col className="w-[32px]" />
                              </colgroup>
                              <thead>
                                <tr className="bg-blue-50">
                                  {['Système', 'Composante', 'Zone', 'État', 'Observations', ''].map((h, i) => (
                                    <th key={i} className="px-2 py-1.5 text-left font-semibold text-blue-700 border-b border-blue-100 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {eq.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                                    {(['systeme', 'composante', 'zone', 'etat', 'observations'] as const).map((field) => (
                                      <td key={field} className="border-r border-gray-100 last:border-r-0">
                                        <input value={item[field]}
                                          onChange={(e) => { updateEquipmentItem(sec.id, item.id, { [field]: e.target.value }); touch() }}
                                          className="w-full px-2 py-1 text-xs focus:outline-none focus:bg-blue-50"
                                        />
                                      </td>
                                    ))}
                                    <td className="border border-gray-100 px-1">
                                      <button onClick={() => { removeEquipmentItem(sec.id, item.id); touch() }}
                                        className="p-0.5 text-gray-300 hover:text-red-400 transition-colors">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button onClick={() => { addEquipmentItem(sec.id); touch() }}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                        </button>
                      </div>
                    )
                  })()}

                  {sec.type === 'observations' && (() => {
                    const obs = sec as ObservationsReportSection
                    const SEV: Record<string, string> = {
                      info:      'bg-blue-100 text-blue-700 border-blue-200',
                      attention: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                      critique:  'bg-red-100 text-red-700 border-red-200',
                    }
                    return (
                      <div className="space-y-3">
                        <input value={sec.title}
                          onChange={(e) => { updateReportSection(sec.id, { title: e.target.value }); touch() }}
                          placeholder="Titre des observations…"
                          className="w-full px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        {obs.items.map((item) => (
                          <div key={item.id} className={`border rounded-xl overflow-hidden ${SEV[item.severity]}`}>
                            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-current/10">
                              {item.ref && (
                                <span className="text-xs font-bold bg-white/60 border border-current/30 rounded px-1.5 py-0.5 font-mono shrink-0">
                                  {item.ref}
                                </span>
                              )}
                              <select value={item.severity}
                                onChange={(e) => { updateObservationItem(sec.id, item.id, { severity: e.target.value as any }); touch() }}
                                className="text-xs border border-current/30 rounded-lg px-2 py-1 bg-white/80 focus:outline-none">
                                <option value="info">Info</option>
                                <option value="attention">Attention</option>
                                <option value="critique">Critique</option>
                              </select>
                              <button onClick={() => { removeObservationItem(sec.id, item.id); touch() }}
                                className="ml-auto p-1 rounded hover:bg-white/50 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <textarea value={item.text}
                              onChange={(e) => { updateObservationItem(sec.id, item.id, { text: e.target.value }); touch() }}
                              placeholder="Décrivez l'observation…" rows={2}
                              className="w-full text-sm px-3 py-2 border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-current/30 resize-none"
                            />
                          </div>
                        ))}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => { addObservationItem(sec.id); touch() }}
                            className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Ajouter une observation
                          </button>
                          {reportGabaritType === 'omhm-static' && (
                            <button
                              onClick={() => {
                                setOmhmPickerSelected(new Set())
                                setOmhmPickerSectionId(omhmPickerSectionId === sec.id ? null : sec.id)
                              }}
                              className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 rounded-lg px-2 py-1 transition-colors">
                              <List className="w-3.5 h-3.5" /> Anomalies courantes OMHM
                            </button>
                          )}
                        </div>
                        {omhmPickerSectionId === sec.id && (
                          <div className="border border-teal-200 rounded-xl p-3 bg-teal-50 dark:bg-teal-950/20 space-y-2">
                            <p className="text-xs font-semibold text-teal-700">Sélectionner les anomalies applicables :</p>
                            {OMHM_ANOMALIES_PREDEFINIES.map((a) => (
                              <label key={a.id} className="flex items-start gap-2 cursor-pointer">
                                <input type="checkbox"
                                  checked={omhmPickerSelected.has(a.id)}
                                  onChange={(e) => {
                                    const next = new Set(omhmPickerSelected)
                                    e.target.checked ? next.add(a.id) : next.delete(a.id)
                                    setOmhmPickerSelected(next)
                                  }}
                                  className="mt-0.5 accent-teal-600"
                                />
                                <span className={`text-xs ${
                                  a.severity === 'critique'  ? 'text-red-700'    :
                                  a.severity === 'attention' ? 'text-yellow-700' : 'text-blue-700'
                                }`}>{a.text}</span>
                              </label>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => {
                                  const sélectionnées = OMHM_ANOMALIES_PREDEFINIES.filter((a) => omhmPickerSelected.has(a.id))
                                  const obsSection = reportSections.find((s) => s.id === sec.id) as any
                                  const existingItems = obsSection?.items ?? []
                                  const newItems = sélectionnées.map((a) => ({
                                    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${a.id}`,
                                    text: a.text,
                                    severity: a.severity,
                                    photos: [],
                                  }))
                                  updateReportSection(sec.id, { items: [...existingItems, ...newItems] } as any)
                                  setOmhmPickerSectionId(null)
                                  touch()
                                  toast.success(`${sélectionnées.length} anomalie(s) ajoutée(s)`)
                                }}
                                disabled={omhmPickerSelected.size === 0}
                                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors">
                                Ajouter la sélection ({omhmPickerSelected.size})
                              </button>
                              <button onClick={() => setOmhmPickerSectionId(null)}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </SectionCard>
              )
            })}
          </div>
        )}

        {/* ── EXPORT ──────────────────────────────────────────────────────── */}
        {tab === 'export' && (
          <div className="p-6 max-w-2xl mx-auto space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Vérification avant export</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {[
                  { label: 'Projet configuré (client)',         ok: !!project.client },
                  { label: 'Au moins un plan importé',          ok: plans.length > 0 },
                  { label: 'Au moins un travail épinglé',       ok: total > 0 },
                  { label: 'Travaux complétés',                 ok: allDone, warn: !allDone && total > 0, info: `${done}/${total}` },
                  { label: 'Rapport écrit rédigé',              ok: reportSections.length > 0, warn: reportSections.length === 0 },
                  { label: 'Systèmes CVAC définis',             ok: project.systemes.length > 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 px-5 py-3">
                    {item.ok
                      ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      : item.warn
                      ? <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    }
                    <span className={`text-sm ${item.ok ? 'text-gray-700 dark:text-gray-300' : item.warn ? 'text-yellow-700' : 'text-red-600'}`}>
                      {item.label}
                    </span>
                    {item.info && <span className="text-xs text-gray-400 ml-auto">{item.info}</span>}
                    {!item.ok && !item.warn && <span className="text-xs text-red-400 ml-auto">Requis</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Contenu du rapport PDF</h3>
              </div>
              <div className="px-5 py-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {[
                  'Page de couverture SDC',
                  `Rapport écrit (${reportSections.length} section${reportSections.length !== 1 ? 's' : ''})`,
                  `Plans mécaniques annotés avec cartouche (${plans.length} plan${plans.length !== 1 ? 's' : ''})`,
                  'Sommaire des nettoyages par système',
                  `Fiches détaillées avant/après par travail (${total} travaux)`,
                  'Page de signatures',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleExport}
              disabled={loading || total === 0}
              className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
              {loading ? 'Génération en cours…' : 'Télécharger le rapport PDF'}
            </button>
          </div>
        )}
      </div>

      <LibraryPanel
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        project={project as any}
        onInsert={(t, type) => handleLibraryInsert(t, type as 'chapter' | 'subtitle' | 'text')}
      />
    </div>
  )
}
