import { useRef, useState } from 'react'
import { X, Trash2, Camera, DoorOpen, Layers } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { STATUT_PORTE, ACCESS_DOOR_TYPE_LABELS } from '@/types'
import type { AccessDoorType, StatutPorte } from '@/types'
import { saveTravailPhoto } from '@/services/travailPhotoStorage'
import { nanoid } from 'nanoid'

const INPUT  = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const SELECT = `${INPUT} cursor-pointer`

const DIM_OPTS: Record<AccessDoorType, string[]> = {
  acces:         ['8" x 5"', '12" x 6"', '12" x 12"', '16" x 16"', '18" x 10"', '18" x 18"', '21" x 14"', '24" x 12"', '25" x 17"'],
  architectural: ['12" x 12"', '16" x 16"', '18" x 18"', '24" x 24"', '30" x 30"'],
  plaque:        ['4" x 4"', '5" x 5"', '6" x 6"', '8" x 8"', '10" x 10"', '12" x 12"', '14" x 14"', '16" x 16"', '18" x 18"', '20" x 20"', '24" x 24"'],
}

export default function DoorPanel({
  doorId,
  planId,
  onClose,
}: {
  doorId: string
  planId: string
  onClose: () => void
}) {
  const plans               = useAppStore((s) => s.plans)
  const updateAccessDoor    = useAppStore((s) => s.updateAccessDoor)
  const removeAccessDoor    = useAppStore((s) => s.removeAccessDoor)
  const addPhotoToDoor      = useAppStore((s) => s.addPhotoToDoor)
  const removePhotoFromDoor = useAppStore((s) => s.removePhotoFromDoor)
  const consumePhotoRef     = useAppStore((s) => s.consumePhotoRef)
  const currentProjectId    = useAppStore((s) => s.currentProjectId)
  const travaux             = useAppStore((s) => s.travaux)
  const project             = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const systemes            = project?.systemes ?? []

  const plan = plans.find((p) => p.id === planId)
  const door = plan?.accessDoors?.find((d) => d.id === doorId)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  if (!door) return null

  const upd = (data: Partial<typeof door>) => updateAccessDoor(planId, doorId, data as any)
  const statut   = door.statut ?? 'existante'
  const statutInfo = STATUT_PORTE[statut]

  const handleDelete = () => {
    if (window.confirm("Supprimer cette porte d'accès ?")) {
      removeAccessDoor(planId, doorId)
      onClose()
    }
  }

  const handlePhotos = async (files: FileList | null) => {
    if (!files || !currentProjectId) return
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      const url: string = await new Promise((res) => {
        reader.onload = (e) => res(e.target?.result as string)
        reader.readAsDataURL(file)
      })
      const ref = consumePhotoRef()
      await saveTravailPhoto(`${currentProjectId}_${ref}`, url)
      addPhotoToDoor(planId, doorId, { id: nanoid(), ref, url, timestamp: new Date().toISOString() })
    }
    setUploading(false)
  }

  // Travaux qui utilisent cette porte
  const linkedTravaux = travaux.filter((t) => (t.portesUtilisees ?? []).includes(doorId))

  // Systèmes liés via les travaux
  const linkedSysIds  = [...new Set(linkedTravaux.map((t) => t.systemeId).filter(Boolean))]
  const linkedSys     = linkedSysIds.map((id) => systemes.find((s) => s.id === id)).filter(Boolean) as typeof systemes
  const isLinked      = linkedTravaux.length > 0

  return (
    <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">

      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: statutInfo.color }}>
              <DoorOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{door.numero}</p>
              <p className="text-xs leading-none" style={{ color: statutInfo.color }}>{statutInfo.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleDelete}
              className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 px-4 py-4 space-y-4">

        {/* Numéro */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">N° de porte</label>
          <input className={INPUT} value={door.numero}
            onChange={(e) => upd({ numero: e.target.value })} />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select className={SELECT} value={door.type}
            onChange={(e) => upd({ type: e.target.value as AccessDoorType })}>
            {(Object.entries(ACCESS_DOOR_TYPE_LABELS) as [AccessDoorType, string][]).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>

        {/* Statut */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Statut</label>
          <div className="flex gap-1.5">
            {(Object.entries(STATUT_PORTE) as [StatutPorte, typeof STATUT_PORTE[StatutPorte]][]).map(([key, info]) => (
              <button key={key}
                onClick={() => upd({ statut: key })}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  statut === key
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`}
                style={statut === key ? { background: info.color } : {}}>
                {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dimensions</label>
          <select className={SELECT}
            value={DIM_OPTS[door.type]?.includes(door.dimensions) ? door.dimensions : '__custom__'}
            onChange={(e) => { if (e.target.value !== '__custom__') upd({ dimensions: e.target.value }) }}>
            <option value="">— Choisir —</option>
            {(DIM_OPTS[door.type] ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="__custom__">Autre (saisie libre)</option>
          </select>
          {(!DIM_OPTS[door.type]?.includes(door.dimensions) || door.dimensions === '') && (
            <input className={`${INPUT} mt-1.5`}
              placeholder='ex. 20" x 14"'
              value={door.dimensions}
              onChange={(e) => upd({ dimensions: e.target.value })} />
          )}
        </div>

        {/* Remarques */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Remarques</label>
          <textarea className={`${INPUT} resize-none`} rows={3}
            value={door.remarques ?? ''}
            onChange={(e) => upd({ remarques: e.target.value })}
            placeholder="Notes sur la porte, conditions d'accès…" />
        </div>

        {/* Système */}
        {isLinked ? (
          /* Porte liée à des épingles → afficher le(s) système(s) en lecture seule */
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Système
            </label>
            {linkedSys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {linkedSys.map((sys) => (
                  <span key={sys.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <Layers className="w-3 h-3" />
                    {sys.nom}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Système non assigné</span>
            )}
          </div>
        ) : systemes.length > 0 ? (
          /* Porte ajoutée directement → sélecteur de système */
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Système
            </label>
            <select className={SELECT} value={door.systemeId ?? ''}
              onChange={(e) => upd({ systemeId: e.target.value || undefined })}>
              <option value="">— Non assigné —</option>
              {systemes.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Travaux liés */}
        {linkedTravaux.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Utilisée par</label>
            <div className="space-y-1">
              {linkedTravaux.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2 py-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ background: '#3B82F6' }}>
                    {t.numero}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 truncate">
                    {t.typeComposante ? t.typeComposante.replace(/_/g, ' ') : `Travail #${t.numero}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Photos de la porte</label>
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { handlePhotos(e.target.files); e.target.value = '' }} />
          <div className="flex flex-wrap gap-1.5">
            {(door.photosPorte ?? []).map((ph) => (
              <div key={ph.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                <img src={ph.url} alt={ph.ref} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhotoFromDoor(planId, doorId, ph.id)}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-2.5 h-2.5" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[8px] bg-black/50 leading-none py-0.5">{ph.ref}</span>
              </div>
            ))}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-300 flex items-center justify-center text-gray-300 hover:text-blue-400 transition-colors disabled:opacity-50">
              <Camera className="w-5 h-5" />
            </button>
          </div>
          {uploading && <p className="text-xs text-gray-400 mt-1">Enregistrement…</p>}
        </div>

      </div>
    </div>
  )
}
