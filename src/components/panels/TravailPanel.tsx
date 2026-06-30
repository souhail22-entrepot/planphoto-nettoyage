import { useRef, useState } from 'react'
import { X, ChevronDown, ChevronUp, Camera, Trash2, AlertTriangle, Plus, Star, FileText, Layers, ZoomIn } from 'lucide-react'
import TravailMatchingModal from './TravailMatchingModal'
import { useAppStore } from '@/store/useAppStore'
import {
  COMPOSANTES_CVAC, ANOMALIE_LABELS,
  STATUT_PORTE, composanteColor,
} from '@/types'
import type { TypeAnomalie, AccessDoorType, Photo } from '@/types'
import { saveTravailPhoto } from '@/services/travailPhotoStorage'
import { nanoid } from 'nanoid'

function Section({ title, children, defaultOpen = true, action }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-100 dark:border-gray-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2.5">{children}</div>}
    </div>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-gray-300'
const SELECT = `${INPUT} cursor-pointer`
const TEXTAREA = `${INPUT} resize-none`

// ── Photos ────────────────────────────────────────────────────────────────────

function PhotoStrip({ photos, onAdd, onRemove, onStar, systemeSlug }: {
  photos: { id: string; ref: string; url: string; note?: string; starred?: boolean }[]
  onAdd:    (photo: { id: string; ref: string; url: string; timestamp: string }) => void
  onRemove: (id: string) => void
  onStar:   (id: string, starred: boolean) => void
  systemeSlug?: string
}) {
  const consumePhotoRef  = useAppStore((s) => s.consumePhotoRef)
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [zoomed, setZoomed] = useState<{ url: string; ref: string } | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || !currentProjectId) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      const url: string = await new Promise((res) => {
        reader.onload = (e) => res(e.target?.result as string)
        reader.readAsDataURL(file)
      })
      const ref = consumePhotoRef()
      const key = `${currentProjectId}_${ref}`
      await saveTravailPhoto(key, url, systemeSlug)
      onAdd({ id: nanoid(), ref, url, timestamp: new Date().toISOString() })
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
      <div className="flex flex-wrap gap-1.5">
        {photos.map((ph) => (
          <div key={ph.id}
            className={`relative group w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
              ph.starred
                ? 'border-yellow-400 shadow-sm shadow-yellow-200 dark:shadow-yellow-900'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <img src={ph.url} alt={ph.ref} className="w-full h-full object-cover" />

            {/* Étoile — toujours visible si starred, sinon au survol */}
            <button
              onClick={() => onStar(ph.id, !ph.starred)}
              title={ph.starred ? 'Retirer du rapport PDF' : 'Inclure dans le rapport PDF'}
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                ph.starred
                  ? 'bg-yellow-400 opacity-100'
                  : 'bg-black/50 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star className={`w-2.5 h-2.5 ${ph.starred ? 'text-white fill-white' : 'text-yellow-300'}`} />
            </button>

            {/* Loupe zoom */}
            <button
              onClick={() => setZoomed({ url: ph.url, ref: ph.ref })}
              title="Agrandir"
              className="absolute bottom-0.5 left-0.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ZoomIn className="w-2.5 h-2.5" />
            </button>

            {/* Croix de suppression */}
            <button
              onClick={() => onRemove(ph.id)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-2.5 h-2.5" />
            </button>

            <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[8px] bg-black/50 leading-none py-0.5">
              {ph.ref}
            </span>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 flex items-center justify-center text-gray-300 hover:text-blue-400 transition-colors"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>
      {photos.some((ph) => ph.starred) && (
        <p className="mt-1.5 text-[10px] text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <Star className="w-2.5 h-2.5 fill-current" />
          {photos.filter((ph) => ph.starred).length} photo{photos.filter((ph) => ph.starred).length > 1 ? 's' : ''} sélectionnée{photos.filter((ph) => ph.starred).length > 1 ? 's' : ''} pour le rapport
        </p>
      )}

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
          onClick={() => setZoomed(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={zoomed.url} alt={zoomed.ref}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
              {zoomed.ref}
            </span>
            <button
              onClick={() => setZoomed(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Panneau principal ─────────────────────────────────────────────────────────

export default function TravailPanel() {
  const selectedTravailId  = useAppStore((s) => s.selectedTravailId)
  const travail            = useAppStore((s) => s.travaux.find((t) => t.id === selectedTravailId))
  const setSelectedTravail = useAppStore((s) => s.setSelectedTravail)
  const updateTravail      = useAppStore((s) => s.updateTravail)
  const deleteTravail      = useAppStore((s) => s.deleteTravail)
  const addAnomalie        = useAppStore((s) => s.addAnomalie)
  const updateAnomalie     = useAppStore((s) => s.updateAnomalie)
  const deleteAnomalie     = useAppStore((s) => s.deleteAnomalie)
  const addPhotoToTravail      = useAppStore((s) => s.addPhotoToTravail)
  const removePhotoFromTravail = useAppStore((s) => s.removePhotoFromTravail)
  const starPhoto              = useAppStore((s) => s.starPhoto)
  const addAccessDoor    = useAppStore((s) => s.addAccessDoor)
  const updateAccessDoor = useAppStore((s) => s.updateAccessDoor)
  const removeAccessDoor = useAppStore((s) => s.removeAccessDoor)

  const currentProject = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  // Utilise planId du travail (plus fiable que currentPlanId qui peut changer lors de la navigation)
  const currentPlan    = useAppStore((s) => {
    const t = s.travaux.find((t) => t.id === s.selectedTravailId)
    return s.plans.find((p) => p.id === (t?.planId ?? s.currentPlanId))
  })

  const [showMatching, setShowMatching] = useState(false)

  if (!travail) return null

  const systeme   = currentProject?.systemes.find((s) => s.id === travail.systemeId)
  const mainColor = composanteColor(travail.typeComposante)

  const upd = (data: any) => updateTravail(travail.id, data)

  const tid = travail.id
  const handleMatchingSave = (avantPhotos: Photo[], apresPhotos: Photo[]) => {
    for (const ph of avantPhotos) addPhotoToTravail(tid, ph, 'avant')
    for (const ph of apresPhotos) addPhotoToTravail(tid, ph, 'apres')
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">

      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: mainColor }}>
              {travail.numero}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {systeme?.nom ?? 'Sans système'}
              </p>
              {travail.typeComposante && (
                <p className="text-xs text-gray-400 leading-none">
                  {COMPOSANTES_CVAC[travail.typeComposante]?.label}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (window.confirm('Supprimer ce travail ?')) { deleteTravail(travail.id); setSelectedTravail(null) } }}
              className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setSelectedTravail(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inclusion dans le rapport PDF */}
        <div className="px-4 pb-2.5">
          <button
            onClick={() => upd({ includeInReport: !(travail.includeInReport ?? true) })}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              (travail.includeInReport ?? true)
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                : 'bg-gray-50 dark:bg-gray-700/30 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Fiche dans le rapport PDF
            </span>
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              (travail.includeInReport ?? true) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {(travail.includeInReport ?? true) && (
                <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white"><path d="M1 4l3 3 5-6"/></svg>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Taille du marqueur — tout en haut */}
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Taille du marqueur</p>
        <div className="flex gap-1.5">
          {(['xsmall', 'small', 'medium', 'large'] as const).map((sz) => (
            <button key={sz}
              onClick={() => upd({ pinSize: sz })}
              className={`flex-1 text-[10px] py-1.5 rounded-lg border font-semibold transition-all ${
                (travail.pinSize ?? 'medium') === sz
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {sz === 'xsmall' ? 'T.Petit' : sz === 'small' ? 'Petit' : sz === 'medium' ? 'Moyen' : 'Grand'}
            </button>
          ))}
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1">

        {/* Identification */}
        <Section title="Identification">
          <LabeledField label="Système">
            <select className={SELECT} value={travail.systemeId}
              onChange={(e) => upd({ systemeId: e.target.value })}>
              <option value="">— Aucun système —</option>
              {currentProject?.systemes.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </LabeledField>

          <LabeledField label="Type de composante">
            <select className={SELECT} value={travail.typeComposante ?? ''}
              onChange={(e) => upd({ typeComposante: e.target.value || undefined })}>
              <option value="">— Choisir —</option>
              {(Object.entries(COMPOSANTES_CVAC) as any[]).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </LabeledField>

          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="Zone / Secteur">
              <input className={INPUT} placeholder="Zone A"
                value={travail.location ?? ''}
                onChange={(e) => upd({ location: e.target.value })} />
            </LabeledField>
            <LabeledField label="Localisation">
              <input className={INPUT} placeholder="Salle mécanique"
                value={travail.zoneDesservie ?? ''}
                onChange={(e) => upd({ zoneDesservie: e.target.value })} />
            </LabeledField>
          </div>
        </Section>

        {/* Portes d'accès — champs par type, auto-création sur le plan */}
        {(() => {
          const DOOR_ROWS: { type: AccessDoorType; label: string; color: string; dims: string[] }[] = [
            { type: 'acces',         label: "Accès conduit",  color: '#1d4ed8',
              dims: ['8" x 5"','12" x 6"','12" x 12"','16" x 16"','18" x 10"','18" x 18"','21" x 14"','24" x 12"','25" x 17"',
                     '4" x 4"','5" x 5"','6" x 6"','8" x 8"','10" x 10"','14" x 14"','20" x 20"','24" x 24"'] },
            { type: 'architectural', label: 'Architecturale', color: '#0f766e',
              dims: ['12" x 12"','16" x 16"','18" x 18"','24" x 24"','30" x 30"'] },
            { type: 'plaque',        label: 'Plaque',         color: '#b45309',
              dims: ['4" x 4"','5" x 5"','6" x 6"','8" x 8"','10" x 10"','12" x 12"','14" x 14"','16" x 16"','18" x 18"','20" x 20"','24" x 24"'] },
          ]

          const linked = (pId: string, type: AccessDoorType) =>
            (currentPlan?.accessDoors ?? []).find(
              (d) => (travail.portesUtilisees ?? []).includes(d.id) && d.type === type
            )

          const handleChange = (type: AccessDoorType, dimensions: string, existing: ReturnType<typeof linked>) => {
            if (!currentPlan) return
            if (dimensions === '' && existing) {
              removeAccessDoor(currentPlan.id, existing.id)
              upd({ portesUtilisees: (travail.portesUtilisees ?? []).filter((id) => id !== existing.id) })
            } else if (dimensions !== '' && !existing) {
              const ax = travail.arrowEndX ?? (travail.x + 40)
              const ay = travail.arrowEndY ?? (travail.y + 40)
              const newId = addAccessDoor(currentPlan.id, ax, ay)
              if (newId) {
                updateAccessDoor(currentPlan.id, newId, { type, dimensions })
                upd({ portesUtilisees: [...(travail.portesUtilisees ?? []), newId] })
              }
            } else if (dimensions !== '' && existing) {
              updateAccessDoor(currentPlan.id, existing.id, { dimensions })
            }
          }

          const count = DOOR_ROWS.filter((r) => linked(currentPlan?.id ?? '', r.type)).length

          return (
            <Section title={`Portes d'accès (${count})`} defaultOpen={true}>
              <div className="space-y-2">
                {DOOR_ROWS.map(({ type, label, color, dims }) => {
                  const door = linked(currentPlan?.id ?? '', type)
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2">
                        {/* Indicateur couleur type */}
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        {/* Label type */}
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0 truncate">
                          {label}
                        </span>
                        {/* Dropdown dimensions */}
                        <select
                          className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={door?.dimensions ?? ''}
                          onChange={(e) => handleChange(type, e.target.value, door)}
                          disabled={!currentPlan}
                        >
                          <option value="">—</option>
                          {dims.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        {/* Toggle existante */}
                        {door && (
                          <button
                            onClick={() => updateAccessDoor(currentPlan!.id, door.id, {
                              statut: door.statut === 'existante' ? 'ajoutee' : 'existante'
                            })}
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 border transition-all ${
                              door.statut === 'existante'
                                ? 'text-white border-transparent'
                                : 'text-gray-400 border-gray-200 dark:border-gray-600 bg-transparent'
                            }`}
                            style={door.statut === 'existante' ? { background: STATUT_PORTE.existante.color } : {}}
                            title={door.statut === 'existante' ? 'Existante' : 'Ajoutée'}
                          >
                            {door.statut === 'existante' ? 'Exist.' : 'Ajout.'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {!currentPlan && (
                  <p className="text-xs text-gray-400 italic text-center pt-1">Aucun plan sélectionné</p>
                )}
              </div>
            </Section>
          )
        })()}

        {/* Photos avant + après */}
        <Section
          title={`Photos avant (${travail.photosAvant.length})`}
          defaultOpen={true}
          action={
            <button
              onClick={() => setShowMatching(true)}
              title="Ouvrir le mode Appariement Avant/Après"
              className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded transition-colors normal-case tracking-normal"
            >
              <Layers className="w-2.5 h-2.5" /> Apparier
            </button>
          }
        >
          <PhotoStrip
            photos={travail.photosAvant}
            onAdd={(ph) => addPhotoToTravail(travail.id, ph, 'avant')}
            onRemove={(id) => removePhotoFromTravail(travail.id, id, 'avant')}
            onStar={(id, starred) => starPhoto(travail.id, id, 'avant', starred)}
            systemeSlug={systeme?.nom}
          />
        </Section>

        <Section title={`Photos après (${travail.photosApres.length})`} defaultOpen={true}>
          <PhotoStrip
            photos={travail.photosApres}
            onAdd={(ph) => addPhotoToTravail(travail.id, ph, 'apres')}
            onRemove={(id) => removePhotoFromTravail(travail.id, id, 'apres')}
            onStar={(id, starred) => starPhoto(travail.id, id, 'apres', starred)}
            systemeSlug={systeme?.nom}
          />
        </Section>

        {/* Travail de nettoyage */}
        <Section title="Nettoyage">
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="Date début">
              <input type="date" className={INPUT} value={travail.dateDebut ?? ''}
                onChange={(e) => upd({ dateDebut: e.target.value })} />
            </LabeledField>
            <LabeledField label="Date fin">
              <input type="date" className={INPUT} value={travail.dateFin ?? ''}
                onChange={(e) => upd({ dateFin: e.target.value })} />
            </LabeledField>
          </div>

          <LabeledField label="Durée (heures)">
            <input type="number" min="0" step="0.5" className={INPUT} placeholder="0"
              value={travail.dureeHeures ?? ''}
              onChange={(e) => upd({ dureeHeures: parseFloat(e.target.value) || undefined })} />
          </LabeledField>
        </Section>

        {/* Observations */}
        <Section title="Observations" defaultOpen={false}>
          <textarea rows={4} className={TEXTAREA} placeholder="Observations…"
            value={travail.observationsAvant ?? ''}
            onChange={(e) => upd({ observationsAvant: e.target.value })} />
        </Section>

        {/* Anomalies */}
        <Section title={`Anomalies (${travail.anomalies.length})`} defaultOpen={travail.anomalies.length > 0}>
          {travail.anomalies.map((an) => (
            <div key={an.id} className="border border-orange-200 dark:border-orange-800 rounded-lg p-2.5 bg-orange-50/40 dark:bg-orange-900/10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  <select className="text-xs font-semibold text-orange-700 dark:text-orange-400 bg-transparent border-none focus:outline-none"
                    value={an.type}
                    onChange={(e) => updateAnomalie(travail.id, an.id, { type: e.target.value as TypeAnomalie })}>
                    {(Object.entries(ANOMALIE_LABELS) as [TypeAnomalie, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => deleteAnomalie(travail.id, an.id)}
                  className="text-red-400 hover:text-red-500 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea rows={2} className={`${TEXTAREA} text-xs`}
                placeholder="Description…"
                value={an.description}
                onChange={(e) => updateAnomalie(travail.id, an.id, { description: e.target.value })} />
            </div>
          ))}
          <button
            onClick={() => addAnomalie(travail.id, { type: 'autre', description: '' })}
            className="w-full text-xs text-orange-600 dark:text-orange-400 border border-dashed border-orange-300 dark:border-orange-700 rounded-lg py-1.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Ajouter une anomalie
          </button>
        </Section>

        {/* Méta */}
        <div className="px-4 py-3 text-[10px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-700 space-y-0.5">
          <p>Créé le {new Date(travail.createdAt).toLocaleDateString('fr-CA')}</p>
          <p>Modifié le {new Date(travail.updatedAt).toLocaleDateString('fr-CA')}</p>
          {travail.inspectionPinId && <p className="text-blue-400">Lié à l'inspection #{travail.inspectionPinId.slice(0, 8)}</p>}
        </div>
      </div>

      {/* Modal Appariement */}
      {showMatching && (
        <TravailMatchingModal
          travailId={travail.id}
          systemeSlug={systeme?.nom}
          onSave={handleMatchingSave}
          onClose={() => setShowMatching(false)}
        />
      )}
    </div>
  )
}
