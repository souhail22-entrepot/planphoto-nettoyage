import {
  Camera, Image, AlertTriangle, DoorOpen, Download,
  ChevronDown, ChevronRight, X, ClipboardList, FolderOpen, Layers,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { NiveauSalubrite } from '@/types'
import { NIVEAU_SALUBRITE_INFO } from '@/types'

// ── Téléchargements ──────────────────────────────────────────────────────────
function downloadPhoto(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/[/\\:*?"<>|]/g, '_')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadAll(photos: { url: string; ref: string }[], prefix: string) {
  photos.forEach((ph, i) => {
    setTimeout(() => downloadPhoto(ph.url, `${prefix}-${ph.ref}.jpg`), i * 120)
  })
}

// ── Grille de photos ─────────────────────────────────────────────────────────
function PhotoGrid({ photos, badge, onOpen }: {
  photos: any[]
  badge?: (ph: any) => React.ReactNode
  onOpen: (ph: any) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 p-3">
      {photos.map((ph) => (
        <div key={ph.id} className="group relative cursor-pointer rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
          onClick={() => onOpen(ph)}>
          <img src={ph.url} alt={ph.ref}
            className="w-full aspect-square object-cover transition-transform group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg" />
          <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent
            translate-y-full group-hover:translate-y-0 transition-transform rounded-b-lg">
            <p className="text-white text-[10px] font-bold truncate">{ph.ref}</p>
            {ph.travailNum !== undefined && <p className="text-white/70 text-[9px]">Travail #{ph.travailNum}</p>}
            {ph.doorNumero && <p className="text-white/70 text-[9px]">{ph.doorNumero}</p>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); downloadPhoto(ph.url, `${ph.ref}.jpg`) }}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-blue-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="Télécharger cette photo"
          >
            <Download className="w-3 h-3" />
          </button>
          {badge?.(ph)}
        </div>
      ))}
    </div>
  )
}

// ── Dossier accordéon ────────────────────────────────────────────────────────
function Folder({ label, photos, badge, onOpen, accent = 'gray' }: {
  label: string
  photos: any[]
  badge?: (ph: any) => React.ReactNode
  onOpen: (ph: any) => void
  accent?: 'gray' | 'orange' | 'green' | 'yellow' | 'blue' | 'purple'
}) {
  const [open, setOpen] = useState(true)
  if (photos.length === 0) return null

  const ACCENT = {
    gray:   'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    green:  'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    blue:   'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors sticky top-0 z-10 ${ACCENT[accent]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <FolderOpen className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold text-sm flex-1 text-gray-800 dark:text-gray-200">{label}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); downloadAll(photos, label) }}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-1 rounded transition-colors ml-2"
          title="Télécharger toutes"
        >
          <Download className="w-3 h-3" /> Télécharger tout
        </button>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </div>
      {open && <PhotoGrid photos={photos} badge={badge} onOpen={onOpen} />}
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────────
type SpecialTab = 'portes' | 'intervention'

export default function PhotosView() {
  const [activeSysId, setActiveSysId] = useState<string>('__tous__')
  const [lightbox, setLightbox]       = useState<{ url: string; ref: string } | null>(null)

  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project          = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const plans            = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const planIds          = plans.map((p) => p.id)
  const travaux          = useAppStore((s) => s.travaux.filter((t) => !t.planId || planIds.includes(t.planId)))
  const interventions    = useAppStore((s) => s.interventions.filter((i) => i.projectId === currentProjectId))

  if (!project) return null

  const systemes = project.systemes ?? []

  // Regroupement des travaux par système
  const sysMap = new Map<string, typeof travaux>()
  for (const t of travaux) {
    const key = systemes.find((s) => s.id === t.systemeId) ? t.systemeId : '__autre__'
    if (!sysMap.has(key)) sysMap.set(key, [])
    sysMap.get(key)!.push(t)
  }

  // Système courant (travaux filtrés)
  function travauxForSys(sysId: string): typeof travaux {
    if (sysId === '__tous__') return travaux
    return sysMap.get(sysId) ?? []
  }

  function photosAvant(ts: typeof travaux) {
    return ts.flatMap((t) => t.photosAvant.map((ph) => ({ ...ph, travailNum: t.numero, niveauSalubrite: t.niveauSalubriteInitial })))
  }
  function photosApres(ts: typeof travaux) {
    return ts.flatMap((t) => t.photosApres.map((ph) => ({ ...ph, travailNum: t.numero, niveauSalubrite: t.niveauSalubriteFinal })))
  }
  function photosPendant(ts: typeof travaux) {
    return ts.flatMap((t) => t.photosPendant.map((ph) => ({ ...ph, travailNum: t.numero })))
  }
  function photosAnomalies(ts: typeof travaux) {
    return ts.flatMap((t) => t.anomalies.flatMap((a) => a.photos.map((ph) => ({ ...ph, travailNum: t.numero, anomalieType: a.type }))))
  }

  // Photos de portes (par plan)
  const portesGroups = plans
    .map((plan) => ({
      id:     plan.id,
      label:  plan.name,
      photos: (plan.accessDoors ?? []).flatMap((door) =>
        (door.photosPorte ?? []).map((ph) => ({ ...ph, doorNumero: door.numero }))
      ),
    }))
    .filter((g) => g.photos.length > 0)

  // Photos d'interventions (par appartement)
  const interventionGroups = (() => {
    const map = new Map<string, { url: string; ref: string; id: string; phase: 'AV' | 'AP'; composante: string; date: string }[]>()
    for (const intv of interventions) {
      const key = intv.appartement || '(sans nom)'
      if (!map.has(key)) map.set(key, [])
      const arr = map.get(key)!
      const compPhotos = [
        { composante: 'Hotte',      av: intv.photosHotteAvant    ?? [], ap: intv.photosHotteApres    ?? [] },
        { composante: 'SDB',        av: intv.photosSdbAvant      ?? [], ap: intv.photosSdbApres      ?? [] },
        { composante: 'Chgt hotte', av: intv.photosChgtHotteAvant ?? [], ap: intv.photosChgtHotteApres ?? [] },
      ]
      for (const { composante, av, ap } of compPhotos) {
        for (const ph of av) if (ph.url) arr.push({ ...ph, phase: 'AV', composante, date: intv.date })
        for (const ph of ap) if (ph.url) arr.push({ ...ph, phase: 'AP', composante, date: intv.date })
      }
    }
    return [...map.entries()]
      .map(([label, photos]) => ({ label, photos }))
      .filter((g) => g.photos.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
  })()

  // Comptages pour les badges des onglets système
  function countForSys(sysId: string) {
    const ts = travauxForSys(sysId)
    return ts.reduce((s, t) =>
      s + t.photosAvant.length + t.photosPendant.length + t.photosApres.length
        + t.anomalies.reduce((a, an) => a + an.photos.length, 0), 0
    )
  }

  const totalPortes       = portesGroups.reduce((s, g) => s + g.photos.length, 0)
  const totalIntervention = interventionGroups.reduce((s, g) => s + g.photos.length, 0)
  const grandTotal        = travaux.reduce((s, t) =>
    s + t.photosAvant.length + t.photosPendant.length + t.photosApres.length
      + t.anomalies.reduce((a, an) => a + an.photos.length, 0), 0
  ) + totalPortes + totalIntervention

  // Badges badges
  const badgeNiveau = (ph: any) => {
    const niv = ph.niveauSalubrite as NiveauSalubrite | undefined
    return niv ? (
      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded text-[9px] font-bold text-white flex items-center justify-center shadow"
        style={{ background: NIVEAU_SALUBRITE_INFO[niv].color }}>N{niv}</div>
    ) : null
  }
  const badgeAnomalie = (ph: any) => (
    <div className="absolute top-1.5 left-1.5 bg-orange-500/90 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow truncate max-w-[70%]">
      {ph.anomalieType}
    </div>
  )
  const badgePorte = (ph: any) => (
    <div className="absolute top-1.5 left-1.5 bg-blue-600/90 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow">
      {ph.doorNumero}
    </div>
  )
  const badgeIntervention = (ph: any) => (
    <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
      <div className="text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow bg-gray-800/80">{ph.composante}</div>
      <div className={`text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow ${ph.phase === 'AV' ? 'bg-orange-500/90' : 'bg-green-600/90'}`}>
        {ph.phase}
      </div>
    </div>
  )

  // Onglets de systèmes : Tous + chaque système + Portes + Intervention
  const sysTabs = [
    { id: '__tous__', label: 'Tous', count: countForSys('__tous__') },
    ...systemes.map((s) => ({ id: s.id, label: s.nom, count: countForSys(s.id) })),
    ...(sysMap.has('__autre__') ? [{ id: '__autre__', label: 'Sans système', count: countForSys('__autre__') }] : []),
  ]

  const TAB_BASE = 'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0'
  const TAB_ACTIVE = 'border-blue-600 text-blue-600 dark:text-blue-400'
  const TAB_IDLE   = 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

  // Contenu selon onglet sélectionné
  function renderContent() {
    if (activeSysId === 'portes') {
      if (totalPortes === 0) return <Empty />
      return portesGroups.map((g) => (
        <Folder key={g.id} label={g.label} photos={g.photos} badge={badgePorte} onOpen={setLightbox} accent="blue" />
      ))
    }

    if (activeSysId === 'intervention') {
      if (totalIntervention === 0) return <Empty />
      return interventionGroups.map((g) => (
        <Folder key={g.label} label={g.label} photos={g.photos} badge={badgeIntervention} onOpen={setLightbox} />
      ))
    }

    if (activeSysId === '__tous__') {
      // Affiche chaque système avec ses dossiers Avant/Après à l'intérieur
      const groups = [
        ...systemes.filter((s) => sysMap.has(s.id)).map((s) => ({ id: s.id, label: s.nom })),
        ...(sysMap.has('__autre__') ? [{ id: '__autre__', label: 'Sans système' }] : []),
      ]
      if (groups.length === 0) return <Empty />
      return groups.map((g) => <SysGroup key={g.id} sysId={g.id} label={g.label} />)
    }

    // Un système spécifique
    return <SysGroup sysId={activeSysId} label={systemes.find((s) => s.id === activeSysId)?.nom ?? 'Sans système'} showTitle={false} />
  }

  function SysGroup({ sysId, label, showTitle = true }: { sysId: string; label: string; showTitle?: boolean }) {
    const ts    = travauxForSys(sysId)
    const avant = photosAvant(ts)
    const apres = photosApres(ts)
    const pend  = photosPendant(ts)
    const anom  = photosAnomalies(ts)

    if (avant.length + apres.length + pend.length + anom.length === 0) return null

    return (
      <div className={showTitle ? 'border-b border-gray-200 dark:border-gray-700 last:border-0' : ''}>
        {showTitle && (
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800/60 border-b border-gray-100 dark:border-gray-700">
            <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{label}</span>
            <span className="text-xs text-slate-400 ml-auto">{avant.length + apres.length + pend.length + anom.length} photos</span>
          </div>
        )}
        <Folder label="Avant" photos={avant} badge={badgeNiveau} onOpen={setLightbox} accent="orange" />
        <Folder label="Après" photos={apres} badge={badgeNiveau} onOpen={setLightbox} accent="green" />
        {pend.length > 0  && <Folder label="Pendant" photos={pend} onOpen={setLightbox} accent="yellow" />}
        {anom.length > 0  && <Folder label="Anomalies" photos={anom} badge={badgeAnomalie} onOpen={setLightbox} accent="purple" />}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── En-tête ── */}
      <div className="flex-none px-6 pt-5 pb-0 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Galerie photos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {grandTotal} photo{grandTotal !== 1 ? 's' : ''} · {systemes.length} système{systemes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Onglets Système ── */}
        <div className="flex overflow-x-auto gap-0 scrollbar-none">
          {sysTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveSysId(tab.id)}
              className={`${TAB_BASE} ${activeSysId === tab.id ? TAB_ACTIVE : TAB_IDLE}`}>
              <Camera className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${activeSysId === tab.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          {/* Séparateur */}
          <div className="w-px bg-gray-200 dark:bg-gray-700 mx-2 my-1.5 self-stretch" />

          {/* Onglet Portes */}
          <button onClick={() => setActiveSysId('portes')}
            className={`${TAB_BASE} ${activeSysId === 'portes' ? TAB_ACTIVE : TAB_IDLE}`}>
            <DoorOpen className="w-3.5 h-3.5" />
            Portes
            {totalPortes > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${activeSysId === 'portes' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {totalPortes}
              </span>
            )}
          </button>

          {/* Onglet Intervention */}
          <button onClick={() => setActiveSysId('intervention')}
            className={`${TAB_BASE} ${activeSysId === 'intervention' ? TAB_ACTIVE : TAB_IDLE}`}>
            <ClipboardList className="w-3.5 h-3.5" />
            Intervention
            {totalIntervention > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${activeSysId === 'intervention' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {totalIntervention}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-5xl max-h-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.ref}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl" />
            <div className="flex items-center gap-3">
              <span className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-full font-medium">
                {lightbox.ref}
              </span>
              <button
                onClick={() => downloadPhoto(lightbox.url, `${lightbox.ref}.jpg`)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition-colors shadow">
                <Download className="w-4 h-4" /> Télécharger
              </button>
            </div>
            <button onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Empty() {
  return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-600">
      <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Aucune photo</p>
      <p className="text-sm mt-1">Ajoutez des photos depuis le panneau des travaux</p>
    </div>
  )
}
