import {
  LayoutDashboard, Map, List, Camera, FileDown, ClipboardList,
  Plus, ChevronDown, ChevronRight, Trash2, FolderOpen,
  DoorOpen, Settings, RotateCw, ChevronLeft, Pencil, Layers, BookOpen,
  Home, X, FolderDown,
} from 'lucide-react'
import React, { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import { readProjectJsonFromFolder, restorePhotosFromFolder, setLoadedProjectDirHandle } from '@/services/fileSystemSave'

type View = 'plan' | 'dashboard' | 'systemes' | 'travaux' | 'portes' | 'photos' | 'report' | 'intervention' | 'matching' | 'templates'

interface Props {
  currentView:  View
  onViewChange: (v: View) => void
}

export default function Sidebar({ currentView, onViewChange }: Props) {
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [plansOpen, setPlansOpen]       = useState(true)
  const collapsed      = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar  = useAppStore((s) => s.toggleSidebar)
  const projects       = useAppStore((s) => s.projects)
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const deleteProject  = useAppStore((s) => s.deleteProject)
  const plans          = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const currentPlanId  = useAppStore((s) => s.currentPlanId)
  const setCurrentPlan = useAppStore((s) => s.setCurrentPlan)
  const deletePlan     = useAppStore((s) => s.deletePlan)
  const updatePlan     = useAppStore((s) => s.updatePlan)
  const travaux        = useAppStore((s) => {
    const pIds = new Set(s.plans.filter((p) => p.projectId === s.currentProjectId).map((p) => p.id))
    return s.travaux.filter((t) => t.planId ? pIds.has(t.planId) : t.projectId === s.currentProjectId)
  })

  const total = travaux.length

  const navItems: { id: View; icon: any; label: string; badge?: number }[] = [
    { id: 'dashboard',   icon: LayoutDashboard, label: 'Tableau de bord' },
    { id: 'systemes',    icon: Settings,        label: 'Systèmes CVAC' },
    { id: 'travaux',     icon: List,            label: 'Travaux',             badge: total },
    { id: 'portes',      icon: DoorOpen,        label: 'Portes accès' },
    { id: 'photos',      icon: Camera,          label: 'Photos' },
    { id: 'intervention', icon: ClipboardList,  label: 'Rapport intervention' },
    { id: 'matching',    icon: Layers,          label: 'Appariement photo interv.' },
    { id: 'templates',   icon: BookOpen,        label: 'Bibliothèque modèles' },
    { id: 'report',      icon: FileDown,        label: 'Rapport final' },
  ]

  const importProjectJSON         = useAppStore((s) => s.importProjectJSON)
  const restoreTravailPhotos      = useAppStore((s) => s.restoreTravailPhotos)
  const restoreInterventionPhotos = useAppStore((s) => s.restoreInterventionPhotos)
  const restorePlanImages         = useAppStore((s) => s.restorePlanImages)

  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [loadingFolder,  setLoadingFolder]  = useState(false)

  async function handleLoadFromFolder() {
    if (!('showDirectoryPicker' in window)) {
      toast.error('Non supporté dans ce navigateur (utilisez Chrome ou Edge)')
      return
    }
    setLoadingFolder(true)
    try {
      const dir = await (window as any).showDirectoryPicker({ mode: 'read' })
      const data = await readProjectJsonFromFolder(dir)
      if (!data || !(data as any).project) {
        toast.error('Aucun project.json valide dans ce dossier')
        return
      }
      const projectId = (data as any).project?.id
      // Mémoriser le handle pour lecture directe depuis disque (fallback si IndexedDB échoue)
      setLoadedProjectDirHandle(projectId, dir)
      importProjectJSON(data)
      toast.loading('Restauration des photos…', { id: 'restore-photos' })
      const counts = await restorePhotosFromFolder(dir, projectId)
      await Promise.all([restoreTravailPhotos(), restoreInterventionPhotos(), restorePlanImages()])
      toast.success(
        `Projet chargé — ${counts.travail} photos travaux · ${counts.intervention} interventions · ${counts.plan} plans`,
        { id: 'restore-photos' }
      )
      setCurrentProject(projectId)
      onViewChange('dashboard')
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Erreur lors du chargement')
    } finally {
      setLoadingFolder(false)
    }
  }

  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [editDrawing, setEditDrawing] = useState('')
  const nameInputRef                = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent, plan: { id: string; name: string; drawingNumber?: string }) {
    e.stopPropagation()
    setEditingId(plan.id)
    setEditName(plan.name)
    setEditDrawing(plan.drawingNumber ?? '')
    setTimeout(() => nameInputRef.current?.select(), 30)
  }

  function commitEdit(planId: string) {
    const trimmed = editName.trim()
    if (trimmed) updatePlan(planId, { name: trimmed, drawingNumber: editDrawing.trim() || undefined })
    setEditingId(null)
  }

  const ROTATION_STEPS = [0, 90, 180, 270] as const

  if (collapsed) {
    return (
      <aside className="w-12 bg-gray-950 text-gray-300 flex flex-col items-center py-2 gap-1 flex-shrink-0 border-r border-gray-800">
        <button onClick={toggleSidebar} className="p-2 text-gray-600 hover:text-gray-300 transition-colors mb-1">
          <ChevronRight className="w-4 h-4" />
        </button>
        {currentProjectId && navItems.map((item) => (
          <button key={item.id} onClick={() => onViewChange(item.id)}
            title={item.label}
            className={`p-2 rounded-lg transition-colors ${currentView === item.id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'}`}>
            <item.icon className="w-4 h-4" />
          </button>
        ))}
      </aside>
    )
  }

  return (
    <aside className="w-56 bg-gray-950 text-gray-300 flex flex-col h-full flex-shrink-0">

      {/* Toggle collapse */}
      <button onClick={toggleSidebar}
        className="absolute left-52 top-16 z-20 w-5 h-5 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors hidden">
        <ChevronLeft className="w-3 h-3" />
      </button>

      {/* Projets */}
      <div className="border-b border-gray-800">
        <div className="flex items-center px-4 py-2.5">
          <button onClick={() => setProjectsOpen(!projectsOpen)}
            className="flex items-center gap-1 flex-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors">
            <span>Projets ({projects.length})</span>
            {projectsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <button onClick={() => setNewProjectOpen(true)}
            title="Nouveau projet"
            className="p-1 rounded-md text-gray-600 hover:text-sky-400 hover:bg-gray-800 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleLoadFromFolder}
            disabled={loadingFolder}
            title="Charger un projet depuis un dossier"
            className="p-1 rounded-md text-gray-600 hover:text-green-400 hover:bg-gray-800 transition-colors disabled:opacity-40 ml-0.5">
            <FolderDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCurrentProject(null)}
            title="Revenir à l'écran d'accueil"
            className="p-1 rounded-md text-gray-600 hover:text-sky-400 hover:bg-gray-800 transition-colors ml-0.5">
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>
        {projectsOpen && (
          <div className="pb-2 max-h-40 overflow-y-auto">
            {projects.length === 0 && <p className="text-xs text-gray-700 px-4 pb-2">Aucun projet</p>}
            {projects.map((p) => (
              <div key={p.id}
                onClick={() => { setCurrentProject(p.id); onViewChange('dashboard') }}
                className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${
                  p.id === currentProjectId ? 'bg-blue-900/30 text-blue-300' : 'hover:bg-gray-800 text-gray-500 hover:text-gray-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs flex-1 break-words leading-snug line-clamp-2" title={p.name}>{p.name}</span>
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Supprimer ce projet ?')) deleteProject(p.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentProjectId && (
        <>
          <nav className="py-1">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-600/20 text-blue-300 border-r-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] bg-gray-700 text-gray-400 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>


          {/* Plans */}
          <div className="border-t border-gray-800 py-1 flex-1 overflow-y-auto">
            <div className="flex items-center px-4 py-2">
              <button onClick={() => setPlansOpen(!plansOpen)}
                className="flex items-center gap-1 flex-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors">
                <span>Plans ({plans.length})</span>
                {plansOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              <button onClick={() => { setCurrentPlan(null); onViewChange('plan') }}
                title="Ajouter un plan"
                className="p-1 rounded-md text-gray-600 hover:text-blue-400 hover:bg-gray-800 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {plansOpen && plans.map((plan) => (
              <div key={plan.id}
                onClick={() => { if (editingId !== plan.id) { setCurrentPlan(plan.id); onViewChange('plan') } }}
                className={`group flex flex-col px-3 py-1.5 cursor-pointer transition-colors ${
                  plan.id === currentPlanId ? 'bg-gray-800 text-gray-200' : 'text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                }`}
              >
                {editingId === plan.id ? (
                  /* Formulaire inline d'édition */
                  <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1 py-0.5">
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">Titre du plan</label>
                    <input
                      ref={nameInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(plan.id) }
                        if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                      }}
                      className="w-full text-xs bg-gray-700 text-gray-100 border border-blue-500 rounded px-1.5 py-0.5 focus:outline-none"
                      placeholder="Titre du plan"
                    />
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 mt-0.5">No. dessin</label>
                    <input
                      value={editDrawing}
                      onChange={(e) => setEditDrawing(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(plan.id) }
                        if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                      }}
                      className="w-full text-xs bg-gray-700 text-gray-100 border border-gray-600 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
                      placeholder="ex. A-101"
                    />
                    <div className="flex gap-1 mt-1">
                      <button type="button" onClick={() => commitEdit(plan.id)}
                        className="flex-1 text-[10px] py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                        Enregistrer
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-2 text-[10px] py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs break-words leading-snug line-clamp-2" title={plan.name}>{plan.name}</p>
                      <div className="flex items-center gap-2">
                        {plan.drawingNumber && (
                          <p className="text-[9px] text-blue-500 font-medium">#{plan.drawingNumber}</p>
                        )}
                        {plan.pageNumber && (
                          <p className="text-[9px] text-gray-700">p.{plan.pageNumber}/{plan.totalPages}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button title="Modifier titre et No. dessin"
                        onClick={(e) => startEdit(e, plan)}
                        className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button title="Pivoter"
                        onClick={(e) => {
                          e.stopPropagation()
                          const r = ((plan.rotation ?? 0) + 90) % 360 as 0 | 90 | 180 | 270
                          updatePlan(plan.id, { rotation: r })
                        }}
                        className="p-0.5 text-gray-600 hover:text-yellow-400 transition-colors">
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button title="Supprimer"
                        onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }}
                        className="p-0.5 text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </>
      )}

      {newProjectOpen && (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreate={(id) => { setCurrentProject(id); onViewChange('dashboard'); setNewProjectOpen(false) }}
        />
      )}
    </aside>
  )
}

// ── Modale création nouveau projet ────────────────────────────────────────────

const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-colors'
const LABEL = 'block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider'

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const createProject = useAppStore((s) => s.createProject)
  const [form, setForm] = useState({
    name: '', client: '', adresse: '', ville: '', codePostal: '',
    technicien: '', contrat: '', dateDebut: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = createProject({ ...form, description: '', technicienTitre: '', verificateur: '', contact: '', telephone: '' })
    onCreate(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/50">
          <h2 className="text-sm font-bold text-white">Nouveau projet de nettoyage</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL}>Nom du projet *</label>
              <input required className={INPUT} value={form.name} onChange={set('name')} placeholder="ex. Cuisine centrale — Tour A" />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Client *</label>
              <input required className={INPUT} value={form.client} onChange={set('client')} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Adresse</label>
              <input className={INPUT} value={form.adresse} onChange={set('adresse')} />
            </div>
            <div>
              <label className={LABEL}>Ville</label>
              <input className={INPUT} value={form.ville} onChange={set('ville')} />
            </div>
            <div>
              <label className={LABEL}>Code postal</label>
              <input className={INPUT} value={form.codePostal} onChange={set('codePostal')} />
            </div>
            <div>
              <label className={LABEL}>Technicien</label>
              <input className={INPUT} value={form.technicien} onChange={set('technicien')} />
            </div>
            <div>
              <label className={LABEL}>N° contrat</label>
              <input className={INPUT} value={form.contrat} onChange={set('contrat')} />
            </div>
            <div>
              <label className={LABEL}>Date de début</label>
              <input type="date" className={INPUT} value={form.dateDebut} onChange={set('dateDebut')} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-700 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5">
              Créer le projet
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
