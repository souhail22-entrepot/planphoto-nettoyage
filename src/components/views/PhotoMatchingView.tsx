import { useState, useRef, useEffect } from 'react'
import { Upload, ChevronLeft, ChevronRight, Check, X, AlertCircle, Trash2, Link, Save, Plus } from 'lucide-react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { saveInterventionPhoto } from '@/services/interventionPhotoStorage'
import type { PhotoIntervention, PhotoField } from '@/types/interventions'

// ── Types locaux ──────────────────────────────────────────────────────────────

interface MatchPhoto {
  id:       string
  url:      string
  filename: string
  type:     'before' | 'after'
  status:   'unmatched' | 'paired'
  order:    number
}

interface Pair {
  id:         string
  beforeId:   string
  afterId:    string
  composante: Composante
}

type Composante = 'hotte' | 'sdb' | 'chgtHotte'

const COMPOSANTE_FIELDS: Record<Composante, { avant: PhotoField; apres: PhotoField }> = {
  hotte:     { avant: 'photosHotteAvant',    apres: 'photosHotteApres' },
  sdb:       { avant: 'photosSdbAvant',      apres: 'photosSdbApres' },
  chgtHotte: { avant: 'photosChgtHotteAvant', apres: 'photosChgtHotteApres' },
}

const COMPOSANTE_LABELS: Record<Composante, string> = {
  hotte:     'Hotte',
  sdb:       'SDB',
  chgtHotte: 'Chgt Hotte',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readFiles(files: FileList, type: 'before' | 'after'): Promise<MatchPhoto[]> {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
  const result: MatchPhoto[] = []
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i]
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(f)
    })
    result.push({ id: nanoid(), url, filename: f.name, type, status: 'unmatched', order: i })
  }
  return result
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function PhotoMatchingView() {
  const interventions      = useAppStore((s) => s.interventions)
  const currentProjectId   = useAppStore((s) => s.currentProjectId)
  const updateIntervention = useAppStore((s) => s.updateIntervention)
  const addIntervention    = useAppStore((s) => s.addIntervention)

  const [beforePhotos,    setBeforePhotos]    = useState<MatchPhoto[]>([])
  const [afterPhotos,     setAfterPhotos]     = useState<MatchPhoto[]>([])
  const [pairs,           setPairs]           = useState<Pair[]>([])
  const [activeBeforeIdx, setActiveBeforeIdx] = useState(0)
  const [tab,             setTab]             = useState<'match' | 'table'>('match')
  const [lightbox,        setLightbox]        = useState<string | null>(null)
  const [saving,          setSaving]          = useState(false)

  // Destination
  const [selectedIntvId, setSelectedIntvId] = useState<string>('')
  // Ref mise à jour IMMÉDIATEMENT au clic — pas pendant le rendu (évite le décalage concurrent mode)
  const composanteRef = useRef<Composante>('hotte')
  const [composante,    setComposante]      = useState<Composante>('hotte')

  function changeComposante(c: Composante) {
    composanteRef.current = c   // synchrone, avant tout re-render
    setComposante(c)            // déclenche le re-render pour la UI
  }

  // Création rapide d'intervention
  const [showNewIntv, setShowNewIntv] = useState(false)
  const [newApt,      setNewApt]      = useState('')
  const [newDate,     setNewDate]     = useState(new Date().toISOString().slice(0, 10))

  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef  = useRef<HTMLInputElement>(null)

  // Interventions du projet courant
  const projectInterventions = interventions
    .filter((i) => i.projectId === currentProjectId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.appartement.localeCompare(b.appartement))

  // Photos AVANT non appariées
  const unmatched = beforePhotos.filter((p) => p.status === 'unmatched')
  const current   = unmatched[Math.min(activeBeforeIdx, Math.max(0, unmatched.length - 1))] ?? null

  // ── Importer ──────────────────────────────────────────────────────────────

  async function importBefore(files: FileList) {
    const photos = await readFiles(files, 'before')
    setBeforePhotos((prev) => [...prev, ...photos])
  }

  async function importAfter(files: FileList) {
    const photos = await readFiles(files, 'after')
    setAfterPhotos((prev) => [...prev, ...photos])
  }

  // ── Appariement ───────────────────────────────────────────────────────────

  function pairWith(afterId: string) {
    if (!current) return
    const comp = composanteRef.current
    console.log('[PhotoMatchingView] pairWith → composante=', comp)
    setPairs((prev) => [...prev, { id: nanoid(), beforeId: current.id, afterId, composante: comp }])
    setBeforePhotos((prev) => prev.map((p) => p.id === current.id ? { ...p, status: 'paired' } : p))
    setAfterPhotos((prev)  => prev.map((p) => p.id === afterId    ? { ...p, status: 'paired' } : p))
    setActiveBeforeIdx((i) => {
      const remaining = beforePhotos.filter((p) => p.status === 'unmatched' && p.id !== current.id).length
      return Math.min(i, Math.max(0, remaining - 1))
    })
  }

  function unpair(pairId: string) {
    const pair = pairs.find((p) => p.id === pairId)
    if (!pair) return
    setPairs((prev)        => prev.filter((p) => p.id !== pairId))
    setBeforePhotos((prev) => prev.map((p) => p.id === pair.beforeId ? { ...p, status: 'unmatched' } : p))
    setAfterPhotos((prev)  => prev.map((p) => p.id === pair.afterId  ? { ...p, status: 'unmatched' } : p))
  }

  function clearAll() {
    setBeforePhotos([]); setAfterPhotos([]); setPairs([]); setActiveBeforeIdx(0)
  }

  // ── Enregistrer dans l'intervention ──────────────────────────────────────

  function createIntervention() {
    const apt = newApt.trim()
    if (!apt || !currentProjectId) return
    const id = addIntervention({
      projectId:             currentProjectId,
      date:                  newDate,
      appartement:           apt,
      hotteStatut:           null,
      sdbStatut:             null,
      changementHotteStatut: null,
      photosHotteAvant:      [],
      photosHotteApres:      [],
      photosSdbAvant:        [],
      photosSdbApres:        [],
      photosChgtHotteAvant:  [],
      photosChgtHotteApres:  [],
      dateDeuxiemeAvis:      '',
      absentDeuxiemeAvis:    false,
      replHotte30:           null,
      replHotte24:           null,
      notes:                 '',
    })
    setSelectedIntvId(id)
    setShowNewIntv(false)
    setNewApt('')
    toast.success(`Intervention créée — ${apt}`)
  }

  /** Retourne le numéro P-xxx le plus élevé parmi toutes les interventions du projet */
  function getMaxPhotoNum(): number {
    let max = 0
    for (const intv of interventions.filter((i) => i.projectId === currentProjectId)) {
      for (const ph of [
        ...(intv.photosHotteAvant    ?? []), ...(intv.photosHotteApres    ?? []),
        ...(intv.photosSdbAvant      ?? []), ...(intv.photosSdbApres      ?? []),
        ...(intv.photosChgtHotteAvant ?? []), ...(intv.photosChgtHotteApres ?? []),
      ]) {
        const m = ph.ref.match(/^P(\d+)$/)
        if (m) max = Math.max(max, parseInt(m[1], 10))
      }
    }
    return max
  }

  async function saveToIntervention() {
    if (!selectedIntvId || pairs.length === 0 || !currentProjectId) return
    const intervention = interventions.find((i) => i.id === selectedIntvId)
    if (!intervention) return

    setSaving(true)
    try {
      let nextNum = getMaxPhotoNum()

      // Si toutes les paires ont la même composante stockée (batch unique),
      // utiliser la composante actuellement sélectionnée — l'utilisateur peut avoir
      // apparié avant de choisir sa composante (order-independence).
      // Si les paires ont des composantes différentes (batch multi), respecter
      // la composante individuelle de chaque paire.
      const storedComposantes = new Set(pairs.map((p) => p.composante))
      const effectiveComposante = (comp: Composante): Composante =>
        storedComposantes.size === 1 ? composanteRef.current : comp

      const grouped: Partial<Record<Composante, { avant: PhotoIntervention[]; apres: PhotoIntervention[] }>> = {}

      for (const pair of pairs) {
        const comp   = effectiveComposante(pair.composante)
        const before = beforePhotos.find((p) => p.id === pair.beforeId)
        const after  = afterPhotos.find((p)  => p.id === pair.afterId)
        if (!grouped[comp]) grouped[comp] = { avant: [], apres: [] }

        if (before) {
          nextNum++
          const ref = `P${String(nextNum).padStart(3, '0')}`
          await saveInterventionPhoto(`${currentProjectId}_intv_${ref}`, before.url, intervention.appartement || undefined)
          grouped[comp]!.avant.push({ id: nanoid(), ref, url: before.url, timestamp: new Date().toISOString() })
        }
        if (after) {
          nextNum++
          const ref = `P${String(nextNum).padStart(3, '0')}`
          await saveInterventionPhoto(`${currentProjectId}_intv_${ref}`, after.url, intervention.appartement || undefined)
          grouped[comp]!.apres.push({ id: nanoid(), ref, url: after.url, timestamp: new Date().toISOString() })
        }
      }

      // Construire la mise à jour regroupée en un seul appel
      const update: Partial<Record<PhotoField, PhotoIntervention[]>> = {}
      for (const [comp, photos] of Object.entries(grouped) as [Composante, { avant: PhotoIntervention[]; apres: PhotoIntervention[] }][]) {
        const fields = COMPOSANTE_FIELDS[comp]
        update[fields.avant] = [...((intervention[fields.avant] ?? []) as PhotoIntervention[]), ...photos.avant]
        update[fields.apres] = [...((intervention[fields.apres] ?? []) as PhotoIntervention[]), ...photos.apres]
      }

      console.log('[PhotoMatchingView] saveToIntervention update keys=', Object.keys(update))
      console.log('[PhotoMatchingView] photosChgtHotteAvant=', (update as Record<string,unknown>).photosChgtHotteAvant ? (update as Record<string,unknown[]>).photosChgtHotteAvant?.length : 'absent')
      console.log('[PhotoMatchingView] photosHotteAvant=', (update as Record<string,unknown>).photosHotteAvant ? (update as Record<string,unknown[]>).photosHotteAvant?.length : 'absent')
      updateIntervention(selectedIntvId, update)
      const storeIntv = useAppStore.getState().interventions.find((i) => i.id === selectedIntvId)
      console.log('[PhotoMatchingView] STORE après → ChgtHotte=', storeIntv?.photosChgtHotteAvant?.length, 'Hotte=', storeIntv?.photosHotteAvant?.length)

      const apt      = intervention.appartement || intervention.date
      const compList = [...new Set(pairs.map((p) => COMPOSANTE_LABELS[p.composante]))].join(' · ')
      toast.success(`${pairs.length} paire${pairs.length > 1 ? 's' : ''} enregistrée${pairs.length > 1 ? 's' : ''} → ${apt} · ${compList}`)
      clearAll()
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ── Clavier ───────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'Escape' && lightbox)  { setLightbox(null); return }
      if (e.key === 'ArrowLeft')  setActiveBeforeIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setActiveBeforeIdx((i) => Math.min(Math.max(0, unmatched.length - 1), i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unmatched.length, lightbox])

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const pairedCount     = pairs.length
  const unmatchedBefore = beforePhotos.filter((p) => p.status === 'unmatched').length
  const unmatchedAfter  = afterPhotos.filter((p)  => p.status === 'unmatched').length
  const selectedIntv    = projectInterventions.find((i) => i.id === selectedIntvId)
  const canSave         = !!selectedIntvId && pairedCount > 0

  const TAB = (active: boolean) =>
    `pb-2 text-sm font-semibold border-b-2 transition-colors ${
      active
        ? 'border-blue-600 text-blue-700 dark:text-blue-400'
        : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 select-none">

      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="flex-none px-5 pt-4 pb-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">

        {/* Ligne 1 : titre + tabs + stats */}
        <div className="flex items-center gap-5 flex-wrap mb-3">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-xl">Appariement Avant/Après</h2>
          <button className={TAB(tab === 'match')} onClick={() => setTab('match')}>Matching</button>
          <button className={TAB(tab === 'table')} onClick={() => setTab('table')}>
            Tableau
            {pairedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-bold">
                {pairedCount}
              </span>
            )}
          </button>
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />{beforePhotos.length} avant</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{afterPhotos.length} après</span>
            <span className="flex items-center gap-1.5 text-green-600 font-semibold"><Check className="w-3 h-3" />{pairedCount} paires</span>
            {(unmatchedBefore > 0 || unmatchedAfter > 0) && (
              <span className="flex items-center gap-1 text-orange-500 font-semibold">
                <AlertCircle className="w-3 h-3" />{unmatchedBefore} AV · {unmatchedAfter} AP restantes
              </span>
            )}
          </div>
        </div>

        {/* Ligne 2 : import + destination + enregistrer */}
        <div className="flex items-center gap-2 pb-3 flex-wrap">

          <button onClick={() => beforeInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Importer AVANT
          </button>
          <button onClick={() => afterInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Importer APRÈS
          </button>
          <input ref={beforeInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && importBefore(e.target.files)} />
          <input ref={afterInputRef}  type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && importAfter(e.target.files)} />

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Sélecteur intervention + création rapide */}
          <select
            value={selectedIntvId}
            onChange={(e) => setSelectedIntvId(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[200px]"
          >
            <option value="">— Sélectionner intervention —</option>
            {projectInterventions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.appartement || '?'} · {i.date}
              </option>
            ))}
          </select>

          {/* Bouton créer */}
          <button
            onClick={() => setShowNewIntv((v) => !v)}
            title="Créer une nouvelle intervention"
            className={`p-1.5 rounded-lg border transition-colors ${
              showNewIntv
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Mini-formulaire création */}
          {showNewIntv && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl">
              <input
                value={newApt}
                onChange={(e) => setNewApt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createIntervention(); if (e.key === 'Escape') setShowNewIntv(false) }}
                placeholder="Appartement"
                autoFocus
                className="text-xs border border-indigo-200 dark:border-indigo-700 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-300 select-text"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="text-xs border border-indigo-200 dark:border-indigo-700 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={createIntervention}
                disabled={!newApt.trim()}
                className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Créer
              </button>
              <button onClick={() => setShowNewIntv(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Composante */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {(Object.keys(COMPOSANTE_LABELS) as Composante[]).map((c) => (
              <button key={c} onClick={() => changeComposante(c)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  composante === c
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {COMPOSANTE_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Bouton enregistrer */}
          <button
            onClick={saveToIntervention}
            disabled={!canSave || saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              canSave && !saving
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={!selectedIntvId ? 'Sélectionnez une intervention' : pairedCount === 0 ? 'Créez des paires d\'abord' : ''}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Enregistrement…' : `Enregistrer${pairedCount > 0 ? ` (${pairedCount})` : ''}`}
          </button>

          {/* Aperçu destination */}
          {selectedIntv && (
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
              → Apt.&nbsp;{selectedIntv.appartement} · prochaine paire → <strong>{COMPOSANTE_LABELS[composante]}</strong>
            </span>
          )}

          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <button onClick={clearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Tout effacer
            </button>
          )}
        </div>
      </div>

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ══ ONGLET MATCHING ══════════════════════════════════════════════ */}
        {tab === 'match' && (
          <div className="h-full flex">

            {/* Colonne AVANT */}
            <div className="flex-none w-[44%] min-w-[280px] flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {unmatched.length > 0
                    ? `Avant — ${Math.min(activeBeforeIdx, unmatched.length - 1) + 1} / ${unmatched.length}`
                    : beforePhotos.length > 0 ? 'Avant — Toutes appariées' : 'Avant'}
                </span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setActiveBeforeIdx((i) => Math.max(0, i - 1))}
                    disabled={activeBeforeIdx === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-25 transition-colors"
                    title="← Photo précédente">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setActiveBeforeIdx((i) => Math.min(Math.max(0, unmatched.length - 1), i + 1))}
                    disabled={activeBeforeIdx >= unmatched.length - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-25 transition-colors"
                    title="→ Photo suivante">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-5 gap-3 bg-gray-50 dark:bg-gray-850 overflow-hidden">
                {current ? (
                  <>
                    <img src={current.url} onClick={() => setLightbox(current.url)}
                      className="max-w-full max-h-[52vh] object-contain rounded-xl shadow-lg cursor-zoom-in" />
                    <span className="text-[10px] text-gray-300 dark:text-gray-600 truncate max-w-xs">{current.filename}</span>
                    <p className="text-[10px] text-blue-400/70">Cliquez sur la photo APRÈS correspondante →</p>
                  </>
                ) : beforePhotos.length === 0 ? (
                  <div className="text-center text-gray-300 dark:text-gray-600">
                    <Upload className="w-14 h-14 mx-auto mb-3" />
                    <p className="text-sm font-medium">Importez des photos AVANT</p>
                  </div>
                ) : (
                  <div className="text-center text-green-500">
                    <Check className="w-14 h-14 mx-auto mb-3" />
                    <p className="text-sm font-semibold">Toutes appariées !</p>
                    <button onClick={() => setTab('table')} className="mt-2 text-xs text-blue-500 hover:underline">
                      Voir le tableau →
                    </button>
                  </div>
                )}
              </div>

              {beforePhotos.length > 0 && (
                <div className="flex-none px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${beforePhotos.length > 0 ? (pairedCount / beforePhotos.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{pairedCount}/{beforePhotos.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Colonne APRÈS */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                  Après — {afterPhotos.filter((p) => p.status === 'unmatched').length} disponibles
                  {afterPhotos.filter((p) => p.status === 'paired').length > 0 && (
                    <span className="text-gray-400 font-normal">
                      {' '}· {afterPhotos.filter((p) => p.status === 'paired').length} appariées
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-400">Clic = apparier · ← → naviguer AVANT</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {afterPhotos.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                    <div className="text-center">
                      <Upload className="w-14 h-14 mx-auto mb-3" />
                      <p className="text-sm font-medium">Importez des photos APRÈS</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                    {afterPhotos.map((ph) => {
                      const isPaired  = ph.status === 'paired'
                      const canPair   = !!current && !isPaired
                      const pairInfo  = pairs.find((p) => p.afterId === ph.id)
                      return (
                        <div key={ph.id}
                          onClick={() => canPair && pairWith(ph.id)}
                          className={`relative rounded-xl overflow-hidden transition-all border-2 ${
                            isPaired
                              ? 'border-green-400 opacity-60 cursor-default'
                              : canPair
                              ? 'border-transparent cursor-pointer hover:border-green-500 hover:shadow-lg hover:scale-[1.03]'
                              : 'border-transparent cursor-default opacity-60'
                          }`}
                        >
                          <img src={ph.url} className="w-full aspect-square object-cover" />
                          {isPaired && pairInfo && (
                            <div className="absolute top-1 left-1">
                              <span className="px-1.5 py-0.5 bg-indigo-600/90 text-white text-[8px] font-bold rounded-md shadow">
                                {COMPOSANTE_LABELS[pairInfo.composante]}
                              </span>
                            </div>
                          )}
                          {isPaired && (
                            <div className="absolute top-1 right-1">
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1">
                            <p className="text-[8px] text-white/90 truncate">{ph.filename}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ ONGLET TABLEAU ═══════════════════════════════════════════════ */}
        {tab === 'table' && (
          <div className="h-full overflow-y-auto p-5">
            {pairs.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                <Link className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune paire créée</p>
                <button onClick={() => setTab('match')} className="mt-2 text-xs text-blue-500 hover:underline">
                  Aller au mode Matching →
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">

                {/* Bandeau destination + enregistrer */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex items-center gap-6 flex-wrap">
                  <div className="flex gap-4 text-sm">
                    <span className="text-blue-700 dark:text-blue-300 font-bold">{beforePhotos.length} Avant</span>
                    <span className="text-green-700 dark:text-green-300 font-bold">{afterPhotos.length} Après</span>
                    <span className="text-indigo-700 dark:text-indigo-300 font-bold">{pairedCount} paires</span>
                  </div>
                  {selectedIntv ? (
                    <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex-wrap">
                      <Save className="w-3.5 h-3.5" />
                      → Apt.&nbsp;{selectedIntv.appartement} ·{' '}
                      {[...new Set(pairs.map((p) => COMPOSANTE_LABELS[p.composante]))].join(' + ')}
                    </div>
                  ) : (
                    <p className="text-xs text-orange-500 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Sélectionnez une intervention en haut pour enregistrer
                    </p>
                  )}
                  <button onClick={saveToIntervention} disabled={!canSave || saving}
                    className={`ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                      canSave && !saving
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-300 cursor-not-allowed'
                    }`}>
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Enregistrement…' : `Enregistrer ${pairedCount} paire${pairedCount > 1 ? 's' : ''} →`}
                  </button>
                </div>

                {/* Tableau groupé par composante */}
                {(Object.keys(COMPOSANTE_LABELS) as Composante[])
                  .map((comp) => ({ comp, compPairs: pairs.filter((p) => p.composante === comp) }))
                  .filter(({ compPairs }) => compPairs.length > 0)
                  .map(({ comp, compPairs }) => (
                    <div key={comp} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {/* En-tête groupe */}
                      <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{COMPOSANTE_LABELS[comp]}</span>
                        <span className="text-[10px] text-gray-400">{compPairs.length} paire{compPairs.length > 1 ? 's' : ''}</span>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <th className="px-5 py-2 text-left text-[11px] font-bold text-gray-400 uppercase w-8">#</th>
                            <th className="px-5 py-2 text-left text-[11px] font-bold text-blue-600 uppercase tracking-wider w-[45%]">Avant (Av:)</th>
                            <th className="px-5 py-2 text-left text-[11px] font-bold text-green-600 uppercase tracking-wider w-[45%]">Après (Ap:)</th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {compPairs.map((pair, idx) => {
                            const before = beforePhotos.find((p) => p.id === pair.beforeId)
                            const after  = afterPhotos.find((p)  => p.id === pair.afterId)
                            return (
                              <tr key={pair.id} className="group border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="px-5 py-2.5">
                                  <span className="text-xs font-bold text-gray-300 dark:text-gray-600">{idx + 1}</span>
                                </td>
                                <td className="px-5 py-2.5">
                                  {before && (
                                    <div className="flex items-center gap-3">
                                      <img src={before.url} onClick={() => setLightbox(before.url)}
                                        className="w-16 h-16 object-cover rounded-lg border-2 border-blue-200 dark:border-blue-700 flex-shrink-0 cursor-zoom-in hover:border-blue-400 transition-colors" />
                                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{before.filename}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-2.5">
                                  {after && (
                                    <div className="flex items-center gap-3">
                                      <img src={after.url} onClick={() => setLightbox(after.url)}
                                        className="w-16 h-16 object-cover rounded-lg border-2 border-green-200 dark:border-green-700 flex-shrink-0 cursor-zoom-in hover:border-green-400 transition-colors" />
                                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{after.filename}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <button onClick={() => unpair(pair.id)} title="Dissocier"
                                    className="p-1.5 text-gray-200 dark:text-gray-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))
                }

                {/* Photos AVANT non appariées */}
                {unmatchedBefore > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
                    <p className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {unmatchedBefore} photo{unmatchedBefore > 1 ? 's' : ''} AVANT non appariée{unmatchedBefore > 1 ? 's' : ''}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {beforePhotos.filter((p) => p.status === 'unmatched').map((p) => (
                        <img key={p.id} src={p.url} title={p.filename}
                          className="w-14 h-14 object-cover rounded-lg border-2 border-orange-300 cursor-zoom-in"
                          onClick={() => setLightbox(p.url)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-[90vw] max-h-[88vh] object-contain rounded-xl shadow-2xl" />
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs">Clic ou Échap pour fermer</p>
        </div>
      )}
    </div>
  )
}
