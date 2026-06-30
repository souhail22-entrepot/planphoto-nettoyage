import { Plus, Trash2, Edit2, Check, X, Wind } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { STATUT_TRAVAIL } from '@/types'

export default function SystemesView() {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project          = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId))
  const plans            = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const allTravaux       = useAppStore((s) => {
    const pIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) => t.planId ? pIds.has(t.planId) : t.projectId === s.currentProjectId)
  })
  const addSysteme    = useAppStore((s) => s.addSysteme)
  const updateSysteme = useAppStore((s) => s.updateSysteme)
  const deleteSysteme = useAppStore((s) => s.deleteSysteme)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ nom: '', description: '', type: '', localisation: '', zonesDesservies: '' })
  const [newForm, setNewForm]     = useState({ nom: '', description: '', type: '', localisation: '', zonesDesservies: '' })
  const [showNew, setShowNew]     = useState(false)

  if (!project) return null

  const systemes = project.systemes

  function handleAddSysteme(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.nom.trim()) return
    addSysteme(project!.id, {
      nom:             newForm.nom.trim(),
      description:     newForm.description.trim()     || undefined,
      type:            newForm.type.trim()            || undefined,
      localisation:    newForm.localisation.trim()    || undefined,
      zonesDesservies: newForm.zonesDesservies.trim() || undefined,
    })
    setNewForm({ nom: '', description: '', type: '', localisation: '', zonesDesservies: '' })
    setShowNew(false)
  }

  function startEdit(sys: { id: string; nom: string; description?: string; type?: string; localisation?: string; zonesDesservies?: string }) {
    setEditingId(sys.id)
    setEditForm({ nom: sys.nom, description: sys.description ?? '', type: sys.type ?? '', localisation: sys.localisation ?? '', zonesDesservies: sys.zonesDesservies ?? '' })
  }

  function saveEdit() {
    if (!editingId || !editForm.nom.trim()) return
    updateSysteme(project!.id, editingId, {
      nom:             editForm.nom.trim(),
      description:     editForm.description.trim()     || undefined,
      type:            editForm.type.trim()            || undefined,
      localisation:    editForm.localisation.trim()    || undefined,
      zonesDesservies: editForm.zonesDesservies.trim() || undefined,
    })
    setEditingId(null)
  }

  const INPUT = 'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Systèmes CVAC</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Les systèmes sont des entités dynamiques — créez librement VA-1, EV-1, AHU-1, etc.
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Ajouter un système
        </button>
      </div>

      {/* Formulaire nouveau système */}
      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-4 mb-4">
          <form onSubmit={handleAddSysteme} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom *</label>
                <input required autoFocus className={`${INPUT} w-full`}
                  placeholder="ex. VA-1, EV-3, AHU-01"
                  value={newForm.nom} onChange={(e) => setNewForm({ ...newForm, nom: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <input className={`${INPUT} w-full`}
                  placeholder="Ventilation cuisine"
                  value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <input className={`${INPUT} w-full`}
                  placeholder="ventilation"
                  value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })} />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Localisation du système</label>
                <input className={`${INPUT} w-full`}
                  placeholder="ex. sous-sol, toit, salle mécanique 3e étage"
                  value={newForm.localisation} onChange={(e) => setNewForm({ ...newForm, localisation: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Zones desservies</label>
                <input className={`${INPUT} w-full`}
                  placeholder="ex. bureaux 2e-4e, cuisine, stationnement"
                  value={newForm.zonesDesservies} onChange={(e) => setNewForm({ ...newForm, zonesDesservies: e.target.value })} />
              </div>
              <div className="flex gap-1 pb-0.5">
                <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setShowNew(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Liste des systèmes */}
      {systemes.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Wind className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun système créé</p>
          <p className="text-sm mt-1">Créez vos systèmes CVAC (VA-1, EV-1, AHU-1…)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {systemes.map((sys) => {
            const travaux = allTravaux.filter((t) => t.systemeId === sys.id)
            const done    = travaux.filter((t) => t.statut === 'complete' || t.statut === 'valide').length
            const total   = travaux.length

            if (editingId === sys.id) {
              return (
                <div key={sys.id} className="bg-white dark:bg-gray-800 rounded-xl border border-blue-300 dark:border-blue-700 p-4 space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom</label>
                      <input autoFocus className={`${INPUT} w-full`}
                        value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                      <input className={`${INPUT} w-full`}
                        value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    </div>
                    <div className="w-36">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                      <input className={`${INPUT} w-full`}
                        value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Localisation du système</label>
                      <input className={`${INPUT} w-full`}
                        placeholder="ex. sous-sol, toit, salle mécanique 3e étage"
                        value={editForm.localisation} onChange={(e) => setEditForm({ ...editForm, localisation: e.target.value })} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Zones desservies</label>
                      <input className={`${INPUT} w-full`}
                        placeholder="ex. bureaux 2e-4e, cuisine, stationnement"
                        value={editForm.zonesDesservies} onChange={(e) => setEditForm({ ...editForm, zonesDesservies: e.target.value })} />
                    </div>
                    <div className="flex gap-1 pb-0.5">
                      <button onClick={saveEdit} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={sys.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wind className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{sys.nom}</span>
                    {sys.type && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{sys.type}</span>}
                  </div>
                  {sys.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sys.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {sys.localisation && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        <span className="font-medium text-gray-500 dark:text-gray-400">Loc.&nbsp;</span>{sys.localisation}
                      </span>
                    )}
                    {sys.zonesDesservies && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        <span className="font-medium text-gray-500 dark:text-gray-400">Zones&nbsp;</span>{sys.zonesDesservies}
                      </span>
                    )}
                  </div>
                </div>

                {/* Statistiques travaux */}
                <div className="text-center min-w-[60px]">
                  <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{total}</div>
                  <div className="text-xs text-gray-400">travaux</div>
                </div>
                <div className="min-w-[80px]">
                  {total > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{done}/{total}</span>
                        <span>{Math.round(done / total * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.round(done / total * 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>

                {/* Mini statut */}
                <div className="flex gap-1">
                  {(Object.entries(STATUT_TRAVAIL) as any[]).map(([key, info]) => {
                    const cnt = travaux.filter((t) => t.statut === key).length
                    return cnt > 0 ? (
                      <span key={key} className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ background: info.color }} title={info.label}>
                        {cnt}
                      </span>
                    ) : null
                  })}
                </div>

                <div className="flex gap-1">
                  <button onClick={() => startEdit(sys)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => {
                    if (total > 0 && !window.confirm(`Supprimer ${sys.nom} ? Les ${total} travaux liés resteront sans système.`)) return
                    deleteSysteme(project!.id, sys.id)
                  }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
