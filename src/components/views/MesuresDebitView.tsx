import { useRef, useState, useCallback } from 'react'
import { Plus, Upload, Trash2, Wind, X, Check, Move } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { TYPE_POINT_DEBIT, type TypePointDebit, type UniteDebit, type PointDebit } from '@/types'

// ── Constantes ───────────────────────────────────────────────────────────────

const ABBR_COUNT_KEY: Record<TypePointDebit, string> = {
  diffuseur:  'D',
  reprise:    'R',
  extraction: 'G',
}

const INPUT = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const LABEL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

// ── Formulaire d'édition d'un point ─────────────────────────────────────────

interface EditModalProps {
  point: PointDebit
  unite: UniteDebit
  onClose: () => void
  onSave: (data: Partial<PointDebit>) => void
  onDelete: () => void
}

function EditModal({ point, unite, onClose, onSave, onDelete }: EditModalProps) {
  const [form, setForm] = useState({
    identifiant:  point.identifiant,
    type:         point.type,
    local:        point.local,
    debitAvant:   point.debitAvant?.toString() ?? '',
    debitApres:   point.debitApres?.toString() ?? '',
    observations: point.observations ?? '',
  })

  function handleSave() {
    onSave({
      identifiant:  form.identifiant.trim() || point.identifiant,
      type:         form.type as TypePointDebit,
      local:        form.local.trim(),
      debitAvant:   form.debitAvant !== '' ? parseFloat(form.debitAvant) : undefined,
      debitApres:   form.debitApres !== '' ? parseFloat(form.debitApres) : undefined,
      observations: form.observations.trim() || undefined,
    })
    onClose()
  }

  const color = TYPE_POINT_DEBIT[form.type as TypePointDebit].color

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800"
          style={{ borderLeftWidth: 4, borderLeftColor: color }}>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ background: color }}>
              {form.identifiant}
            </span>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Point de mesure</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
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

          <div>
            <label className={LABEL}>Local / Zone</label>
            <input className={INPUT} placeholder="ex. Bureau 201, Cuisine, Hall" value={form.local}
              onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Débit avant ({unite})</label>
              <input type="number" min="0" step="0.1" className={INPUT} placeholder="—"
                value={form.debitAvant}
                onChange={(e) => setForm({ ...form, debitAvant: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Débit après ({unite})</label>
              <input type="number" min="0" step="0.1" className={INPUT} placeholder="—"
                value={form.debitApres}
                onChange={(e) => setForm({ ...form, debitApres: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Observations</label>
            <textarea className={`${INPUT} resize-none`} rows={2} value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pb-4">
          <button onClick={() => { onDelete(); onClose() }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Annuler
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Check className="w-3.5 h-3.5" />
              Enregistrer
            </button>
          </div>
        </div>
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

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [editingPoint, setEditingPoint]     = useState<PointDebit | null>(null)
  const [isAddMode, setIsAddMode]           = useState(false)
  const [unite, setUnite]                   = useState<UniteDebit>('CFM')
  const [uploading, setUploading]           = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const planContainerRef = useRef<HTMLDivElement>(null)

  // Dragging state
  const draggingRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const currentPlan = plansDebit.find((p) => p.id === selectedPlanId) ?? plansDebit[0] ?? null
  const planPoints  = pointsDebit.filter((p) => p.planDebitId === currentPlan?.id)

  // Select first plan if none selected after load
  if (!selectedPlanId && plansDebit.length > 0 && plansDebit[0].id) {
    setSelectedPlanId(plansDebit[0].id)
  }

  // ── Auto-generate identifiant ─────────────────────────────────────────────

  function nextIdentifiant(type: TypePointDebit, planId: string): string {
    const prefix = ABBR_COUNT_KEY[type]
    const existingNums = pointsDebit
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
      const imageData = await readFileAsDataURL(file, file.type === 'application/pdf')
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
    } catch {
      toast.error('Erreur lors du chargement du plan')
    } finally {
      setUploading(false)
    }
  }

  // ── Click on plan canvas → add pin ───────────────────────────────────────

  const handlePlanClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddMode || !currentPlan || !currentProjectId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width)  * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100
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
  }, [isAddMode, currentPlan, currentProjectId, unite, addPointDebit])

  // ── Pin drag ──────────────────────────────────────────────────────────────

  const handlePinMouseDown = useCallback((e: React.MouseEvent, point: PointDebit) => {
    e.stopPropagation()
    e.preventDefault()
    const container = planContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    draggingRef.current = {
      id: point.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: point.x,
      origY: point.y,
    }
    const onMove = (me: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = ((me.clientX - draggingRef.current.startX) / rect.width)  * 100
      const dy = ((me.clientY - draggingRef.current.startY) / rect.height) * 100
      const nx = Math.max(0, Math.min(100, draggingRef.current.origX + dx))
      const ny = Math.max(0, Math.min(100, draggingRef.current.origY + dy))
      updatePointDebit(draggingRef.current.id, { x: nx, y: ny })
    }
    const onUp = () => {
      draggingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [updatePointDebit])

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
                    <span onClick={(e) => { e.stopPropagation(); if (window.confirm(`Supprimer le plan "${p.name}" ?`)) deletePlanDebit(p.id) }}
                      className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">×</span>
                  )}
                </button>
              ))}
            </div>

            {/* Barre d'outils canvas */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              <button onClick={() => setIsAddMode(!isAddMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isAddMode ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <Plus className="w-3.5 h-3.5" />
                {isAddMode ? 'Cliquez sur le plan…' : 'Ajouter un point'}
              </button>
              <span className="text-[10px] text-gray-400 ml-1">
                <Move className="w-3 h-3 inline mr-1" />
                Glissez pour déplacer · Cliquez pour modifier
              </span>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-auto p-3 bg-gray-100 dark:bg-gray-950">
              {currentPlan?.url ? (
                <div
                  ref={planContainerRef}
                  onClick={handlePlanClick}
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: `${((currentPlan.height || 1) / (currentPlan.width || 1)) * 100}%`,
                    cursor: isAddMode ? 'crosshair' : 'default',
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
                        onClick={(e) => { e.stopPropagation(); setEditingPoint(point) }}
                      >
                        <div style={{ position: 'relative', cursor: 'pointer' }}>
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
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Chargement du plan…
                </div>
              )}
            </div>
          </div>

          {/* Panneau droit — tableau */}
          <div className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Relevés — {sortedPoints.length} point{sortedPoints.length > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-400">{unite}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    {['ID', 'Local', 'Type', 'Avant', 'Après', 'Écart', '%'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedPoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                        Aucun point — activez « Ajouter un point » et cliquez sur le plan
                      </td>
                    </tr>
                  ) : sortedPoints.map((pt) => {
                    const info    = TYPE_POINT_DEBIT[pt.type]
                    const ecart   = (pt.debitAvant !== undefined && pt.debitApres !== undefined) ? pt.debitApres - pt.debitAvant : null
                    const variation = (pt.debitAvant && ecart !== null) ? (ecart / pt.debitAvant) * 100 : null
                    return (
                      <tr key={pt.id}
                        onClick={() => setEditingPoint(pt)}
                        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: info.color }} />
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{pt.identifiant}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 max-w-[80px] truncate">{pt.local || '—'}</td>
                        <td className="px-2 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium" style={{ background: info.color }}>
                            {info.abbr}
                          </span>
                        </td>
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
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {variation !== null ? (
                            <span className={variation >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
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
                        TOTAL / MOY.
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
                      <td className="px-2 py-2 text-right font-mono font-semibold">
                        {variationMoy !== null ? (
                          <span className={variationMoy >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {variationMoy >= 0 ? '+' : ''}{variationMoy.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                    {/* Légende */}
                    <tr>
                      <td colSpan={7} className="px-2 pb-2">
                        <div className="flex items-center gap-3 mt-1">
                          {(Object.entries(TYPE_POINT_DEBIT) as [TypePointDebit, { label: string; color: string; abbr: string }][]).map(([k, v]) => (
                            <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
                              {v.abbr} — {v.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition */}
      {editingPoint && (
        <EditModal
          point={editingPoint}
          unite={unite}
          onClose={() => setEditingPoint(null)}
          onSave={(data) => updatePointDebit(editingPoint.id, data)}
          onDelete={() => deletePointDebit(editingPoint.id)}
        />
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
