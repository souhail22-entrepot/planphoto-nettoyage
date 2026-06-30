import { MapPin, Filter, Search, Plus, ClipboardList, Trash2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { COMPOSANTES_CVAC } from '@/types'
import TravailPanel from '@/components/panels/TravailPanel'
import SansPlanTableView from '@/components/views/SansPlanTableView'

// ── Vue principale ────────────────────────────────────────────────────────────

type PlanFilter = 'all' | 'with' | 'without'

interface Props { onNavigatePlan: () => void }

export default function TravauxView({ onNavigatePlan }: Props) {
  const currentProjectId      = useAppStore((s) => s.currentProjectId)
  const project               = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const plans                 = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const selectedTravailId     = useAppStore((s) => s.selectedTravailId)
  const allTravaux            = useAppStore((s) => {
    const planIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) =>
      t.planId ? planIds.has(t.planId) : t.projectId === s.currentProjectId
    )
  })
  const setCurrentPlan        = useAppStore((s) => s.setCurrentPlan)
  const setSelectedTravail    = useAppStore((s) => s.setSelectedTravail)
  const addStandaloneTravail  = useAppStore((s) => s.addStandaloneTravail)
  const deleteTravail         = useAppStore((s) => s.deleteTravail)

  const [search,       setSearch]       = useState('')
  const [filterSys,    setFilterSys]    = useState('')
  const [planFilter,   setPlanFilter]   = useState<PlanFilter>('all')
  const [checkedIds,   setCheckedIds]   = useState<Set<string>>(new Set())

  const toggleCheck = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCheckedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const systemes         = project?.systemes ?? []
  const withPlanCount    = allTravaux.filter((t) => !!t.planId).length
  const withoutPlanCount = allTravaux.length - withPlanCount

  const filtered = allTravaux.filter((t) => {
    if (planFilter === 'with'    && !t.planId)  return false
    if (planFilter === 'without' && !!t.planId) return false
    const sys   = systemes.find((s) => s.id === t.systemeId)
    const query = search.toLowerCase()
    const matchSearch = !query || (
      sys?.nom.toLowerCase().includes(query) ||
      String(t.numero).includes(query) ||
      (t.location ?? '').toLowerCase().includes(query) ||
      (t.zoneDesservie ?? '').toLowerCase().includes(query) ||
      (t.typeComposante && COMPOSANTES_CVAC[t.typeComposante]?.label.toLowerCase().includes(query))
    )
    return matchSearch && (!filterSys || t.systemeId === filterSys)
  })

  function deleteChecked() {
    checkedIds.forEach((id) => deleteTravail(id))
    setCheckedIds(new Set())
  }

  const allFilteredChecked = filtered.length > 0 && filtered.every((t) => checkedIds.has(t.id))

  function toggleAllFiltered() {
    if (allFilteredChecked) {
      setCheckedIds((prev) => { const next = new Set(prev); filtered.forEach((t) => next.delete(t.id)); return next })
    } else {
      setCheckedIds((prev) => { const next = new Set(prev); filtered.forEach((t) => next.add(t.id)); return next })
    }
  }

  function selectTravail(travailId: string) {
    setSelectedTravail(selectedTravailId === travailId ? null : travailId)
  }

  function goToPlan(e: React.MouseEvent, travail: { id: string; planId: string }) {
    e.stopPropagation()
    if (!travail.planId) return
    setCurrentPlan(travail.planId)
    setSelectedTravail(travail.id)
    onNavigatePlan()
  }

  function handleAddStandalone() {
    addStandaloneTravail()
    setPlanFilter('without')
    // reste dans TravauxView — TravailPanel s'ouvre sur la droite
  }

  if (!project) return null

  const TH = 'px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50 dark:bg-gray-800/80'
  const TD = 'px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 align-middle'

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Zone principale (table + filtres) ── */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">

        {/* En-tête */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Travaux de nettoyage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} / {allTravaux.length} travaux</p>
          </div>
          <div className="flex-1" />

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-44"
            />
          </div>

          {/* Filtre système */}
          <select value={filterSys} onChange={(e) => setFilterSys(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none">
            <option value="">Tous systèmes</option>
            {systemes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>

          {/* Bouton nouveau travail sans plan */}
          <button
            onClick={handleAddStandalone}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouveau sans plan
          </button>
        </div>

        {/* Onglets Sur plan / Sans plan */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {([
            { key: 'all'     as PlanFilter, label: 'Tous',     count: allTravaux.length,  icon: null          },
            { key: 'with'    as PlanFilter, label: 'Sur plan',  count: withPlanCount,      icon: MapPin        },
            { key: 'without' as PlanFilter, label: 'Sans plan', count: withoutPlanCount,   icon: ClipboardList },
          ]).map(({ key, label, count, icon: Icon }) => {
            const active = planFilter === key
            return (
              <button key={key} onClick={() => setPlanFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
                <span className={`px-1.5 rounded-full text-xs ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Section inline éditable — Sans plan */}
        {planFilter === 'without' && (
          <div className="flex-1 -mx-6 -mb-6 overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
            <SansPlanTableView />
          </div>
        )}

        {/* Table — Tous / Sur plan */}
        {planFilter !== 'without' && (filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun travail trouvé</p>
            <p className="text-sm mt-1">Modifiez les filtres</p>
          </div>
        ) : (
          <>
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
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

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className={TH + ' w-8'}>
                    <input
                      type="checkbox"
                      checked={allFilteredChecked}
                      onChange={toggleAllFiltered}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Tout sélectionner"
                    />
                  </th>
                  <th className={TH}>#</th>
                  <th className={TH}>Système</th>
                  <th className={TH}>Composante</th>
                  <th className={TH}>Zone / Secteur</th>
                  <th className={TH}>Localisation</th>
                  <th className={TH}>Photos</th>
                  <th className={TH}>Anomalies</th>
                  <th className={TH}>Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((t) => {
                  const sys        = systemes.find((s) => s.id === t.systemeId)
                  const plan       = plans.find((p) => p.id === t.planId)
                  const photoCount = t.photosAvant.length + t.photosPendant.length + t.photosApres.length
                  const isSelected = selectedTravailId === t.id

                  const isChecked = checkedIds.has(t.id)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => selectTravail(t.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-red-50/60 dark:bg-red-900/10'
                          : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className={TD + ' w-8'} onClick={(e) => toggleCheck(t.id, e)}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                        />
                      </td>

                      {/* # */}
                      <td className={TD}>
                        <div className="w-7 h-7 rounded-lg text-xs font-bold text-white flex items-center justify-center bg-slate-500">
                          {t.numero}
                        </div>
                      </td>

                      {/* Système */}
                      <td className={TD}>
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-semibold">
                          {sys?.nom ?? <span className="text-gray-400 font-normal">—</span>}
                        </span>
                      </td>

                      {/* Composante */}
                      <td className={TD}>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {t.typeComposante ? COMPOSANTES_CVAC[t.typeComposante]?.label : '—'}
                        </span>
                      </td>

                      {/* Zone / Secteur */}
                      <td className={TD}>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {t.location || <span className="text-gray-400">—</span>}
                        </div>
                      </td>

                      {/* Localisation */}
                      <td className={TD}>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {t.zoneDesservie || <span className="text-gray-400">—</span>}
                        </div>
                      </td>

                      {/* Photos */}
                      <td className={TD}>
                        {photoCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium">
                            {photoCount}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Anomalies */}
                      <td className={TD}>
                        {t.anomalies.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium">
                            {t.anomalies.length}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Plan */}
                      <td className={TD}>
                        {plan ? (
                          <button
                            onClick={(e) => goToPlan(e, t)}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                            title="Voir sur le plan"
                          >
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {plan.name}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full whitespace-nowrap w-fit">
                            <ClipboardList className="w-3 h-3" />
                            Sans plan
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        ))}
      </div>

      {/* ── Panneau latéral TravailPanel ── */}
      {selectedTravailId && planFilter !== 'without' && <TravailPanel />}

    </div>
  )
}
