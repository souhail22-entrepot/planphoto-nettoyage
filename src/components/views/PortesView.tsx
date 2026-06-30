import { DoorOpen, MapPin, Trash2, Camera, Filter, ChevronDown, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { STATUT_PORTE, ACCESS_DOOR_TYPE_LABELS } from '@/types'
import type { AccessDoorType, StatutPorte } from '@/types'

// ── Récapitulatif des portes par système ──────────────────────────────────────
function PortesSummary() {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const plans   = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const travaux = useAppStore((s) => {
    const pIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) => t.planId ? pIds.has(t.planId) : t.projectId === s.currentProjectId)
  })
  const project = useAppStore((s) => s.projects.find((p) => p.id === currentProjectId))
  const systemes = project?.systemes ?? []

  const allDoors = plans.flatMap((plan) => (plan.accessDoors ?? []).map((d) => ({ ...d, planId: plan.id })))
  const planIds = new Set(plans.map((p) => p.id))
  const sansPlanLibres = travaux
    .filter((t) => !t.planId && t.projectId === currentProjectId)
    .flatMap((t) => {
      const sys = systemes.find((s) => s.id === t.systemeId)
      return (t.portesInstalleesLibres ?? []).map((p) => ({ ...p, systemeId: t.systemeId, sysNom: sys?.nom ?? 'Non assigné' }))
    })

  if (allDoors.length === 0 && sansPlanLibres.length === 0) return null

  // Comptages par type
  const typeCount: Record<AccessDoorType, number> = { acces: 0, architectural: 0, plaque: 0 }
  for (const d of allDoors)         typeCount[d.type] = (typeCount[d.type] ?? 0) + 1
  for (const p of sansPlanLibres)   typeCount[p.type as AccessDoorType] = (typeCount[p.type as AccessDoorType] ?? 0) + 1

  // Regrouper par système via les travaux ou door.systemeId
  const sysMap = new Map<string, { label: string; counts: Record<AccessDoorType, number> }>()
  for (const door of allDoors) {
    const linked = travaux.filter((t) => (t.portesUtilisees ?? []).includes(door.id))
    const sysIds = linked.length > 0
      ? [...new Set(linked.map((t) => t.systemeId))]
      : door.systemeId ? [door.systemeId] : ['__aucun__']

    for (const sysId of sysIds) {
      const sys   = systemes.find((s) => s.id === sysId)
      const label = sys?.nom ?? (sysId === '__aucun__' ? 'Non assigné' : sysId)
      if (!sysMap.has(sysId)) {
        sysMap.set(sysId, { label, counts: { acces: 0, architectural: 0, plaque: 0 } })
      }
      sysMap.get(sysId)!.counts[door.type] = (sysMap.get(sysId)!.counts[door.type] ?? 0) + 1
    }
  }
  // Ajouter les portes libres sans plan dans le récapitulatif système
  for (const p of sansPlanLibres) {
    const sysId = p.systemeId || '__aucun__'
    const label = p.sysNom
    if (!sysMap.has(sysId)) sysMap.set(sysId, { label, counts: { acces: 0, architectural: 0, plaque: 0 } })
    sysMap.get(sysId)!.counts[p.type as AccessDoorType] = (sysMap.get(sysId)!.counts[p.type as AccessDoorType] ?? 0) + 1
  }

  const rows = Array.from(sysMap.entries()).sort(([, a], [, b]) =>
    a.label.localeCompare(b.label, 'fr', { numeric: true })
  )

  const totals: Record<AccessDoorType, number> = { acces: 0, architectural: 0, plaque: 0 }
  for (const [, { counts }] of rows) {
    for (const k of Object.keys(counts) as AccessDoorType[]) totals[k] += counts[k]
  }
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)

  const colStyle: Record<AccessDoorType, string> = {
    acces:         'text-blue-700 dark:text-blue-300',
    architectural: 'text-teal-700 dark:text-teal-300',
    plaque:        'text-amber-700 dark:text-amber-300',
  }
  const badgeStyle: Record<AccessDoorType, string> = {
    acces:         'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    architectural: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    plaque:        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center gap-3">
        <DoorOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div>
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-200">Récapitulatif par système</h2>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {totals.acces} P.A. · {totals.architectural} P.Ar. · {totals.plaque} Pl. · Total : {grandTotal}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 text-left">
              <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-300">Système</th>
              {(['acces', 'architectural', 'plaque'] as AccessDoorType[]).map((type) => (
                <th key={type} className={`px-3 py-2 font-semibold ${colStyle[type]}`}>
                  {ACCESS_DOOR_TYPE_LABELS[type]}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map(([sysId, { label, counts }]) => {
              const tot = Object.values(counts).reduce((s, v) => s + v, 0)
              return (
                <tr key={sysId} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-3 py-2">
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {label}
                    </span>
                  </td>
                  {(['acces', 'architectural', 'plaque'] as AccessDoorType[]).map((type) => (
                    <td key={type} className="px-3 py-2">
                      {counts[type] > 0
                        ? <span className={`px-2 py-0.5 rounded-full font-bold ${badgeStyle[type]}`}>{counts[type]}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold text-gray-900 dark:text-white">{tot}</td>
                </tr>
              )
            })}
            {rows.length > 1 && (
              <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t-2 border-blue-200 dark:border-blue-700">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-200 uppercase tracking-wide">Total</td>
                {(['acces', 'architectural', 'plaque'] as AccessDoorType[]).map((type) => (
                  <td key={type} className="px-3 py-2">
                    {totals[type] > 0
                      ? <span className={`px-2 py-0.5 rounded-full font-bold ${badgeStyle[type]}`}>{totals[type]}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span className="px-2 py-0.5 bg-gray-700 text-white rounded-full">{grandTotal}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────────

export default function PortesView() {
  const currentProjectId  = useAppStore((s) => s.currentProjectId)
  const plans             = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const travaux           = useAppStore((s) => {
    const pIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) => t.planId ? pIds.has(t.planId) : t.projectId === s.currentProjectId)
  })
  const removeAccessDoor  = useAppStore((s) => s.removeAccessDoor)
  const updatePlan        = useAppStore((s) => s.updatePlan)
  const setCurrentPlan    = useAppStore((s) => s.setCurrentPlan)

  const [filterPlanId,  setFilterPlanId]  = useState<string>('')
  const [filterStatut,  setFilterStatut]  = useState<StatutPorte | ''>('')
  const [filterType,    setFilterType]    = useState<AccessDoorType | ''>('')
  const [filterSysId,   setFilterSysId]   = useState<string>('')
  const [showFilters,   setShowFilters]   = useState(false)

  const allDoors = plans.flatMap((plan) =>
    (plan.accessDoors ?? []).map((d) => ({ ...d, planName: plan.name, planId: plan.id }))
  )
  const project     = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const systemes    = project?.systemes ?? []
  const planIdSet   = new Set(plans.map((p) => p.id))
  const sansPlanDoors = travaux
    .filter((t) => !t.planId && t.projectId === currentProjectId)
    .flatMap((t) => {
      const sys = systemes.find((s) => s.id === t.systemeId)
      return (t.portesInstalleesLibres ?? []).map((p) => ({
        ...p, travailNumero: t.numero, sysNom: sys?.nom ?? '—',
      }))
    })

  const filtered = allDoors.filter((d) => {
    if (filterPlanId && d.planId !== filterPlanId) return false
    if (filterStatut && d.statut !== filterStatut)  return false
    if (filterType   && d.type   !== filterType)    return false
    if (filterSysId) {
      const linked = travaux.filter((t) => (t.portesUtilisees ?? []).includes(d.id))
      const matchesTravail = linked.some((t) => t.systemeId === filterSysId)
      const matchesDoor    = linked.length === 0 && d.systemeId === filterSysId
      if (!matchesTravail && !matchesDoor) return false
    }
    return true
  })

  const SELECT = 'border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

  function goToPlan(planId: string) {
    setCurrentPlan(planId)
    ;(window as any).setAppView?.('plan')
  }

  function handleDelete(planId: string, doorId: string, numero: string) {
    if (window.confirm(`Supprimer la porte ${numero} ?`)) {
      removeAccessDoor(planId, doorId)
    }
  }

  function handleDeleteAll() {
    if (!window.confirm(`Supprimer toutes les portes d'accès (${allDoors.length}) ? Cette action est irréversible.`)) return
    for (const plan of plans) {
      if ((plan.accessDoors ?? []).length > 0) {
        updatePlan(plan.id, { accessDoors: [] } as any)
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Récapitulatif par système */}
      <PortesSummary />

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Portes d'accès</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} porte{filtered.length !== 1 ? 's' : ''} · {allDoors.length} total sur {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allDoors.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Supprimer toutes les portes et remettre la numérotation à zéro"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Tout supprimer
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showFilters || filterPlanId || filterStatut || filterType || filterSysId
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="grid grid-cols-4 gap-3 mb-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Système</label>
            <select className={`${SELECT} w-full`} value={filterSysId}
              onChange={(e) => setFilterSysId(e.target.value)}>
              <option value="">Tous les systèmes</option>
              {systemes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Plan</label>
            <select className={`${SELECT} w-full`} value={filterPlanId}
              onChange={(e) => setFilterPlanId(e.target.value)}>
              <option value="">Tous les plans</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Statut</label>
            <select className={`${SELECT} w-full`} value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value as StatutPorte | '')}>
              <option value="">Tous les statuts</option>
              {(Object.entries(STATUT_PORTE) as [StatutPorte, typeof STATUT_PORTE[StatutPorte]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select className={`${SELECT} w-full`} value={filterType}
              onChange={(e) => setFilterType(e.target.value as AccessDoorType | '')}>
              <option value="">Tous les types</option>
              {(Object.entries(ACCESS_DOOR_TYPE_LABELS) as [AccessDoorType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Liste vide */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{allDoors.length === 0 ? 'Aucune porte d\'accès' : 'Aucun résultat'}</p>
          <p className="text-sm mt-1">
            {allDoors.length === 0
              ? 'Utilisez l\'outil "Porte" sur le plan pour en placer une'
              : 'Modifiez les filtres pour voir plus de résultats'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* En-tête tableau */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_auto] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            <span>Porte</span>
            <span>Type</span>
            <span>Dimensions</span>
            <span>Plan</span>
            <span>Travaux / Photos</span>
            <span />
          </div>

          {filtered.map((door, i) => {
            const statutInfo    = STATUT_PORTE[door.statut ?? 'existante']
            const linkedTravaux = travaux.filter((t) => (t.portesUtilisees ?? []).includes(door.id))
            const nbPhotos      = (door.photosPorte ?? []).length

            return (
              <div key={door.id}
                className={`grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_auto] gap-4 px-4 py-3 items-center ${
                  i > 0 ? 'border-t border-gray-50 dark:border-gray-700/50' : ''
                } hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors`}
              >
                {/* Numero + statut */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: statutInfo.color }}>
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{door.numero}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                      style={{ background: statutInfo.color }}>
                      {statutInfo.label}
                    </span>
                  </div>
                </div>

                {/* Type */}
                <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  {ACCESS_DOOR_TYPE_LABELS[door.type]}
                </div>

                {/* Dimensions */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {door.dimensions || '—'}
                </div>

                {/* Plan */}
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{door.planName}</span>
                </div>

                {/* Travaux + photos */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {linkedTravaux.length > 0 && (
                    <span className="flex items-center gap-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                      {linkedTravaux.length} trav.
                    </span>
                  )}
                  {nbPhotos > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Camera className="w-3 h-3" />{nbPhotos}
                    </span>
                  )}
                  {linkedTravaux.length === 0 && nbPhotos === 0 && <span>—</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => goToPlan(door.planId)}
                    title="Aller au plan"
                    className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    Voir plan
                  </button>
                  <button
                    onClick={() => handleDelete(door.planId, door.id, door.numero)}
                    title="Supprimer"
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Section — Portes sans plan */}
      {sansPlanDoors.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Portes — Sections sans plan</span>
            <span className="text-xs text-gray-400 ml-auto">{sansPlanDoors.length} entrée{sansPlanDoors.length > 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-[1fr_2fr_1fr_1.5fr_1.5fr] gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            <span>Trav. #</span><span>Type</span><span>Dimensions</span><span>Statut</span><span>Système</span>
          </div>
          {sansPlanDoors.map((entry, i) => {
            const PREFIX: Record<string, string> = { acces: 'PA', architectural: 'P.Ar.', plaque: 'PL' }
            const statutInfo = STATUT_PORTE[(entry.statut ?? 'ajoutee') as StatutPorte] ?? STATUT_PORTE.ajoutee
            return (
              <div key={i} className={`grid grid-cols-[1fr_2fr_1fr_1.5fr_1.5fr] gap-4 px-4 py-2.5 items-center text-xs ${i > 0 ? 'border-t border-gray-50 dark:border-gray-700/50' : ''} hover:bg-gray-50/50 dark:hover:bg-gray-700/20`}>
                <span className="font-bold text-gray-700 dark:text-gray-200">#{entry.travailNumero}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {ACCESS_DOOR_TYPE_LABELS[entry.type as AccessDoorType]}
                  <span className="ml-1 text-gray-400 font-mono text-[10px]">{PREFIX[entry.type] ?? ''}</span>
                </span>
                <span className="font-mono text-gray-500 dark:text-gray-400">{entry.dimensions || '—'}</span>
                <span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: statutInfo.color }}>
                    {statutInfo.label}
                  </span>
                </span>
                <span className="text-gray-500 dark:text-gray-400 truncate">{entry.sysNom}</span>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
