import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Plus, Trash2, Camera, X, FileText, Image, ChevronDown } from 'lucide-react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { COMPOSANTES_CVAC, STATUT_TRAVAIL, ACCESS_DOOR_TYPE_LABELS, ANOMALIE_LABELS } from '@/types'
// STATUT_TRAVAIL utilisé pour la couleur du cercle #
import type { TravailNettoyage, Photo, TypeComposanteCVAC, AccessDoorType, TypeAnomalie } from '@/types'
import { saveTravailPhoto, deleteTravailPhoto } from '@/services/travailPhotoStorage'
import SansPlanPhotoMatchingModal from './SansPlanPhotoMatchingModal'

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_CLS = [
  'w-full bg-transparent text-xs text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600',
  'border border-transparent rounded px-1.5 py-1',
  'hover:border-gray-200 dark:hover:border-gray-700',
  'focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800/60',
  'transition-colors',
].join(' ')

const SELECT_CLS = INPUT_CLS + ' cursor-pointer'

// ── Catalogue dimensions par type (identique à DoorPanel) ────────────────────

const DIM_OPTS: Record<AccessDoorType, string[]> = {
  acces:         ['8" x 5"', '12" x 6"', '12" x 12"', '16" x 16"', '18" x 10"', '18" x 18"', '21" x 14"', '24" x 12"', '25" x 17"'],
  architectural: ['12" x 12"', '16" x 16"', '18" x 18"', '24" x 24"', '30" x 30"'],
  plaque:        ['4" x 4"', '5" x 5"', '6" x 6"', '8" x 8"', '10" x 10"', '12" x 12"', '14" x 14"', '16" x 16"', '18" x 18"', '20" x 20"', '24" x 24"'],
}

const DOOR_TYPE_STYLE: Record<AccessDoorType, { bg: string; text: string; border: string; hdr: string; hdrText: string; prefix: string }> = {
  acces:         { bg: 'bg-blue-100 dark:bg-blue-900/40',   text: 'text-blue-800 dark:text-blue-200',   border: 'border-blue-300 dark:border-blue-700',   hdr: 'bg-blue-600',   hdrText: 'text-white', prefix: 'PA'    },
  architectural: { bg: 'bg-teal-100 dark:bg-teal-900/40',   text: 'text-teal-800 dark:text-teal-200',   border: 'border-teal-300 dark:border-teal-700',   hdr: 'bg-teal-700',   hdrText: 'text-white', prefix: 'P.Ar.' },
  plaque:        { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-700', hdr: 'bg-amber-600',  hdrText: 'text-white', prefix: 'PL'    },
}

type PorteLibre = { type: AccessDoorType; dimensions: string; statut?: 'existante' | 'ajoutee' }

function makeKey(p: PorteLibre) { return `${p.type}::${p.dimensions}` }

const ANOMALIE_STYLE: Record<TypeAnomalie, { bg: string; text: string; border: string }> = {
  corrosion:   { bg: 'bg-orange-100 dark:bg-orange-900/40',  text: 'text-orange-800 dark:text-orange-200',  border: 'border-orange-300 dark:border-orange-700'  },
  moisissure:  { bg: 'bg-green-100 dark:bg-green-900/40',    text: 'text-green-800 dark:text-green-200',    border: 'border-green-300 dark:border-green-700'    },
  fuite:       { bg: 'bg-blue-100 dark:bg-blue-900/40',      text: 'text-blue-800 dark:text-blue-200',      border: 'border-blue-300 dark:border-blue-700'      },
  deformation: { bg: 'bg-purple-100 dark:bg-purple-900/40',  text: 'text-purple-800 dark:text-purple-200',  border: 'border-purple-300 dark:border-purple-700'  },
  obstruction: { bg: 'bg-amber-100 dark:bg-amber-900/40',    text: 'text-amber-800 dark:text-amber-200',    border: 'border-amber-300 dark:border-amber-700'    },
  autre:       { bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-300',      border: 'border-gray-300 dark:border-gray-600'      },
}

function AnomaliesSelect({ value, onChange }: { value: TypeAnomalie[]; onChange: (v: TypeAnomalie[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(type: TypeAnomalie) {
    onChange(value.includes(type) ? value.filter((t) => t !== type) : [...value, type])
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[28px] text-left flex flex-wrap gap-1 px-1.5 py-1 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:outline-none transition-colors"
      >
        {value.length === 0 ? (
          <span className="text-[10px] text-gray-300 dark:text-gray-600 italic self-center">Aucune</span>
        ) : value.map((t) => {
          const s = ANOMALIE_STYLE[t]
          return (
            <span key={t} className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${s.bg} ${s.text} ${s.border}`}>
              {ANOMALIE_LABELS[t]}
            </span>
          )
        })}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1.5 min-w-[170px]">
          {(Object.keys(ANOMALIE_LABELS) as TypeAnomalie[]).map((type) => {
            const s = ANOMALIE_STYLE[type]
            const checked = value.includes(type)
            return (
              <label key={type} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggle(type)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className={`text-xs font-medium ${s.text}`}>{ANOMALIE_LABELS[type]}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Multi-select ouvertures de service (catalogue dimensions) ─────────────────

function DimPortesSelect({
  value, onChange,
}: {
  value:    PorteLibre[]
  onChange: (val: PorteLibre[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const selectedKeys = new Set(value.map(makeKey))

  function toggle(item: PorteLibre) {
    const key = makeKey(item)
    if (selectedKeys.has(key)) {
      onChange(value.filter((v) => makeKey(v) !== key))
    } else {
      onChange([...value, { ...item, statut: 'ajoutee' }])
    }
  }

  function remove(item: PorteLibre) {
    const key = makeKey(item)
    onChange(value.filter((v) => makeKey(v) !== key))
  }

  function toggleExistant(item: PorteLibre) {
    const key = makeKey(item)
    onChange(value.map((v) => makeKey(v) === key
      ? { ...v, statut: v.statut === 'existante' ? 'ajoutee' : 'existante' }
      : v
    ))
  }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1 min-h-[26px] px-1.5 py-1 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:outline-none focus:border-blue-400 transition-colors text-left"
      >
        <div className="flex-1 flex flex-wrap gap-0.5 min-w-0">
          {value.length === 0 ? (
            <span className="text-[10px] text-gray-300 dark:text-gray-600 italic">Choisir…</span>
          ) : (
            value.map((item) => {
              const s = DOOR_TYPE_STYLE[item.type]
              return (
                <span
                  key={makeKey(item)}
                  className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold border ${s.bg} ${s.text} ${s.border}`}
                  title={`${ACCESS_DOOR_TYPE_LABELS[item.type]} · ${item.dimensions}${item.statut === 'existante' ? ' · Existante' : ''}`}
                >
                  {s.prefix} {item.dimensions}
                  {item.statut === 'existante' && (
                    <span className="text-[8px] font-bold opacity-60 ml-0.5">·Ex</span>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                    onClick={(e) => { e.stopPropagation(); remove(item) }}
                    className="hover:opacity-70 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )
            })
          )}
        </div>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 top-full mt-0.5 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-80">
          {(Object.entries(DIM_OPTS) as [AccessDoorType, string[]][]).map(([type, dims]) => {
            const s = DOOR_TYPE_STYLE[type]
            return (
              <div key={type}>
                <div className={`px-3 py-1.5 ${s.hdr} flex items-center gap-2`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${s.hdrText}`}>
                    {ACCESS_DOOR_TYPE_LABELS[type]}
                  </span>
                  <span className={`text-[9px] font-bold px-1 rounded bg-white/20 ${s.hdrText}`}>
                    {s.prefix}
                  </span>
                </div>
                {dims.map((dim) => {
                  const item: PorteLibre = { type, dimensions: dim }
                  const key = makeKey(item)
                  const checked = selectedKeys.has(key)
                  const existing = value.find((v) => makeKey(v) === key)
                  const isExistante = existing?.statut === 'existante'
                  return (
                    <div
                      key={dim}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/30 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <span className="text-[12px] font-mono text-gray-700 dark:text-gray-300 flex-1">
                        {dim}
                      </span>
                      {checked && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => { e.stopPropagation(); toggleExistant(existing!) }}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all flex-shrink-0 ${
                            isExistante
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                          }`}
                          title={isExistante ? 'Marquer comme ajoutée' : 'Marquer comme existante'}
                        >
                          Exist.
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mini bande photos (Av / Ap) ───────────────────────────────────────────────

function PhotoStrip({
  label, photos, onAdd, onRemove,
}: {
  label:    string
  photos:   Photo[]
  onAdd:    (files: FileList) => void
  onRemove: (ref: string) => void
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const shown     = photos.filter((p) => p.url)
  const [viewerIdx, setViewerIdx] = useState<number | null>(null)

  const closeViewer = useCallback(() => setViewerIdx(null), [])

  useEffect(() => {
    if (viewerIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     setViewerIdx(null)
      if (e.key === 'ArrowRight') setViewerIdx((i) => (i !== null && i < shown.length - 1) ? i + 1 : i)
      if (e.key === 'ArrowLeft')  setViewerIdx((i) => (i !== null && i > 0) ? i - 1 : i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerIdx, shown.length])

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap min-h-[20px]">
        <span className="text-[8px] font-bold uppercase w-4 flex-shrink-0 select-none"
          style={{ color: label === 'Av' ? '#f97316' : '#16a34a' }}>
          {label}
        </span>
        {photos.map((ph, idx) => (
          <div key={ph.ref} className="relative group flex-shrink-0">
            {ph.url ? (
              <img
                src={ph.url}
                onClick={() => setViewerIdx(idx)}
                className="w-7 h-7 object-cover rounded border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-80 transition-opacity"
              />
            ) : (
              <span className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-[8px] font-mono text-gray-500">
                {ph.ref}
              </span>
            )}
            <span className="absolute bottom-0 right-0 text-[5px] font-bold leading-none bg-black/70 text-white px-0.5 rounded-tl pointer-events-none">
              {ph.ref}
            </span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onRemove(ph.ref) }}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10"
            >
              <X className="w-2 h-2" />
            </button>
          </div>
        ))}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          title={`Ajouter photo ${label}`}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-colors"
        >
          <Camera className="w-2.5 h-2.5" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && onAdd(e.target.files)} />
      </div>

      {/* ── Viewer plein écran ─────────────────────────────────────────────── */}
      {viewerIdx !== null && shown[viewerIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={closeViewer}
        >
          <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={shown[viewerIdx].url}
              className="max-w-[90vw] max-h-[78vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="flex items-center gap-4">
              {shown.length > 1 && (
                <button
                  onClick={() => setViewerIdx((i) => (i !== null && i > 0) ? i - 1 : i)}
                  disabled={viewerIdx === 0}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg text-sm transition-colors"
                >
                  ← Préc.
                </button>
              )}
              <span className="text-white/80 text-sm font-mono select-none">
                {label} — {shown[viewerIdx].ref}
                {shown.length > 1 && ` (${viewerIdx + 1} / ${shown.length})`}
              </span>
              {shown.length > 1 && (
                <button
                  onClick={() => setViewerIdx((i) => (i !== null && i < shown.length - 1) ? i + 1 : i)}
                  disabled={viewerIdx === shown.length - 1}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg text-sm transition-colors"
                >
                  Suiv. →
                </button>
              )}
            </div>
          </div>
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors"
            onClick={closeViewer}
          >
            <X className="w-5 h-5" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs select-none">
            Clic ou Échap pour fermer · ← → pour naviguer
          </p>
        </div>
      )}
    </>
  )
}

// ── Ligne éditable ────────────────────────────────────────────────────────────

function TravailRow({
  travail, projectId, systemes, autoFocus, isChecked, onToggleCheck,
}: {
  travail:       TravailNettoyage
  projectId:     string
  systemes:      { id: string; nom: string }[]
  autoFocus:     boolean
  isChecked:     boolean
  onToggleCheck: (e: React.MouseEvent) => void
}) {
  const updateTravail  = useAppStore((s) => s.updateTravail)
  const deleteTravail  = useAppStore((s) => s.deleteTravail)
  const consumePhotoRef = useAppStore((s) => s.consumePhotoRef)

  const [local, setLocal] = useState<TravailNettoyage>(travail)
  const dirty = useRef(false)
  const firstRef = useRef<HTMLSelectElement>(null)

  // Resync depuis le store quand les données changent en dehors de la ligne (ex. appariement photos)
  useEffect(() => {
    if (!dirty.current) setLocal(travail)
  }, [travail])

  useEffect(() => {
    if (autoFocus) firstRef.current?.focus()
  }, [autoFocus])

  function patch(data: Partial<TravailNettoyage>) {
    setLocal((prev) => ({ ...prev, ...data }))
    dirty.current = true
  }

  function save() {
    if (!dirty.current) return
    updateTravail(local.id, { ...local, updatedAt: new Date().toISOString() })
    dirty.current = false
  }

  function saveNow(data: Partial<TravailNettoyage>) {
    const updated = { ...local, ...data, updatedAt: new Date().toISOString() }
    setLocal(updated)
    updateTravail(updated.id, updated)
    dirty.current = false
  }

  function handleRowBlur(e: React.FocusEvent<HTMLTableRowElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    save()
  }

  async function handleAddPhoto(field: 'photosAvant' | 'photosApres', files: FileList) {
    const newPhotos: Photo[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f)
      })
      const ref = consumePhotoRef()
      const key = `${projectId}_${ref}`
      await saveTravailPhoto(key, url)
      newPhotos.push({ id: nanoid(), ref, url, timestamp: new Date().toISOString() })
    }
    saveNow({ [field]: [...(local[field] ?? []), ...newPhotos] })
  }

  async function handleRemovePhoto(field: 'photosAvant' | 'photosApres', ref: string) {
    await deleteTravailPhoto(`${projectId}_${ref}`)
    saveNow({ [field]: (local[field] ?? []).filter((p) => p.ref !== ref) })
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer le travail #${local.numero} ?`)) return
    await deleteTravail(local.id)
    toast.success('Travail supprimé')
  }

  const stat      = STATUT_TRAVAIL[local.statut]
  const tdCls     = 'border-b border-r border-gray-100 dark:border-gray-800 px-1 py-0.5 align-top'
  const avPhotos  = local.photosAvant  ?? []
  const apPhotos  = local.photosApres  ?? []

  return (
    <tr onBlur={handleRowBlur} className={`group transition-colors ${isChecked ? 'bg-red-50/60 dark:bg-red-900/10' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/10'}`}>

      {/* Checkbox */}
      <td className={tdCls} style={{ width: 32, textAlign: 'center' }} onClick={onToggleCheck}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => {}}
          className="rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
        />
      </td>

      {/* # */}
      <td className={tdCls} style={{ width: 36, textAlign: 'center' }}>
        <div className="w-7 h-7 mx-auto rounded-lg text-xs font-bold text-white flex items-center justify-center"
          style={{ background: stat.color }}>
          {local.numero}
        </div>
      </td>

      {/* Système */}
      <td className={tdCls} style={{ minWidth: 110 }}>
        <select
          ref={firstRef}
          value={local.systemeId ?? ''}
          onChange={(e) => patch({ systemeId: e.target.value })}
          onBlur={save}
          className={SELECT_CLS}
        >
          <option value="">— Système</option>
          {systemes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </td>

      {/* Composante */}
      <td className={tdCls} style={{ minWidth: 140 }}>
        <select
          value={local.typeComposante ?? ''}
          onChange={(e) => patch({ typeComposante: e.target.value as TypeComposanteCVAC || undefined })}
          onBlur={save}
          className={SELECT_CLS}
        >
          <option value="">— Composante</option>
          {Object.entries(COMPOSANTES_CVAC).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </td>

      {/* Zone / Secteur */}
      <td className={tdCls} style={{ minWidth: 110 }}>
        <input type="text" value={local.location ?? ''} onChange={(e) => patch({ location: e.target.value })}
          onBlur={save} placeholder="Zone / Secteur…" className={INPUT_CLS} />
      </td>

      {/* Localisation */}
      <td className={tdCls} style={{ minWidth: 110 }}>
        <input type="text" value={local.zoneDesservie ?? ''} onChange={(e) => patch({ zoneDesservie: e.target.value })}
          onBlur={save} placeholder="Localisation…" className={INPUT_CLS} />
      </td>

      {/* Date */}
      <td className={tdCls} style={{ minWidth: 120 }}>
        <input type="date" value={local.dateDebut ?? ''} onChange={(e) => patch({ dateDebut: e.target.value })}
          onBlur={save} className={INPUT_CLS + ' text-xs'} />
      </td>

      {/* Photos Av / Ap */}
      <td className={tdCls} style={{ minWidth: 200 }}>
        <div className="flex flex-col gap-1 px-0.5 py-0.5">
          {(avPhotos.length > 0 || apPhotos.length > 0) && (
            <div className="text-[9px] leading-snug space-y-0.5 px-1 mb-0.5">
              {avPhotos.length > 0 && <div><span className="font-bold text-orange-500">Av:</span> <span className="font-mono text-gray-600 dark:text-gray-400">{avPhotos.map((p) => p.ref).join(' ')}</span></div>}
              {apPhotos.length > 0 && <div><span className="font-bold text-green-600">Ap:</span> <span className="font-mono text-gray-600 dark:text-gray-400">{apPhotos.map((p) => p.ref).join(' ')}</span></div>}
            </div>
          )}
          <PhotoStrip label="Av" photos={avPhotos}
            onAdd={(files) => handleAddPhoto('photosAvant', files)}
            onRemove={(ref) => handleRemovePhoto('photosAvant', ref)} />
          <PhotoStrip label="Ap" photos={apPhotos}
            onAdd={(files) => handleAddPhoto('photosApres', files)}
            onRemove={(ref) => handleRemovePhoto('photosApres', ref)} />
        </div>
      </td>

      {/* Ouvertures de service installées */}
      <td className={tdCls} style={{ minWidth: 160 }}>
        <DimPortesSelect
          value={local.portesInstalleesLibres ?? []}
          onChange={(val) => saveNow({ portesInstalleesLibres: val })}
        />
      </td>

      {/* Anomalies observées */}
      <td className={tdCls} style={{ minWidth: 160 }}>
        <AnomaliesSelect
          value={(local.anomalies ?? []).map((a) => a.type)}
          onChange={(types) => saveNow({
            anomalies: types.map((t) => {
              const existing = (local.anomalies ?? []).find((a) => a.type === t)
              return existing ?? { id: nanoid(), type: t, description: '', photos: [] }
            })
          })}
        />
      </td>

      {/* Notes / Particularités */}
      <td className={tdCls} style={{ minWidth: 180 }}>
        <input type="text" value={local.observationsAvant ?? ''} onChange={(e) => patch({ observationsAvant: e.target.value })}
          onBlur={save} placeholder="Notes…" className={INPUT_CLS} />
      </td>

      {/* Fiche dans le rapport PDF */}
      <td className={tdCls} style={{ width: 80, textAlign: 'center' }}>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => saveNow({ includeInReport: !(local.includeInReport ?? true) })}
          title={(local.includeInReport ?? true) ? 'Exclure du rapport PDF' : 'Inclure dans le rapport PDF'}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
            (local.includeInReport ?? true)
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
              : 'bg-gray-50 dark:bg-gray-700/30 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'
          }`}
        >
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className={`w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            (local.includeInReport ?? true) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
          }`}>
            {(local.includeInReport ?? true) && (
              <svg viewBox="0 0 10 8" className="w-2 h-1.5 fill-white"><path d="M1 4l3 3 5-6"/></svg>
            )}
          </span>
        </button>
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

export default function SansPlanTableView() {
  const [newRowId, setNewRowId] = useState<string | null>(null)
  const [showMatching, setShowMatching] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const currentProjectId     = useAppStore((s) => s.currentProjectId)
  const project              = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const addStandaloneTravail = useAppStore((s) => s.addStandaloneTravail)
  const deleteTravail        = useAppStore((s) => s.deleteTravail)
  const travaux              = useAppStore((s) =>
    s.travaux.filter((t) => !t.planId && t.projectId === s.currentProjectId)
  )
  const systemes = project?.systemes ?? []

  const sorted = useMemo(
    () => [...travaux].sort((a, b) => a.numero - b.numero),
    [travaux],
  )

  const toggleCheck = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCheckedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  function deleteChecked() {
    checkedIds.forEach((id) => deleteTravail(id))
    setCheckedIds(new Set())
  }

  const allSortedChecked = sorted.length > 0 && sorted.every((t) => checkedIds.has(t.id))

  function toggleAllSorted() {
    if (allSortedChecked) {
      setCheckedIds((prev) => { const next = new Set(prev); sorted.forEach((t) => next.delete(t.id)); return next })
    } else {
      setCheckedIds((prev) => { const next = new Set(prev); sorted.forEach((t) => next.add(t.id)); return next })
    }
  }

  function handleAddRow() {
    if (!currentProjectId) return
    const id = addStandaloneTravail()
    setNewRowId(id)
  }

  if (!project) return null

  const TH = ({ children, w }: { children: React.ReactNode; w?: number }) => (
    <th
      className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-r border-gray-200 dark:border-gray-700 px-2 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap sticky top-0 z-10"
      style={w ? { width: w } : undefined}
    >
      {children}
    </th>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">

      {/* En-tête */}
      <div className="flex-none flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Travaux sans plan</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {sorted.length} travail{sorted.length !== 1 ? 'x' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMatching(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <Image className="w-4 h-4" /> Appariement photos
          </button>
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>
        </div>
      </div>

      {showMatching && <SansPlanPhotoMatchingModal onClose={() => setShowMatching(false)} />}

      {/* Barre suppression */}
      {checkedIds.size > 0 && (
        <div className="flex-none flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            {checkedIds.size} sélectionné{checkedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={deleteChecked}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer la sélection
          </button>
          <button
            onClick={() => setCheckedIds(new Set())}
            className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-300"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 32  }} />
            <col style={{ width: 36  }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 155 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 210 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 160 }} />
            <col />
            <col style={{ width: 84  }} />
            <col style={{ width: 36  }} />
          </colgroup>
          <thead>
            <tr>
              <th className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-r border-gray-200 dark:border-gray-700 px-2 py-2 sticky top-0 z-10 w-8">
                <input
                  type="checkbox"
                  checked={allSortedChecked}
                  onChange={toggleAllSorted}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Tout sélectionner"
                />
              </th>
              <TH w={36}>#</TH>
              <TH>Système</TH>
              <TH>Composante</TH>
              <TH>Zone / Secteur</TH>
              <TH>Localisation</TH>
              <TH>Date</TH>
              <TH w={210}>Photos</TH>
              <TH w={170}>Porte d'accès installée</TH>
              <TH w={160}>Anomalies observées</TH>
              <TH>Notes / Particularités</TH>
              <TH w={84}>Fiche PDF</TH>
              <th className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-gray-200 dark:border-gray-700 sticky top-0 z-10 w-9" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <TravailRow
                key={t.id}
                travail={t}
                projectId={currentProjectId!}
                systemes={systemes}
                autoFocus={t.id === newRowId}
                isChecked={checkedIds.has(t.id)}
                onToggleCheck={(e) => toggleCheck(t.id, e)}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="py-16 text-center">
                  <p className="text-sm font-medium text-gray-400 dark:text-gray-600 mb-3">Aucun travail sans plan</p>
                  <button
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Ajouter le premier travail
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

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
