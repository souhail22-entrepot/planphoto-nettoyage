import { useState, useMemo, useRef, useEffect } from 'react'
import { FileDown, Loader2, Plus, X, Camera, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { saveInterventionPhoto, deleteInterventionPhoto, getProjectInterventionPhotos } from '@/services/interventionPhotoStorage'
import { generateInterventionReport, generateInterventionFiches } from '@/services/interventionPdfGenerator'
import { STATUTS_INTERVENTION, STATUTS_ACTIFS, REMPLACEMENT_LABELS } from '@/types/interventions'
import type { StatutIntervention, Intervention, PhotoIntervention, PhotoField, RemplacementHotte } from '@/types/interventions'

// ── Constantes style ──────────────────────────────────────────────────────────

const INPUT_CLS = [
  'w-full bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600',
  'border border-transparent rounded px-2 py-1',
  'hover:border-gray-200 dark:hover:border-gray-700',
  'focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800/60',
  'transition-colors',
].join(' ')

// ── Dropdown statut ───────────────────────────────────────────────────────────

function StatutCell({
  value, onChange,
}: { value: StatutIntervention | null; onChange: (v: StatutIntervention | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const s = value ? STATUTS_INTERVENTION[value] : null

  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        className={`min-w-[80px] text-center text-[11px] font-semibold rounded-full px-2.5 py-1 transition-colors ${
          s ? s.tw : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        {s ? s.label : '—'}
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-1 w-32">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
          >
            — Aucun
          </button>
          {STATUTS_ACTIFS.map((k) => {
            const sv = STATUTS_INTERVENTION[k]
            return (
              <button
                key={k}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(k); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                  value === k
                    ? sv.tw + ' font-bold'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {sv.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mini bande photos ─────────────────────────────────────────────────────────

function PhotoMiniStrip({
  label, stripType, photos, onAdd, onRemove, onReorder, onOpen,
}: {
  label:      string
  stripType:  'avant' | 'apres'
  photos:     PhotoIntervention[]
  onAdd:      (files: FileList) => void
  onRemove:   (ref: string) => void
  onReorder?: (newPhotos: PhotoIntervention[]) => void
  onOpen:     (idx: number) => void
}) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const shown      = photos.filter((p) => p.url)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragSrcIdx = useRef<number | null>(null)

  const labelCls  = stripType === 'avant' ? 'text-blue-500' : 'text-green-500'
  const borderCls = stripType === 'avant'
    ? 'outline outline-2 outline-blue-400 dark:outline-blue-500'
    : 'outline outline-2 outline-green-500 dark:outline-green-400'

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragSrcIdx.current = idx; e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(idx)
  }
  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault()
    const src = dragSrcIdx.current; setDragOver(null); dragSrcIdx.current = null
    if (src === null || src === idx) return
    const r = [...shown]; const [m] = r.splice(src, 1); r.splice(idx, 0, m)
    onReorder?.(r)
  }
  function handleDragEnd() { dragSrcIdx.current = null; setDragOver(null) }

  return (
    <div className="flex items-start gap-0.5 flex-wrap min-h-[20px]">
      <span className={`text-[8px] font-bold uppercase w-4 flex-shrink-0 select-none ${labelCls}`}>{label}</span>
      {shown.map((ph, idx) => (
        <div
          key={ph.ref}
          draggable={!!onReorder}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          onClick={() => onOpen(idx)}
          title="Clic pour ouvrir · Glisser pour réordonner"
          className={`relative group w-8 h-8 flex-shrink-0 rounded transition-all cursor-zoom-in
            ${dragOver === idx ? 'ring-2 ring-white opacity-60 scale-110' : borderCls}
            ${onReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <img
            src={ph.url} draggable={false} onDragStart={(e) => e.preventDefault()}
            className="w-8 h-8 object-cover rounded pointer-events-none group-hover:opacity-75 transition-opacity"
          />
          <span className="absolute bottom-0 right-0 text-[5px] font-bold leading-none bg-black/70 text-white px-0.5 rounded-tl pointer-events-none">
            {ph.ref}
          </span>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onRemove(ph.ref) }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10"
            title="Supprimer"
          ><X className="w-2.5 h-2.5" /></button>
        </div>
      ))}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        title={`Ajouter photo ${label}`}
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-400 hover:text-blue-500 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
      ><Camera className="w-3 h-3" /></button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => e.target.files && onAdd(e.target.files)} />
    </div>
  )
}

// ── Cellule composante — viewer unifié avec classification ────────────────────

function ComponentCell({
  photosAvant, photosApres,
  onAddAvant, onAddApres,
  onRemoveAvant, onRemoveApres,
  onReorderAvant, onReorderApres,
  onMoveToAvant, onMoveToApres,
}: {
  photosAvant:     PhotoIntervention[]
  photosApres:     PhotoIntervention[]
  onAddAvant:      (files: FileList) => void
  onAddApres:      (files: FileList) => void
  onRemoveAvant:   (ref: string) => void
  onRemoveApres:   (ref: string) => void
  onReorderAvant?: (newPhotos: PhotoIntervention[]) => void
  onReorderApres?: (newPhotos: PhotoIntervention[]) => void
  onMoveToAvant:   (photo: PhotoIntervention) => void
  onMoveToApres:   (photo: PhotoIntervention) => void
}) {
  type Tagged = PhotoIntervention & { status: 'avant' | 'apres' }

  const [viewerIdx,   setViewerIdx]   = useState<number | null>(null)
  const [autoAdvance, setAutoAdvance] = useState(true)

  const avShown   = photosAvant.filter((p) => p.url)
  const apShown   = photosApres.filter((p) => p.url)
  const allPhotos: Tagged[] = [
    ...avShown.map((p) => ({ ...p, status: 'avant' as const })),
    ...apShown.map((p) => ({ ...p, status: 'apres' as const })),
  ]
  const current = viewerIdx !== null ? allPhotos[viewerIdx] ?? null : null

  // Refs pour éviter les closures périmées dans le handler clavier
  const idxRef     = useRef(viewerIdx)
  const advRef     = useRef(autoAdvance)
  const photosRef  = useRef(allPhotos)
  useEffect(() => { idxRef.current    = viewerIdx   }, [viewerIdx])
  useEffect(() => { advRef.current    = autoAdvance }, [autoAdvance])
  useEffect(() => { photosRef.current = allPhotos   })

  function advance() {
    setViewerIdx((i) => (i !== null && i < photosRef.current.length - 1) ? i + 1 : i)
  }

  function classify(newStatus: 'avant' | 'apres') {
    const i  = idxRef.current
    const ph = i !== null ? photosRef.current[i] : null
    if (!ph) return
    if (ph.status !== newStatus) {
      if (newStatus === 'avant') onMoveToAvant(ph)
      else                       onMoveToApres(ph)
    }
    if (advRef.current) advance()
  }

  // Clavier : Échap · ← → · A=Avant · P=Après
  useEffect(() => {
    if (viewerIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')                      { setViewerIdx(null); return }
      if (e.key === 'ArrowLeft')                   { setViewerIdx((i) => (i !== null && i > 0) ? i - 1 : i); return }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(); return }
      if (e.key === 'a' || e.key === 'A')          { classify('avant'); return }
      if (e.key === 'p' || e.key === 'P')          { classify('apres'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIdx])

  const avRefs = avShown.map((p) => p.ref).join(' ')
  const apRefs = apShown.map((p) => p.ref).join(' ')

  const NAV_BTN = 'px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg text-sm transition-colors'

  return (
    <div className="flex flex-col gap-1 pb-0.5 px-0.5">
      {/* Refs */}
      {(avRefs || apRefs) && (
        <div className="px-1 text-[9px] leading-snug space-y-0.5">
          {avRefs && <div><span className="font-bold text-blue-500">Av:</span> <span className="font-mono text-gray-500 dark:text-gray-400">{avRefs}</span></div>}
          {apRefs && <div><span className="font-bold text-green-500">Ap:</span> <span className="font-mono text-gray-500 dark:text-gray-400">{apRefs}</span></div>}
        </div>
      )}

      {/* Bandes AV / AP */}
      <PhotoMiniStrip
        label="AV" stripType="avant"
        photos={photosAvant} onAdd={onAddAvant} onRemove={onRemoveAvant} onReorder={onReorderAvant}
        onOpen={(idx) => setViewerIdx(idx)}
      />
      <PhotoMiniStrip
        label="AP" stripType="apres"
        photos={photosApres} onAdd={onAddApres} onRemove={onRemoveApres} onReorder={onReorderApres}
        onOpen={(idx) => setViewerIdx(avShown.length + idx)}
      />

      {/* ── Viewer unifié ─────────────────────────────────────────────── */}
      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={() => setViewerIdx(null)}
        >
          <div
            className="relative flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Badge statut */}
            <span className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-widest uppercase ${
              current.status === 'avant'
                ? 'bg-blue-600 text-white'
                : 'bg-green-600 text-white'
            }`}>
              {current.status === 'avant' ? 'Avant' : 'Après'}
            </span>

            {/* Photo */}
            <img
              src={current.url}
              className="max-w-[90vw] max-h-[58vh] object-contain rounded-xl shadow-2xl"
            />

            {/* Boutons classification */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => classify('avant')}
                title="Classer Avant (touche A)"
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  current.status === 'avant'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-black/50'
                    : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white'
                }`}
              >Avant</button>
              <button
                onClick={() => classify('apres')}
                title="Classer Après (touche P)"
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  current.status === 'apres'
                    ? 'bg-green-600 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-black/50'
                    : 'bg-green-600/20 text-green-300 hover:bg-green-600 hover:text-white'
                }`}
              >Après</button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              {allPhotos.length > 1 && (
                <button onClick={() => setViewerIdx((i) => (i !== null && i > 0) ? i - 1 : i)} disabled={viewerIdx === 0} className={NAV_BTN}>
                  ← Préc.
                </button>
              )}
              <span className="text-white/70 text-sm font-mono select-none">
                {current.ref}{allPhotos.length > 1 && ` (${(viewerIdx ?? 0) + 1}/${allPhotos.length})`}
              </span>
              {allPhotos.length > 1 && (
                <button onClick={advance} disabled={viewerIdx === allPhotos.length - 1} className={NAV_BTN}>
                  Suiv. →
                </button>
              )}
            </div>

            {/* Auto-avance */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              <span className="text-white/45 text-xs">Avancer auto après classification</span>
            </label>
          </div>

          {/* Fermer */}
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors"
            onClick={() => setViewerIdx(null)}
          ><X className="w-5 h-5" /></button>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs select-none">
            Clic ou Échap pour fermer · ← → naviguer · A = Avant · P = Après
          </p>
        </div>
      )}
    </div>
  )
}

// ── Ligne éditable ────────────────────────────────────────────────────────────

function InterventionRow({
  intervention, projectId, autoFocus,
}: {
  intervention: Intervention
  projectId:    string
  autoFocus:    boolean
}) {
  const updateIntervention       = useAppStore((s) => s.updateIntervention)
  const deleteIntervention       = useAppStore((s) => s.deleteIntervention)
  const allProjectInterventions  = useAppStore((s) => s.interventions.filter((i) => i.projectId === projectId))

  const [local, setLocal] = useState<Intervention>(intervention)
  // Ref mis à jour IMMÉDIATEMENT dans saveNow/patch — évite le local périmé dans les fonctions async
  const localRef = useRef<Intervention>(intervention)
  const dirty = useRef(false)
  const aptRef = useRef<HTMLInputElement>(null)

  // Sync external changes (ex: restauration de photos depuis IndexedDB)
  useEffect(() => {
    setLocal((prev) => {
      const next = {
        ...prev,
        photosHotteAvant:    intervention.photosHotteAvant,
        photosHotteApres:    intervention.photosHotteApres,
        photosSdbAvant:      intervention.photosSdbAvant,
        photosSdbApres:      intervention.photosSdbApres,
        photosChgtHotteAvant: intervention.photosChgtHotteAvant,
        photosChgtHotteApres: intervention.photosChgtHotteApres,
      }
      localRef.current = next
      return next
    })
  }, [
    intervention.photosHotteAvant, intervention.photosHotteApres,
    intervention.photosSdbAvant,   intervention.photosSdbApres,
    intervention.photosChgtHotteAvant, intervention.photosChgtHotteApres,
  ])

  // Auto-focus
  useEffect(() => {
    if (autoFocus) {
      aptRef.current?.focus()
      aptRef.current?.select()
    }
  }, [autoFocus])

  function patch(data: Partial<Intervention>) {
    const next = { ...localRef.current, ...data }
    localRef.current = next
    setLocal(next)
    dirty.current = true
  }

  function save() {
    if (!dirty.current) return
    updateIntervention(localRef.current.id, { ...localRef.current, updatedAt: new Date().toISOString() })
    dirty.current = false
  }

  function saveNow(data: Partial<Intervention>) {
    console.log('[InterventionRow] saveNow data keys=', Object.keys(data))
    const updated = { ...localRef.current, ...data, updatedAt: new Date().toISOString() }
    console.log('[InterventionRow] updated photosChgtHotteAvant=', updated.photosChgtHotteAvant?.length, 'photosHotteAvant=', updated.photosHotteAvant?.length)
    localRef.current = updated  // synchrone — disponible immédiatement dans les fonctions async
    setLocal(updated)
    updateIntervention(updated.id, updated)
    // Vérifier le store immédiatement après
    const { interventions: storeIntvs } = useAppStore.getState()
    const storeIntv = storeIntvs.find((i) => i.id === updated.id)
    console.log('[InterventionRow] STORE après update → ChgtHotte=', storeIntv?.photosChgtHotteAvant?.length, 'Hotte=', storeIntv?.photosHotteAvant?.length)
    dirty.current = false
  }

  function handleRowBlur(e: React.FocusEvent<HTMLTableRowElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    save()
  }

  /** Retourne le numéro le plus haut parmi toutes les photos P-xxx du projet */
  function getMaxPhotoNum(): number {
    let max = 0
    const sources = [...allProjectInterventions.filter((i) => i.id !== local.id), local]
    for (const intv of sources) {
      for (const ph of [
        ...(intv.photosHotteAvant ?? []), ...(intv.photosHotteApres ?? []),
        ...(intv.photosSdbAvant ?? []),   ...(intv.photosSdbApres ?? []),
        ...(intv.photosChgtHotteAvant ?? []), ...(intv.photosChgtHotteApres ?? []),
      ]) {
        const m = ph.ref.match(/^P(\d+)$/)
        if (m) max = Math.max(max, parseInt(m[1], 10))
      }
    }
    return max
  }

  async function handleAddPhotoComp(field: PhotoField, files: FileList) {
    console.log('[InterventionRow] handleAddPhotoComp → field=', field)
    let nextNum = getMaxPhotoNum()
    const newPhotos: PhotoIntervention[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f)
      })
      nextNum++
      const ref = `P${String(nextNum).padStart(3, '0')}`
      const ph: PhotoIntervention = { id: nanoid(), ref, url, timestamp: new Date().toISOString() }
      await saveInterventionPhoto(`${projectId}_intv_${ref}`, url, localRef.current.appartement || undefined)
      newPhotos.push(ph)
    }
    const newVal = [...(localRef.current[field] ?? []), ...newPhotos]
    console.log('[InterventionRow] saveNow →', field, '=', newVal.length, 'photos')
    saveNow({ [field]: newVal })
  }

  async function handleRemovePhotoComp(field: PhotoField, ref: string) {
    await deleteInterventionPhoto(`${projectId}_intv_${ref}`)
    saveNow({ [field]: (localRef.current[field] ?? []).filter((p) => p.ref !== ref) })
  }

  function handleReorderPhotoComp(field: PhotoField, newPhotos: PhotoIntervention[]) {
    saveNow({ [field]: newPhotos })
  }

  function handleMovePhoto(
    fromAvant: PhotoField, fromApres: PhotoField,
    photo: PhotoIntervention, toStatus: 'avant' | 'apres',
  ) {
    if (toStatus === 'avant') {
      saveNow({
        [fromApres]: (local[fromApres] ?? []).filter((p) => p.id !== photo.id),
        [fromAvant]: [...(local[fromAvant] ?? []), { ...photo }],
      })
    } else {
      saveNow({
        [fromAvant]: (local[fromAvant] ?? []).filter((p) => p.id !== photo.id),
        [fromApres]: [...(local[fromApres] ?? []), { ...photo }],
      })
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer l'intervention « ${local.appartement || '(vide)'} » ?`)) return
    await deleteIntervention(local.id)
    toast.success('Intervention supprimée')
  }

  const tdCls = 'border-b border-r border-gray-100 dark:border-gray-800 px-1 py-0.5 align-top'

  return (
    <tr
      onBlur={handleRowBlur}
      className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
    >
      {/* Date */}
      <td className={tdCls} style={{ minWidth: 130 }}>
        <input
          type="date"
          value={local.date}
          onChange={(e) => patch({ date: e.target.value })}
          onBlur={save}
          className={INPUT_CLS + ' text-xs'}
        />
      </td>

      {/* Appartement */}
      <td className={tdCls} style={{ minWidth: 130 }}>
        <input
          ref={aptRef}
          type="text"
          value={local.appartement}
          onChange={(e) => patch({ appartement: e.target.value })}
          onBlur={save}
          placeholder="Apt. 101…"
          className={INPUT_CLS}
        />
      </td>

      {/* Hotte */}
      <td className={tdCls} style={{ width: 175, padding: 0 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '2px' }}>
          <ComponentCell
            photosAvant={local.photosHotteAvant ?? []}
            photosApres={local.photosHotteApres ?? []}
            onAddAvant={(files) => handleAddPhotoComp('photosHotteAvant', files)}
            onAddApres={(files) => handleAddPhotoComp('photosHotteApres', files)}
            onRemoveAvant={(ref) => handleRemovePhotoComp('photosHotteAvant', ref)}
            onRemoveApres={(ref) => handleRemovePhotoComp('photosHotteApres', ref)}
            onReorderAvant={(p) => handleReorderPhotoComp('photosHotteAvant', p)}
            onReorderApres={(p) => handleReorderPhotoComp('photosHotteApres', p)}
            onMoveToAvant={(ph) => handleMovePhoto('photosHotteAvant', 'photosHotteApres', ph, 'avant')}
            onMoveToApres={(ph) => handleMovePhoto('photosHotteAvant', 'photosHotteApres', ph, 'apres')}
          />
        </div>
      </td>

      {/* SDB */}
      <td className={tdCls} style={{ width: 175, padding: 0 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '2px' }}>
          <ComponentCell
            photosAvant={local.photosSdbAvant ?? []}
            photosApres={local.photosSdbApres ?? []}
            onAddAvant={(files) => handleAddPhotoComp('photosSdbAvant', files)}
            onAddApres={(files) => handleAddPhotoComp('photosSdbApres', files)}
            onRemoveAvant={(ref) => handleRemovePhotoComp('photosSdbAvant', ref)}
            onRemoveApres={(ref) => handleRemovePhotoComp('photosSdbApres', ref)}
            onReorderAvant={(p) => handleReorderPhotoComp('photosSdbAvant', p)}
            onReorderApres={(p) => handleReorderPhotoComp('photosSdbApres', p)}
            onMoveToAvant={(ph) => handleMovePhoto('photosSdbAvant', 'photosSdbApres', ph, 'avant')}
            onMoveToApres={(ph) => handleMovePhoto('photosSdbAvant', 'photosSdbApres', ph, 'apres')}
          />
        </div>
      </td>

      {/* Changement de hotte */}
      <td className={tdCls} style={{ width: 175, padding: 0 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '2px' }}>
          <ComponentCell
            photosAvant={local.photosChgtHotteAvant ?? []}
            photosApres={local.photosChgtHotteApres ?? []}
            onAddAvant={(files) => handleAddPhotoComp('photosChgtHotteAvant', files)}
            onAddApres={(files) => handleAddPhotoComp('photosChgtHotteApres', files)}
            onRemoveAvant={(ref) => handleRemovePhotoComp('photosChgtHotteAvant', ref)}
            onRemoveApres={(ref) => handleRemovePhotoComp('photosChgtHotteApres', ref)}
            onReorderAvant={(p) => handleReorderPhotoComp('photosChgtHotteAvant', p)}
            onReorderApres={(p) => handleReorderPhotoComp('photosChgtHotteApres', p)}
            onMoveToAvant={(ph) => handleMovePhoto('photosChgtHotteAvant', 'photosChgtHotteApres', ph, 'avant')}
            onMoveToApres={(ph) => handleMovePhoto('photosChgtHotteAvant', 'photosChgtHotteApres', ph, 'apres')}
          />
        </div>
      </td>

      {/* Date 2e avis */}
      <td className={tdCls} style={{ minWidth: 125 }}>
        <div className="flex flex-col gap-1 py-0.5 px-0.5">
          <input
            type="date"
            value={local.dateDeuxiemeAvis ?? ''}
            onChange={(e) => patch({ dateDeuxiemeAvis: e.target.value })}
            onBlur={save}
            className={INPUT_CLS + ' text-xs'}
          />
          <label className="flex items-center gap-1.5 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={local.absentDeuxiemeAvis ?? false}
              onChange={(e) => saveNow({ absentDeuxiemeAvis: e.target.checked })}
              className="w-3 h-3 rounded accent-orange-500"
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Absent</span>
          </label>
        </div>
      </td>

      {/* Notes / Particularités */}
      <td className={tdCls} style={{ minWidth: 220 }}>
        <div className="flex flex-col gap-1.5 py-1 px-1">
          {/* Hotte 30" */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-14 flex-shrink-0">Hotte 30"</span>
            {(Object.keys(REMPLACEMENT_LABELS) as RemplacementHotte[]).map((opt) => (
              <button
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => saveNow({ replHotte30: local.replHotte30 === opt ? null : opt })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                  local.replHotte30 === opt
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600'
                }`}
              >
                {REMPLACEMENT_LABELS[opt]}
              </button>
            ))}
          </div>
          {/* Hotte 24" */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-14 flex-shrink-0">Hotte 24"</span>
            {(Object.keys(REMPLACEMENT_LABELS) as RemplacementHotte[]).map((opt) => (
              <button
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => saveNow({ replHotte24: local.replHotte24 === opt ? null : opt })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                  local.replHotte24 === opt
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600'
                }`}
              >
                {REMPLACEMENT_LABELS[opt]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={local.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            onBlur={save}
            placeholder="Observations…"
            className={INPUT_CLS}
          />
        </div>
      </td>

      {/* Supprimer */}
      <td className="border-b border-gray-100 dark:border-gray-800 px-2 py-0.5 text-center w-9">
        <button
          onClick={handleDelete}
          className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────────

export default function InterventionReportView() {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [newRowId,   setNewRowId]   = useState<string | null>(null)
  const [pdfMode,    setPdfMode]    = useState<'tableau' | 'fiches' | 'les_deux'>('tableau')

  const currentProjectId   = useAppStore((s) => s.currentProjectId)
  const project            = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const interventions      = useAppStore((s) => s.interventions.filter((i) => i.projectId === currentProjectId))
  const addIntervention    = useAppStore((s) => s.addIntervention)

  const sorted = useMemo(
    () => [...interventions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [interventions],
  )

  function handleAddRow() {
    if (!currentProjectId) return
    const today = new Date().toISOString().slice(0, 10)
    const id = addIntervention({
      projectId:            currentProjectId,
      date:                 today,
      appartement:          '',
      hotteStatut:          null,
      sdbStatut:            null,
      changementHotteStatut: null,
      photosHotteAvant:     [],
      photosHotteApres:     [],
      photosSdbAvant:       [],
      photosSdbApres:       [],
      photosChgtHotteAvant: [],
      photosChgtHotteApres: [],
      dateDeuxiemeAvis:     '',
      absentDeuxiemeAvis:   false,
      replHotte30:          null,
      replHotte24:          null,
      notes:                '',
    })
    setNewRowId(id)
  }

  async function handleExport() {
    if (!project) return
    setLoadingPdf(true)
    try {
      const photos = await getProjectInterventionPhotos(project.id)
      if (pdfMode === 'tableau' || pdfMode === 'les_deux') {
        await generateInterventionReport(project, sorted, photos)
      }
      if (pdfMode === 'fiches' || pdfMode === 'les_deux') {
        await generateInterventionFiches(project, sorted, photos)
      }
      toast.success('Rapport exporté avec succès')
    } catch (err) {
      toast.error('Erreur lors de la génération du rapport')
      console.error(err)
    } finally {
      setLoadingPdf(false)
    }
  }

  if (!project) return <div className="p-8 text-center text-gray-400">Aucun projet sélectionné.</div>

  const completees = interventions.filter(
    (i) => (i.hotteStatut === 'complete' || i.hotteStatut === 'valide' || i.hotteStatut === null) &&
            (i.sdbStatut   === 'complete' || i.sdbStatut   === 'valide' || i.sdbStatut   === null),
  ).length

  const TH = ({ children, w }: { children: React.ReactNode; w?: number }) => (
    <th
      className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-r border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap sticky top-0 z-10"
      style={w ? { width: w } : undefined}
    >
      {children}
    </th>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">

      {/* ── En-tête ── */}
      <div className="flex-none border-b border-gray-100 dark:border-gray-800">

        {/* Ligne 1 : titre + boutons action */}
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Rapport d'intervention</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {interventions.length} ligne{interventions.length !== 1 ? 's' : ''}
              {interventions.length > 0 && <> · <span className="text-green-600 font-semibold">{completees}</span> complétée{completees !== 1 ? 's' : ''}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Ajouter une intervention
            </button>
            <button
              onClick={handleExport}
              disabled={loadingPdf || interventions.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              {loadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Générer PDF
            </button>
          </div>
        </div>

        {/* Ligne 2 : sélecteur Format PDF — toujours visible */}
        <div className="flex items-center gap-3 px-5 pb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Format PDF :</span>
          {([
            { id: 'tableau',  label: 'Tableau',  desc: 'Résumé en tableau' },
            { id: 'fiches',   label: 'Fiches',   desc: 'Une fiche par appartement' },
            { id: 'les_deux', label: 'Les deux', desc: 'Tableau + fiches' },
          ] as const).map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => setPdfMode(id)}
              title={desc}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap ${
                pdfMode === id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 130 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 175 }} />
            <col style={{ width: 175 }} />
            <col style={{ width: 175 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              <TH>Date</TH>
              <TH>Appartement</TH>
              <TH w={175}>Hotte</TH>
              <TH w={175}>SDB</TH>
              <TH w={175}>Chgt hotte</TH>
              <TH w={130}>Date 2e avis</TH>
              <TH>Notes / Particularités</TH>
              <th className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-gray-200 dark:border-gray-700 sticky top-0 z-10 w-9" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((intv) => (
              <InterventionRow
                key={intv.id}
                intervention={intv}
                projectId={currentProjectId!}
                autoFocus={intv.id === newRowId}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <p className="text-sm font-medium text-gray-400 dark:text-gray-600 mb-3">Aucune intervention</p>
                  <button
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Ajouter la première intervention
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Ligne + rapide en bas */}
        {sorted.length > 0 && (
          <button
            onClick={handleAddRow}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 border-t border-gray-100 dark:border-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
        )}
      </div>
    </div>
  )
}
