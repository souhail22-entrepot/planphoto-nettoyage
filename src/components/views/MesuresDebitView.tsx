import { useRef, useState, useCallback, useEffect } from 'react'
import { Plus, Upload, Trash2, Wind, X, Check, Move, FileDown, Hand, RefreshCw, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { TYPE_POINT_DEBIT, METHODE_MESURE_LABELS, type TypePointDebit, type UniteDebit, type PointDebit, type MethodeMesure, type Systeme } from '@/types'
import { generateDebitReport } from '@/services/debitPdfGenerator'
import { savePlanImage } from '@/services/planImageStorage'

// ── Constantes ───────────────────────────────────────────────────────────────

const ABBR_COUNT_KEY: Record<TypePointDebit, string> = {
  diffuseur:  'D',
  reprise:    'R',
  extraction: 'G',
}

const INPUT = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const LABEL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

// ── Panneau d'édition latéral ────────────────────────────────────────────────

interface EditPanelProps {
  point: PointDebit
  unite: UniteDebit
  systemes: Systeme[]
  onClose: () => void
  onSave: (data: Partial<PointDebit>) => void
  onDelete: () => void
}

function EditPanel({ point, unite, systemes, onClose, onSave, onDelete }: EditPanelProps) {
  const [form, setForm] = useState({
    identifiant:  point.identifiant,
    type:         point.type,
    local:        point.local,
    systemeId:    point.systemeId  ?? '',
    debitAvant:   point.debitAvant?.toString() ?? '',
    debitApres:   point.debitApres?.toString() ?? '',
    dateAvant:    point.dateAvant  ?? '',
    dateApres:    point.dateApres  ?? '',
    conditions:   point.conditions ?? '',
    methode:      point.methode    ?? '' as MethodeMesure | '',
    observations: point.observations ?? '',
  })

  useEffect(() => {
    setForm({
      identifiant:  point.identifiant,
      type:         point.type,
      local:        point.local,
      systemeId:    point.systemeId  ?? '',
      debitAvant:   point.debitAvant?.toString() ?? '',
      debitApres:   point.debitApres?.toString() ?? '',
      dateAvant:    point.dateAvant  ?? '',
      dateApres:    point.dateApres  ?? '',
      conditions:   point.conditions ?? '',
      methode:      point.methode    ?? '' as MethodeMesure | '',
      observations: point.observations ?? '',
    })
  }, [point.id])

  function handleSave() {
    onSave({
      identifiant:  form.identifiant.trim() || point.identifiant,
      type:         form.type as TypePointDebit,
      local:        form.local.trim(),
      systemeId:    form.systemeId  || undefined,
      debitAvant:   form.debitAvant !== '' ? parseFloat(form.debitAvant) : undefined,
      debitApres:   form.debitApres !== '' ? parseFloat(form.debitApres) : undefined,
      dateAvant:    form.dateAvant  || undefined,
      dateApres:    form.dateApres  || undefined,
      conditions:   form.conditions.trim() || undefined,
      methode:      (form.methode as MethodeMesure) || undefined,
      observations: form.observations.trim() || undefined,
    })
  }

  const color = TYPE_POINT_DEBIT[form.type as TypePointDebit].color

  // Statut complétude
  const avantOk = form.debitAvant !== ''
  const apresOk = form.debitApres !== ''
  const statut  = avantOk && apresOk ? 'complet' : avantOk || apresOk ? 'partiel' : 'vide'
  const statutConfig = {
    complet: { label: 'Complet',         cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    partiel: { label: 'Avant seulement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    vide:    { label: 'Non mesuré',      cls: 'bg-gray-100  text-gray-500  dark:bg-gray-800      dark:text-gray-500'  },
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
            style={{ background: color }}>
            {form.identifiant}
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">Point de mesure</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${statutConfig[statut].cls}`}>
            {statutConfig[statut].label}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Formulaire */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Identifiant + Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Identifiant</label>
            <input className={INPUT} value={form.identifiant}
              onChange={(e) => setForm({ ...form, identifiant: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select className={INPUT} value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TypePointDebit })}>
              {(Object.entries(TYPE_POINT_DEBIT) as [TypePointDebit, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Système */}
        {systemes.length > 0 && (
          <div>
            <label className={LABEL}>Système CVAC</label>
            <select className={INPUT} value={form.systemeId}
              onChange={(e) => setForm({ ...form, systemeId: e.target.value })}>
              <option value="">— Aucun —</option>
              {systemes.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}{s.description ? ` — ${s.description}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Local */}
        <div>
          <label className={LABEL}>Local / Zone</label>
          <input className={INPUT} placeholder="ex. Bureau 201, Cuisine, Hall" value={form.local}
            onChange={(e) => setForm({ ...form, local: e.target.value })} />
        </div>

        {/* Méthode */}
        <div>
          <label className={LABEL}>Méthode de mesure</label>
          <select className={INPUT} value={form.methode}
            onChange={(e) => setForm({ ...form, methode: e.target.value as MethodeMesure | '' })}>
            <option value="">— Non spécifiée —</option>
            {(Object.entries(METHODE_MESURE_LABELS) as [MethodeMesure, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Débit avant */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avant nettoyage</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Débit ({unite})</label>
              <input type="number" min="0" step="0.1" className={INPUT} placeholder="—"
                value={form.debitAvant}
                onChange={(e) => setForm({ ...form, debitAvant: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={INPUT} value={form.dateAvant}
                onChange={(e) => setForm({ ...form, dateAvant: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Débit après */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Après nettoyage</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Débit ({unite})</label>
              <input type="number" min="0" step="0.1" className={INPUT} placeholder="—"
                value={form.debitApres}
                onChange={(e) => setForm({ ...form, debitApres: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={INPUT} value={form.dateApres}
                onChange={(e) => setForm({ ...form, dateApres: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <label className={LABEL}>Conditions de mesure</label>
          <input className={INPUT} placeholder="ex: filtre neuf, vitesse fan 100%, porte fermée"
            value={form.conditions}
            onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
        </div>

        {/* Observations */}
        <div>
          <label className={LABEL}>Observations</label>
          <textarea className={`${INPUT} resize-none`} rows={2} value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })} />
        </div>
      </div>

      {/* Pied */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <button onClick={() => { onDelete(); onClose() }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer
        </button>
        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Check className="w-3.5 h-3.5" />
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────────

export default function MesuresDebitView() {
  const currentProjectId  = useAppStore((s) => s.currentProjectId)
  const plansDebit        = useAppStore((s) => s.plansDebit.filter((p) => p.projectId === s.currentProjectId))
  const pointsDebit       = useAppStore((s) => s.pointsDebit.filter((p) => p.projectId === s.currentProjectId))
  const addPlanDebit      = useAppStore((s) => s.addPlanDebit)
  const updatePlanDebit   = useAppStore((s) => s.updatePlanDebit)
  const deletePlanDebit   = useAppStore((s) => s.deletePlanDebit)
  const addPointDebit     = useAppStore((s) => s.addPointDebit)
  const updatePointDebit  = useAppStore((s) => s.updatePointDebit)
  const deletePointDebit  = useAppStore((s) => s.deletePointDebit)
  const companyLogo       = useAppStore((s) => s.companyLogo)

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [editingPoint, setEditingPoint]     = useState<PointDebit | null>(null)
  const [isAddMode, setIsAddMode]           = useState(false)
  const [isBurstMode, setIsBurstMode]       = useState(false)
  const [burstSystemeId, setBurstSystemeId] = useState('')
  const [burstType, setBurstType]           = useState<TypePointDebit>('diffuseur')
  const [burstMethode, setBurstMethode]     = useState<MethodeMesure | ''>('')
  const [unite, setUnite]                   = useState<UniteDebit>('CFM')
  const [uploading, setUploading]           = useState(false)
  const [replacingId, setReplacingId]       = useState<string | null>(null)
  const [exporting, setExporting]           = useState(false)
  const [scale, setScale]     = useState(1)
  const [isPanMode, setIsPanMode] = useState(false)
  const isPanningCanvas           = useRef(false)
  const project  = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const systemes = project?.systemes ?? []

  const fileInputRef     = useRef<HTMLInputElement>(null)
  const replaceInputRef  = useRef<HTMLInputElement>(null)
  const planContainerRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef    = useRef<HTMLDivElement>(null)
  const scaleRef         = useRef(1)  // valeur courante sans dépendance de closure

  // Sync scaleRef
  useEffect(() => { scaleRef.current = scale }, [scale])

  // Pin dragging state
  const draggingRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const currentPlan = plansDebit.find((p) => p.id === selectedPlanId) ?? plansDebit[0] ?? null
  const planPoints  = pointsDebit.filter((p) => p.planDebitId === currentPlan?.id)

  // Synchronise selectedPlanId si le plan sélectionné n'existe plus
  useEffect(() => {
    if (!plansDebit.find((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(plansDebit[0]?.id ?? null)
    }
  }, [plansDebit, selectedPlanId])

  // Réinitialise zoom + scroll au changement de plan
  useEffect(() => {
    setScale(1)
    if (canvasAreaRef.current) {
      canvasAreaRef.current.scrollLeft = 0
      canvasAreaRef.current.scrollTop  = 0
    }
  }, [currentPlan?.id])

  // Zoom molette centré sur le curseur — utilise le scroll natif
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const el = canvasAreaRef.current
    if (!el) return
    const prev   = scaleRef.current
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const next   = Math.max(0.15, Math.min(8, prev * factor))
    const rect   = el.getBoundingClientRect()
    const mx     = e.clientX - rect.left
    const my     = e.clientY - rect.top
    // Point du contenu sous le curseur avant zoom
    const cx = el.scrollLeft + mx
    const cy = el.scrollTop  + my
    // Après zoom, ce point doit rester sous le curseur
    const newScrollX = cx * (next / prev) - mx
    const newScrollY = cy * (next / prev) - my
    setScale(next)
    requestAnimationFrame(() => {
      if (canvasAreaRef.current) {
        canvasAreaRef.current.scrollLeft = Math.max(0, newScrollX)
        canvasAreaRef.current.scrollTop  = Math.max(0, newScrollY)
      }
    })
  }, [])  // stable — lit scaleRef, pas scale

  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, plansDebit.length > 0])

  // ── Drag-to-pan (outil main) ──────────────────────────────────────────────
  const handleCanvasPanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanMode || e.button !== 0) return
    e.preventDefault()
    const el = canvasAreaRef.current
    if (!el) return
    isPanningCanvas.current = true
    const startX = e.clientX + el.scrollLeft
    const startY = e.clientY + el.scrollTop
    const onMove = (me: MouseEvent) => {
      el.scrollLeft = startX - me.clientX
      el.scrollTop  = startY - me.clientY
    }
    const onUp = () => {
      isPanningCanvas.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [isPanMode])

  // ── Auto-generate identifiant ─────────────────────────────────────────────

  function nextIdentifiant(type: TypePointDebit, planId: string): string {
    const prefix = ABBR_COUNT_KEY[type]
    // Lit l'état frais du store (pas la valeur de pointsDebit capturée par la closure du
    // callback appelant) — sinon des clics successifs en mode "Ajout multiple" recalculent
    // toujours le même numéro car le callback n'est pas recréé entre deux clics.
    const existingNums = useAppStore.getState().pointsDebit
      .filter((p) => p.planDebitId === planId && p.identifiant.startsWith(prefix + '-'))
      .map((p) => parseInt(p.identifiant.slice(prefix.length + 1), 10))
      .filter((n) => !isNaN(n))
    const max = existingNums.length > 0 ? Math.max(...existingNums) : 0
    return `${prefix}-${String(max + 1).padStart(2, '0')}`
  }

  // ── Upload plan ───────────────────────────────────────────────────────────

  async function handleFileUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file || !currentProjectId) return
    setUploading(true)
    try {
      if (file.type === 'application/pdf') {
        const pages   = await readAllPdfPages(file)
        let firstId: string | null = null
        for (const page of pages) {
          const dims = await getImageDimensions(page.imageData)
          const id   = await addPlanDebit({
            projectId: currentProjectId,
            name:      page.name,
            width:     dims.w,
            height:    dims.h,
            imageData: page.imageData,
          })
          if (!firstId) firstId = id
        }
        if (firstId) setSelectedPlanId(firstId)
        toast.success(`${pages.length} page${pages.length > 1 ? 's importées' : ' importée'}`)
      } else {
        const imageData = await readFileAsDataURL(file, false)
        const dims      = await getImageDimensions(imageData)
        const id = await addPlanDebit({
          projectId: currentProjectId,
          name:      file.name.replace(/\.[^.]+$/, ''),
          width:     dims.w,
          height:    dims.h,
          imageData,
        })
        setSelectedPlanId(id)
        toast.success('Plan ajouté')
      }
    } catch {
      toast.error('Erreur lors du chargement du plan')
    } finally {
      setUploading(false)
    }
  }

  // ── Remplacer l'image d'un plan existant (image perdue en IndexedDB) ──────
  // Conserve le même planDebitId → les points de mesure déjà placés restent liés.

  async function handleReplaceImage(planId: string, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setReplacingId(planId)
    try {
      const isPdf = file.type === 'application/pdf'
      const imageData = isPdf ? await readFileAsDataURL(file, true) : await readFileAsDataURL(file, false)
      const dims = await getImageDimensions(imageData)
      await savePlanImage(planId, imageData)
      updatePlanDebit(planId, { url: imageData, width: dims.w, height: dims.h })
      toast.success('Plan restauré')
    } catch {
      toast.error('Erreur lors du remplacement du plan')
    } finally {
      setReplacingId(null)
    }
  }

  // ── Click on plan canvas → add pin ───────────────────────────────────────

  const handlePlanClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddMode && !isBurstMode) { setEditingPoint(null); return }
    if (!currentPlan || !currentProjectId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width)  * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100

    if (isBurstMode) {
      // Ajout multiple : place le point avec système + type présélectionnés,
      // ne touche ni au panneau d'édition ni au mode (reste actif pour le prochain clic)
      addPointDebit({
        planDebitId:  currentPlan.id,
        projectId:    currentProjectId,
        identifiant:  nextIdentifiant(burstType, currentPlan.id),
        type:         burstType,
        local:        '',
        x,
        y,
        unite,
        systemeId:    burstSystemeId || undefined,
        methode:      burstMethode || undefined,
      })
      return
    }

    const id = addPointDebit({
      planDebitId:  currentPlan.id,
      projectId:    currentProjectId,
      identifiant:  nextIdentifiant('diffuseur', currentPlan.id),
      type:         'diffuseur',
      local:        '',
      x,
      y,
      unite,
    })
    const newPoint = useAppStore.getState().pointsDebit.find((p) => p.id === id)
    if (newPoint) setEditingPoint(newPoint)
    setIsAddMode(false)
  }, [isAddMode, isBurstMode, burstType, burstSystemeId, burstMethode, currentPlan, currentProjectId, unite, addPointDebit])

  // ── Pin drag / click ──────────────────────────────────────────────────────
  // Click court (< 5px de mouvement) → ouvre le panneau
  // Drag (> 5px) → déplace le point, ne ouvre pas le panneau

  const handlePinMouseDown = useCallback((e: React.MouseEvent, point: PointDebit) => {
    e.stopPropagation()
    e.preventDefault()
    if (isPanMode) return
    const container = planContainerRef.current
    if (!container) return
    const rect    = container.getBoundingClientRect()
    const startX  = e.clientX
    const startY  = e.clientY
    let moved     = false

    draggingRef.current = { id: point.id, startX, startY, origX: point.x, origY: point.y }

    const onMove = (me: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      if (!moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) moved = true
      if (moved) {
        const nx = Math.max(0, Math.min(100, point.x + (dx / rect.width)  * 100))
        const ny = Math.max(0, Math.min(100, point.y + (dy / rect.height) * 100))
        updatePointDebit(draggingRef.current.id, { x: nx, y: ny })
      }
    }

    const onUp = () => {
      draggingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!moved) setEditingPoint(point)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [updatePointDebit, isPanMode])

  // ── Suppression + renumérotation automatique ──────────────────────────────

  const handleDeletePoint = useCallback((point: PointDebit) => {
    deletePointDebit(point.id)
    // Après suppression, retrier les points du même type sur le même plan et réassigner
    const prefix = ABBR_COUNT_KEY[point.type]
    const remaining = useAppStore.getState().pointsDebit
      .filter((p) => p.planDebitId === point.planDebitId && p.type === point.type)
      .sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))
    remaining.forEach((p, i) => {
      const newLabel = `${prefix}-${String(i + 1).padStart(2, '0')}`
      if (p.identifiant !== newLabel) updatePointDebit(p.id, { identifiant: newLabel })
    })
  }, [deletePointDebit, updatePointDebit])

  // ── Touche Delete → supprimer le point sélectionné ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!editingPoint) return
      handleDeletePoint(editingPoint)
      setEditingPoint(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingPoint, handleDeletePoint])

  // ── Table calculations ────────────────────────────────────────────────────

  const sortedPoints = [...pointsDebit].sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))
  const totalAvant   = sortedPoints.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totalApres   = sortedPoints.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  const pointsMesures = sortedPoints.filter((p) => p.debitAvant !== undefined && p.debitApres !== undefined)
  const variationMoy  = pointsMesures.length > 0
    ? pointsMesures.reduce((s, p) => {
        const v = p.debitAvant ? ((p.debitApres! - p.debitAvant) / p.debitAvant) * 100 : 0
        return s + v
      }, 0) / pointsMesures.length
    : null

  if (!currentProjectId) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Wind className="w-5 h-5 text-blue-500" />
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">Mesures de débit d'air</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Unité */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
            {(['CFM', 'L/s'] as UniteDebit[]).map((u) => (
              <button key={u} onClick={() => setUnite(u)}
                className={`px-3 py-1.5 transition-colors ${unite === u ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {u}
              </button>
            ))}
          </div>
          {/* Télécharger PDF */}
          {plansDebit.length > 0 && (
            <button
              disabled={exporting}
              onClick={async () => {
                if (!project) return
                setExporting(true)
                try {
                  // Capture chaque plan avec ses épingles (image fidèle à l'écran)
                  const planImages: Record<string, string> = {}
                  for (const plan of plansDebit) {
                    const pts = pointsDebit.filter((p) => p.planDebitId === plan.id)
                    const img = await capturePlanForReport(plan, pts)
                    if (img) planImages[plan.id] = img
                  }
                  // Injecter le logo entreprise global (priorité sur project.logo), comme le rapport de nettoyage
                  const projectWithLogo = companyLogo ? { ...project, logo: companyLogo } : project
                  await generateDebitReport(projectWithLogo, plansDebit, pointsDebit, unite, systemes, planImages)
                  toast.success('Rapport exporté')
                } catch {
                  toast.error('Erreur lors de l\'export')
                } finally {
                  setExporting(false)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <FileDown className="w-3.5 h-3.5" />
              {exporting ? 'Génération…' : 'Télécharger PDF'}
            </button>
          )}
          {/* Ajouter un plan */}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Chargement…' : 'Ajouter un plan'}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
          onChange={(e) => { handleFileUpload(e.target.files); e.target.value = '' }} />
      </div>

      {plansDebit.length === 0 ? (
        /* État vide */
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 dark:text-gray-600">
          <Wind className="w-16 h-16 opacity-20" />
          <p className="text-lg font-semibold">Aucun plan de mesure</p>
          <p className="text-sm text-center max-w-xs">Importez un plan (PNG, JPG) pour commencer à épingler les grilles et diffuseurs.</p>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
            <Upload className="w-4 h-4" />
            Importer un plan
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Panneau gauche — plan + épingles */}
          <div className="flex flex-col flex-1 overflow-hidden border-r border-gray-100 dark:border-gray-800">

            {/* Onglets plans */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto flex-shrink-0">
              {plansDebit.map((p) => (
                <button key={p.id} onClick={() => setSelectedPlanId(p.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    p.id === currentPlan?.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {p.name}
                  {p.id === currentPlan?.id && (
                    <>
                      <span
                        title="Remplacer l'image du plan"
                        onClick={(e) => { e.stopPropagation(); setReplacingId(p.id); replaceInputRef.current?.click() }}
                        className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">
                        <RefreshCw className={`w-3 h-3 ${replacingId === p.id ? 'animate-spin' : ''}`} />
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); if (window.confirm(`Supprimer le plan "${p.name}" ?`)) deletePlanDebit(p.id) }}
                        className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">×</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            <input ref={replaceInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
              onChange={(e) => { if (replacingId) handleReplaceImage(replacingId, e.target.files); e.target.value = '' }} />

            {/* Barre d'outils canvas */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              {/* Outil ajouter point */}
              <button onClick={() => { setIsAddMode(!isAddMode); setIsPanMode(false); setIsBurstMode(false) }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isAddMode ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <Plus className="w-3.5 h-3.5" />
                {isAddMode ? 'Cliquez sur le plan…' : 'Ajouter un point'}
              </button>

              {/* Outil ajout multiple — système + type présélectionnés, plusieurs clics successifs */}
              <button onClick={() => { setIsBurstMode(!isBurstMode); setIsAddMode(false); setIsPanMode(false) }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isBurstMode ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <Layers className="w-3.5 h-3.5" />
                {isBurstMode ? 'Cliquez plusieurs fois…' : 'Ajout multiple'}
              </button>
              {isBurstMode && (
                <>
                  {systemes.length > 0 && (
                    <select value={burstSystemeId} onChange={(e) => setBurstSystemeId(e.target.value)}
                      className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                      <option value="">— Système —</option>
                      {systemes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                  )}
                  <select value={burstType} onChange={(e) => setBurstType(e.target.value as TypePointDebit)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                    {(Object.entries(TYPE_POINT_DEBIT) as [TypePointDebit, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <select value={burstMethode} onChange={(e) => setBurstMethode(e.target.value as MethodeMesure | '')}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                    <option value="">— Méthode —</option>
                    {(Object.entries(METHODE_MESURE_LABELS) as [MethodeMesure, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </>
              )}

              <span className="text-[10px] text-gray-400 ml-1 flex items-center gap-1">
                <Move className="w-3 h-3" />
                Cliquez pour modifier
              </span>
              {/* Zoom + Main */}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setScale((s) => Math.min(8, s * 1.2))}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">+</button>
                <button
                  onClick={() => {
                    setScale(1)
                    if (canvasAreaRef.current) { canvasAreaRef.current.scrollLeft = 0; canvasAreaRef.current.scrollTop = 0 }
                  }}
                  className="px-2 h-6 rounded border border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[42px]">
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={() => setScale((s) => Math.max(0.15, s / 1.2))}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">−</button>
                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                <button
                  title="Outil main — glisser pour déplacer le plan"
                  onClick={() => { setIsPanMode((v) => !v); setIsAddMode(false); setIsBurstMode(false) }}
                  className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                    isPanMode
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}>
                  <Hand className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas — overflow:auto donne les barres de défilement natives */}
            <div
              ref={canvasAreaRef}
              className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950"
              style={{
                cursor: isPanMode
                  ? (isPanningCanvas.current ? 'grabbing' : 'grab')
                  : (isAddMode || isBurstMode) ? 'crosshair' : 'default',
              }}
              onMouseDown={handleCanvasPanStart}
            >
              {currentPlan?.url ? (
                <div style={{ padding: '12px', display: 'inline-block', minWidth: '100%', minHeight: '100%' }}>
                  <div
                    ref={planContainerRef}
                    onClick={handlePlanClick}
                    style={{
                      position: 'relative',
                      width:  `${Math.round((currentPlan.width  || 800) * scale)}px`,
                      height: `${Math.round((currentPlan.height || 600) * scale)}px`,
                    }}
                  >
                    <img
                      src={currentPlan.url}
                      alt={currentPlan.name}
                      draggable={false}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', userSelect: 'none' }}
                    />
                    {planPoints.map((point) => {
                      const info = TYPE_POINT_DEBIT[point.type]
                      return (
                        <div
                          key={point.id}
                          style={{ position: 'absolute', left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -100%)', zIndex: 10 }}
                          onMouseDown={(e) => handlePinMouseDown(e, point)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ cursor: 'pointer' }}>
                            <div style={{
                              background: info.color,
                              color: '#fff',
                              borderRadius: '999px 999px 0 999px',
                              transform: 'rotate(45deg)',
                              width: 32, height: 32,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                              border: '2px solid white',
                            }}>
                              <span style={{ transform: 'rotate(-45deg)', fontSize: 9, fontWeight: 700, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                                {point.identifiant}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : currentPlan ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 text-sm">
                  <p>Image du plan introuvable — elle a peut-être été effacée du stockage local.</p>
                  <button
                    disabled={replacingId === currentPlan.id}
                    onClick={() => { setReplacingId(currentPlan.id); replaceInputRef.current?.click() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${replacingId === currentPlan.id ? 'animate-spin' : ''}`} />
                    {replacingId === currentPlan.id ? 'Restauration…' : 'Remplacer le plan'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Panneau droit — édition ou tableau */}
          <div className="w-[360px] flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800">

            {editingPoint ? (
              <EditPanel
                key={editingPoint.id}
                point={editingPoint}
                unite={unite}
                systemes={systemes}
                onClose={() => setEditingPoint(null)}
                onSave={(data) => updatePointDebit(editingPoint.id, data)}
                onDelete={() => handleDeletePoint(editingPoint)}
              />
            ) : (
            <>
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Relevés — {sortedPoints.length} point{sortedPoints.length > 1 ? 's' : ''}
              </span>
              {/* mini légende statut */}
              {sortedPoints.length > 0 && (() => {
                const complets = sortedPoints.filter(p => p.debitAvant !== undefined && p.debitApres !== undefined).length
                const partiels = sortedPoints.filter(p => (p.debitAvant !== undefined) !== (p.debitApres !== undefined)).length
                return (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>{complets}</span>
                    {partiels > 0 && <span className="flex items-center gap-1 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>{partiels}</span>}
                    {sortedPoints.length - complets - partiels > 0 && <span className="flex items-center gap-1 text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"/>{sortedPoints.length - complets - partiels}</span>}
                  </div>
                )
              })()}
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    {['', 'ID', 'Local', 'Avant', 'Après', 'Écart'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedPoints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                        Aucun point — activez « Ajouter un point » et cliquez sur le plan
                      </td>
                    </tr>
                  ) : sortedPoints.map((pt) => {
                    const info    = TYPE_POINT_DEBIT[pt.type]
                    const ecart   = (pt.debitAvant !== undefined && pt.debitApres !== undefined) ? pt.debitApres - pt.debitAvant : null
                    const variation = (pt.debitAvant && ecart !== null) ? (ecart / pt.debitAvant) * 100 : null
                    const avantOk = pt.debitAvant !== undefined
                    const apresOk = pt.debitApres !== undefined
                    const statutDot = avantOk && apresOk ? 'bg-green-500' : avantOk || apresOk ? 'bg-amber-400' : 'bg-gray-300'
                    const isSelected = editingPoint?.id === pt.id
                    return (
                      <tr key={pt.id}
                        onClick={() => setEditingPoint(pt)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        {/* Statut dot */}
                        <td className="pl-3 pr-1 py-1.5 w-4">
                          <span className={`w-2 h-2 rounded-full inline-block ${statutDot}`} title={avantOk && apresOk ? 'Complet' : avantOk || apresOk ? 'Partiel' : 'Non mesuré'} />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: info.color }} />
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{pt.identifiant}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 max-w-[80px] truncate">{pt.local || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-700 dark:text-gray-300">
                          {pt.debitAvant !== undefined ? pt.debitAvant.toFixed(0) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-700 dark:text-gray-300">
                          {pt.debitApres !== undefined ? pt.debitApres.toFixed(0) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {ecart !== null ? (
                            <span className={ecart >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {ecart >= 0 ? '+' : ''}{ecart.toFixed(0)}
                              {variation !== null && <span className="text-[10px] ml-1 opacity-70">({variation >= 0 ? '+' : ''}{variation.toFixed(0)}%)</span>}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {sortedPoints.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-800/60 border-t-2 border-gray-200 dark:border-gray-700">
                    <tr>
                      <td colSpan={3} className="px-2 py-2 font-semibold text-xs text-gray-700 dark:text-gray-300">
                        TOTAL
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {totalAvant.toFixed(0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {totalApres.toFixed(0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">
                        <span className={(totalApres - totalAvant) >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {(totalApres - totalAvant) >= 0 ? '+' : ''}{(totalApres - totalAvant).toFixed(0)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-2 pb-2 pt-1">
                        <div className="flex items-center gap-3">
                          {(Object.entries(TYPE_POINT_DEBIT) as [TypePointDebit, { label: string; color: string; abbr: string }][]).map(([k, v]) => (
                            <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
                              <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                              {v.abbr} — {v.label}
                            </span>
                          ))}
                          <span className="ml-auto flex items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-1 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>Complet</span>
                            <span className="flex items-center gap-1 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Partiel</span>
                            <span className="flex items-center gap-1 text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"/>Vide</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 1600, h: 900 })
    img.src = dataUrl
  })
}

async function readAllPdfPages(file: File): Promise<{ imageData: string; name: string }[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const arrayBuffer = await file.arrayBuffer()
  const pdf      = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const pages: { imageData: string; name: string }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page   = await pdf.getPage(i)
    const vp     = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width  = vp.width
    canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    pages.push({
      imageData: canvas.toDataURL('image/png'),
      name:      pdf.numPages > 1 ? `${baseName} — p.${i}` : baseName,
    })
  }
  return pages
}

async function readFileAsDataURL(file: File, isPdf: boolean): Promise<string> {
  if (!isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  // PDF : conversion première page via pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const arrayBuffer = await file.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page   = await pdf.getPage(1)
  const vp     = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width  = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
  return canvas.toDataURL('image/png')
}

// Capture le plan + épingles sur canvas → image pour le rapport PDF
// Les labels trop proches sont décalés avec une ligne de repère (leader line)
async function capturePlanForReport(plan: PlanDebit, points: PointDebit[]): Promise<string | null> {
  if (!plan.url) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const OUT_W = 2000
      const OUT_H = Math.round(OUT_W * img.naturalHeight / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width  = OUT_W
      canvas.height = OUT_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, OUT_W, OUT_H)

      // Position réelle de chaque épingle (centre du plan, %)
      const pins = points.map((pt) => ({
        pt,
        info: TYPE_POINT_DEBIT[pt.type],
        cx: (pt.x / 100) * OUT_W,
        cy: (pt.y / 100) * OUT_H,
      }))

      // Trier haut→bas, gauche→droite pour priorité de placement stable
      pins.sort((a, b) => a.cy - b.cy || a.cx - b.cx)

      // Rayon du cercle-label dynamique — basé sur la densité réelle des points sur CE plan,
      // pour rester lisible et bien placé sans se chevaucher ni cacher le plan quand il y a
      // beaucoup de points rapprochés (zones denses de diffuseurs/grilles).
      const R_MAX = Math.round(OUT_W * 0.020)  // taille "confortable" (~7mm à l'échelle PDF), peu de points
      const R_MIN = Math.round(OUT_W * 0.009)  // plancher lisible, plans très denses
      let R = R_MAX
      if (pins.length > 1) {
        const nearestDists = pins.map((p, i) => {
          let min = Infinity
          for (let j = 0; j < pins.length; j++) {
            if (j === i) continue
            const d = Math.hypot(pins[j].cx - p.cx, pins[j].cy - p.cy)
            if (d < min) min = d
          }
          return min
        }).sort((a, b) => a - b)
        // 25e percentile : reflète les zones les plus denses sans être dicté par un seul point isolé
        const p25 = nearestDists[Math.floor(nearestDists.length * 0.25)]
        R = Math.round(Math.min(R_MAX, Math.max(R_MIN, p25 * 0.4)))
      }

      // Centres déjà occupés par des labels
      const placed: { x: number; y: number }[] = []

      // Cherche la première position non-chevauchante pour le label.
      // Le cercle est TOUJOURS décalé (jamais posé sur le diffuseur).
      function findLabelPos(cx: number, cy: number): { lx: number; ly: number } {
        const minDist = R * 2.4
        const overlaps = (lx: number, ly: number) =>
          placed.some((p) => Math.hypot(p.x - lx, p.y - ly) < minDist)

        // Partir d'un décalage minimum de 1.5R — jamais à la position exacte
        const angles = [270, 90, 0, 180, 315, 225, 45, 135]  // haut prioritaire
        for (let d = Math.round(R * 1.5); d <= R * 14; d += Math.round(R * 1.8)) {
          for (const deg of angles) {
            const rad = deg * Math.PI / 180
            const lx = cx + Math.cos(rad) * d
            const ly = cy + Math.sin(rad) * d
            if (lx >= R && lx <= OUT_W - R && ly >= R && ly <= OUT_H - R && !overlaps(lx, ly)) {
              return { lx, ly }
            }
          }
        }
        return { lx: cx + R * 2, ly: cy }  // fallback
      }

      // Phase 1 — tracer les lignes de repère (sous les cercles pour ne pas les cacher)
      const labelPositions = pins.map(({ cx, cy }) => {
        const { lx, ly } = findLabelPos(cx, cy)
        placed.push({ x: lx, y: ly })
        return { lx, ly }
      })

      // Réinitialiser placed pour re-passer au même ordre pendant le dessin
      placed.length = 0
      for (const { lx, ly } of labelPositions) placed.push({ x: lx, y: ly })

      // Lignes de repère (dessinées en premier, sous les cercles)
      for (let i = 0; i < pins.length; i++) {
        const { cx, cy, info } = pins[i]
        const { lx, ly } = labelPositions[i]
        const dist = Math.hypot(lx - cx, ly - cy)
        if (dist > R * 0.5) {
          // Petit point à la position réelle
          ctx.beginPath()
          ctx.arc(cx, cy, Math.round(R * 0.32), 0, Math.PI * 2)
          ctx.fillStyle = info.color
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = Math.max(1, R * 0.1)
          ctx.stroke()
          // Ligne de repère
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(lx, ly)
          ctx.strokeStyle = info.color
          ctx.lineWidth = Math.max(1, R * 0.1)
          ctx.setLineDash([Math.round(R * 0.3), Math.round(R * 0.2)])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      // Phase 2 — dessiner les cercles-labels
      for (let i = 0; i < pins.length; i++) {
        const { info } = pins[i]
        const { lx, ly } = labelPositions[i]
        const label = pins[i].pt.identifiant

        // Cercle
        ctx.beginPath()
        ctx.arc(lx, ly, R, 0, Math.PI * 2)
        ctx.fillStyle = info.color
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.max(2, R * 0.12)
        ctx.stroke()

        // Texte — taille initiale large, réduite si le label dépasse le diamètre intérieur
        const maxTw = R * 1.65
        let fontSize = Math.round(R * 0.72)
        ctx.font = `bold ${fontSize}px Arial`
        const tw = ctx.measureText(label).width
        if (tw > maxTw) fontSize = Math.floor(fontSize * maxTw / tw)
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Légère correction verticale : 'middle' aligne sur le centre de l'em-box,
        // pas le centre visuel — on compense avec +5% de la taille de police
        ctx.fillText(label, lx, ly + fontSize * 0.05)
      }

      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => resolve(null)
    img.src = plan.url!
  })
}
