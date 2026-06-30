import { useState, useEffect, useRef } from 'react'
import { Upload, ChevronLeft, ChevronRight, Check, X, AlertCircle, Save, Layers } from 'lucide-react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { saveTravailPhoto } from '@/services/travailPhotoStorage'
import type { Photo } from '@/types/index'

// ── Types locaux ──────────────────────────────────────────────────────────────

interface MatchPhoto {
  id:       string
  url:      string
  filename: string
  type:     'before' | 'after'
  status:   'unmatched' | 'paired'
}

interface Pair {
  id:       string
  beforeId: string
  afterId:  string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  travailId:   string
  systemeSlug?: string
  onSave:      (avant: Photo[], apres: Photo[]) => void
  onClose:     () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readFiles(files: FileList, type: 'before' | 'after'): Promise<MatchPhoto[]> {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
  const result: MatchPhoto[] = []
  for (const f of arr) {
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(f)
    })
    result.push({ id: nanoid(), url, filename: f.name, type, status: 'unmatched' })
  }
  return result
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function TravailMatchingModal({ systemeSlug, onSave, onClose }: Props) {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const consumePhotoRef  = useAppStore((s) => s.consumePhotoRef)

  const [beforePhotos,    setBeforePhotos]    = useState<MatchPhoto[]>([])
  const [afterPhotos,     setAfterPhotos]     = useState<MatchPhoto[]>([])
  const [pairs,           setPairs]           = useState<Pair[]>([])
  const [activeBeforeIdx, setActiveBeforeIdx] = useState(0)
  const [lightbox,        setLightbox]        = useState<string | null>(null)
  const [saving,          setSaving]          = useState(false)

  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef  = useRef<HTMLInputElement>(null)

  const unmatched = beforePhotos.filter((p) => p.status === 'unmatched')
  const current   = unmatched[Math.min(activeBeforeIdx, Math.max(0, unmatched.length - 1))] ?? null
  const pairedCount = pairs.length

  // ── Import ─────────────────────────────────────────────────────────────────

  async function importBefore(files: FileList) {
    const photos = await readFiles(files, 'before')
    setBeforePhotos((prev) => [...prev, ...photos])
  }

  async function importAfter(files: FileList) {
    const photos = await readFiles(files, 'after')
    setAfterPhotos((prev) => [...prev, ...photos])
  }

  // ── Appariement ────────────────────────────────────────────────────────────

  function pairWith(afterId: string) {
    if (!current) return
    setPairs((prev) => [...prev, { id: nanoid(), beforeId: current.id, afterId }])
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

  // ── Enregistrer ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (pairs.length === 0 || !currentProjectId) return
    setSaving(true)
    try {
      const newAvant: Photo[] = []
      const newApres: Photo[] = []

      for (const pair of pairs) {
        const before = beforePhotos.find((p) => p.id === pair.beforeId)
        const after  = afterPhotos.find((p)  => p.id === pair.afterId)

        if (before) {
          const ref = consumePhotoRef()
          const key = `${currentProjectId}_${ref}`
          await saveTravailPhoto(key, before.url, systemeSlug)
          newAvant.push({ id: nanoid(), ref, url: before.url, timestamp: new Date().toISOString() })
        }
        if (after) {
          const ref = consumePhotoRef()
          const key = `${currentProjectId}_${ref}`
          await saveTravailPhoto(key, after.url, systemeSlug)
          newApres.push({ id: nanoid(), ref, url: after.url, timestamp: new Date().toISOString() })
        }
      }

      onSave(newAvant, newApres)
      toast.success(`${pairs.length} paire${pairs.length > 1 ? 's' : ''} enregistrée${pairs.length > 1 ? 's' : ''}`)
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ── Clavier ────────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') { if (lightbox) { setLightbox(null) } else { onClose() } ; return }
      if (e.key === 'ArrowLeft')  setActiveBeforeIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setActiveBeforeIdx((i) => Math.min(Math.max(0, unmatched.length - 1), i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unmatched.length, lightbox])

  const unmatchedBefore = beforePhotos.filter((p) => p.status === 'unmatched').length
  const unmatchedAfter  = afterPhotos.filter((p)  => p.status === 'unmatched').length

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/60 backdrop-blur-sm">
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-2xl m-4 rounded-2xl overflow-hidden">

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Layers className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">Appariement photos — Épingle</h2>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 ml-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />{beforePhotos.length} avant</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{afterPhotos.length} après</span>
            {pairedCount > 0 && (
              <span className="flex items-center gap-1.5 text-green-600 font-semibold"><Check className="w-3 h-3" />{pairedCount} paires</span>
            )}
            {(unmatchedBefore > 0 || unmatchedAfter > 0) && pairedCount > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertCircle className="w-3 h-3" />{unmatchedBefore} AV · {unmatchedAfter} AP restantes
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Import */}
            <button onClick={() => beforeInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              <Upload className="w-3 h-3" /> Importer AVANT
            </button>
            <button onClick={() => afterInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
              <Upload className="w-3 h-3" /> Importer APRÈS
            </button>
            <input ref={beforeInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && importBefore(e.target.files)} />
            <input ref={afterInputRef}  type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && importAfter(e.target.files)} />

            {/* Enregistrer */}
            <button onClick={handleSave} disabled={pairedCount === 0 || saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                pairedCount > 0 && !saving
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-300 cursor-not-allowed'
              }`}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Enregistrement…' : `Enregistrer${pairedCount > 0 ? ` (${pairedCount})` : ''}`}
            </button>

            {/* Fermer */}
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Fermer (Échap)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Corps — 2 colonnes ───────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Colonne AVANT */}
          <div className="flex-none w-[44%] min-w-[260px] flex flex-col border-r border-gray-200 dark:border-gray-700">

            <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                {unmatched.length > 0
                  ? `Avant — ${Math.min(activeBeforeIdx, unmatched.length - 1) + 1} / ${unmatched.length}`
                  : beforePhotos.length > 0 ? 'Avant — Toutes appariées' : 'Avant'}
              </span>
              <div className="flex gap-0.5">
                <button onClick={() => setActiveBeforeIdx((i) => Math.max(0, i - 1))}
                  disabled={activeBeforeIdx === 0}
                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 disabled:opacity-25 transition-colors"
                  title="← Photo précédente">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setActiveBeforeIdx((i) => Math.min(Math.max(0, unmatched.length - 1), i + 1))}
                  disabled={activeBeforeIdx >= unmatched.length - 1}
                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 disabled:opacity-25 transition-colors"
                  title="→ Photo suivante">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-5 gap-3 bg-gray-50 dark:bg-gray-850 overflow-hidden">
              {current ? (
                <>
                  <img src={current.url} onClick={() => setLightbox(current.url)}
                    className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-lg cursor-zoom-in" />
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
                </div>
              )}
            </div>

            {beforePhotos.length > 0 && (
              <div className="flex-none px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(pairedCount / beforePhotos.length) * 100}%` }} />
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
              <span className="text-[10px] text-gray-400">Clic = apparier · ← → naviguer AVANT · Échap = fermer</span>
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
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                  {afterPhotos.map((ph) => {
                    const isPaired = ph.status === 'paired'
                    const canPair  = !!current && !isPaired
                    const pairInfo = pairs.find((p) => p.afterId === ph.id)
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
                            <span className="px-1.5 py-0.5 bg-black/60 text-white text-[8px] font-bold rounded">
                              Paire {pairs.findIndex((p) => p.id === pairInfo.id) + 1}
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
                        {isPaired && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (pairInfo) unpair(pairInfo.id) }}
                            className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            title="Dissocier">
                            <X className="w-3 h-3 text-white" />
                          </button>
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

        {/* ── Résumé paires ────────────────────────────────────────────── */}
        {pairs.length > 0 && (
          <div className="flex-none border-t border-gray-100 dark:border-gray-800 px-4 py-2 bg-gray-50 dark:bg-gray-850">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Paires :</span>
              {pairs.map((pair, idx) => {
                const before = beforePhotos.find((p) => p.id === pair.beforeId)
                const after  = afterPhotos.find((p)  => p.id === pair.afterId)
                return (
                  <div key={pair.id} className="flex items-center gap-1 shrink-0 group">
                    <span className="text-[9px] text-gray-400 font-bold">{idx + 1}.</span>
                    {before && <img src={before.url} className="w-9 h-9 object-cover rounded border-2 border-blue-300" />}
                    <span className="text-gray-300">↔</span>
                    {after  && <img src={after.url}  className="w-9 h-9 object-cover rounded border-2 border-green-300" />}
                    <button onClick={() => unpair(pair.id)}
                      className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                      <X className="w-2.5 h-2.5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox ───────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-[90vw] max-h-[88vh] object-contain rounded-xl shadow-2xl" />
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
