import {
  CheckCircle, Clock, AlertCircle, Wind, Camera, Layers, DoorOpen, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { NIVEAU_SALUBRITE_INFO, STATUT_TRAVAIL } from '@/types'
import type { NiveauSalubrite } from '@/types'

type View = 'plan' | 'dashboard' | 'systemes' | 'travaux' | 'portes' | 'photos' | 'report'

interface Props { onNavigate: (v: View) => void }

export default function Dashboard({ onNavigate }: Props) {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project   = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const plans     = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const allTravaux = useAppStore((s) => s.travaux.filter((t) => plans.map((p) => p.id).includes(t.planId)))

  if (!project) return null

  const total     = allTravaux.length
  const statCounts = {
    a_faire:  allTravaux.filter((t) => t.statut === 'a_faire').length,
    en_cours: allTravaux.filter((t) => t.statut === 'en_cours').length,
    complete: allTravaux.filter((t) => t.statut === 'complete').length,
    valide:   allTravaux.filter((t) => t.statut === 'valide').length,
  }
  const done       = statCounts.complete + statCounts.valide
  const completion = total > 0 ? Math.round((done / total) * 100) : 0

  const totalPhotosAvant    = allTravaux.reduce((a, t) => a + t.photosAvant.length, 0)
  const totalPhotosPendant  = allTravaux.reduce((a, t) => a + t.photosPendant.length, 0)
  const totalPhotosApres    = allTravaux.reduce((a, t) => a + t.photosApres.length, 0)
  const totalAnomalies      = allTravaux.reduce((a, t) => a + t.anomalies.length, 0)
  const totalDoors          = plans.reduce((a, p) => a + (p.accessDoors?.length ?? 0), 0)
  const totalDuree          = allTravaux.reduce((a, t) => a + (t.dureeHeures ?? 0), 0)

  // Distribution niveau salubrité initial
  const nivCounts: Record<NiveauSalubrite, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  allTravaux.forEach((t) => { if (t.niveauSalubriteInitial) nivCounts[t.niveauSalubriteInitial as NiveauSalubrite]++ })

  // Par système
  const systemes = project.systemes ?? []
  const bySystem = systemes.map((sys) => {
    const t = allTravaux.filter((tr) => tr.systemeId === sys.id)
    return {
      ...sys,
      count: t.length,
      done:  t.filter((tr) => tr.statut === 'complete' || tr.statut === 'valide').length,
    }
  }).filter((s) => s.count > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
          {project.client}
          {project.adresse && ` · ${project.adresse}${project.ville ? `, ${project.ville}` : ''}`}
          {project.contrat && ` · Contrat ${project.contrat}`}
        </p>
        <div className="flex gap-3 mt-2 text-xs text-gray-400">
          {project.technicien && <span>Technicien : {project.technicien}</span>}
          {project.dateDebut  && <span>Début : {new Date(project.dateDebut).toLocaleDateString('fr-CA')}</span>}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avancement global</span>
          <span className="text-2xl font-bold text-blue-600">{completion}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-green-500 transition-all duration-700"
            style={{ width: `${completion}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-xs">
          {(Object.entries(STATUT_TRAVAIL) as any[]).map(([key, info]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: info.color }} />
              <span className="text-gray-500 dark:text-gray-400">{info.label}: {(statCounts as any)[key]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Travaux complétés', value: done,               icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'En cours',          value: statCounts.en_cours, icon: Clock,       color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Anomalies',         value: totalAnomalies,      icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Portes accès',      value: totalDoors,          icon: DoorOpen,    color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Photos avant',      value: totalPhotosAvant,    icon: Camera,      color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Photos pendant',    value: totalPhotosPendant,  icon: Camera,      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Photos après',      value: totalPhotosApres,    icon: Camera,      color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
          { label: 'Heures travaillées',value: totalDuree.toFixed(1), icon: TrendingUp, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-800' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Distribution niveaux de salubrité */}
      {Object.values(nivCounts).some((v) => v > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-3">Niveaux de salubrité initiaux (IRSST)</h3>
          <div className="flex gap-3">
            {([1, 2, 3, 4] as NiveauSalubrite[]).map((n) => {
              const info = NIVEAU_SALUBRITE_INFO[n]
              const count = nivCounts[n]
              const pct = total > 0 ? Math.round(count / total * 100) : 0
              return (
                <div key={n} className="flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">{info.label.split('—')[0].trim()}</div>
                  <div className="h-2 rounded-full w-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-1">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: info.color }} />
                  </div>
                  <div className="text-sm font-bold text-center" style={{ color: info.color }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Par système */}
      {bySystem.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Par système</h3>
            <button onClick={() => onNavigate('systemes')}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">
              Gérer les systèmes →
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {bySystem.map((sys) => {
              const pct = sys.count > 0 ? Math.round(sys.done / sys.count * 100) : 0
              return (
                <div key={sys.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Wind className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{sys.nom}</span>
                      <span className="text-xs text-gray-500">{sys.done}/{sys.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-600 w-10 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Travaux récents */}
      {allTravaux.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Travaux récents</h3>
            <button onClick={() => onNavigate('travaux')}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">
              Voir tous →
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {[...allTravaux].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map((t) => {
              const sys = project.systemes.find((s) => s.id === t.systemeId)
              const niv = t.niveauSalubriteInitial
              const statutInfo = STATUT_TRAVAIL[t.statut]
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center flex-shrink-0"
                    style={{ background: niv ? NIVEAU_SALUBRITE_INFO[niv as NiveauSalubrite].color : statutInfo.color }}>
                    {t.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate block">
                      {sys?.nom ?? 'Sans système'} — {t.typeComposante ?? t.location ?? 'Travail'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(t.updatedAt).toLocaleDateString('fr-CA')}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: statutInfo.color }}>
                    {statutInfo.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
