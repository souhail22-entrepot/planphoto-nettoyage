import { Plus, Upload, FileText } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import toast from 'react-hot-toast'
import type { InspectionExport } from '@/types'

interface Props { onProjectCreated: () => void }
type Mode = 'home' | 'new'

const FIELD = 'w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-colors'
const LABEL = 'block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide'

// ── Logo SVG inline ──────────────────────────────────────────────────────────

function AppLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgBg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0c2d6b" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="lgShine" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.14)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="lgArrow" x1="0" y1="0" x2="60" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="80" height="80" rx="18" fill="url(#lgBg)" />
      {/* Shine top */}
      <rect width="80" height="40" rx="18" fill="url(#lgShine)" />
      {/* Subtle border */}
      <rect x="0.75" y="0.75" width="78.5" height="78.5" rx="17.25" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* === Conduit principal (rectangle horizontal) === */}
      <rect x="9" y="26" width="62" height="28" rx="5"
        fill="rgba(14,116,169,0.18)" stroke="rgba(147,210,253,0.7)" strokeWidth="1.8" />

      {/* Extrémité gauche (embout) */}
      <rect x="7" y="29" width="4" height="22" rx="2" fill="rgba(147,210,253,0.4)" />
      {/* Extrémité droite (embout) */}
      <rect x="69" y="29" width="4" height="22" rx="2" fill="rgba(147,210,253,0.4)" />

      {/* === Flèches de flux d'air === */}
      <g filter="url(#glow)">
        {/* Flèche 1 */}
        <line x1="18" y1="40" x2="29" y2="40" stroke="url(#lgArrow)" strokeWidth="1.8" strokeLinecap="round" />
        <polyline points="25.5,36.5 30,40 25.5,43.5" fill="none" stroke="#7dd3fc" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Flèche 2 */}
        <line x1="33" y1="40" x2="44" y2="40" stroke="url(#lgArrow)" strokeWidth="1.8" strokeLinecap="round" />
        <polyline points="40.5,36.5 45,40 40.5,43.5" fill="none" stroke="#7dd3fc" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Flèche 3 */}
        <line x1="48" y1="40" x2="59" y2="40" stroke="url(#lgArrow)" strokeWidth="1.8" strokeLinecap="round" />
        <polyline points="55.5,36.5 60,40 55.5,43.5" fill="none" stroke="#7dd3fc" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* === Badge "propre" top-right === */}
      <circle cx="64" cy="18" r="10" fill="#0ea5e9" />
      <circle cx="64" cy="18" r="10" fill="rgba(255,255,255,0.15)" />
      {/* Étoile 4 branches */}
      <path d="M64 12.5 L65.4 16.6 L69.5 18 L65.4 19.4 L64 23.5 L62.6 19.4 L58.5 18 L62.6 16.6 Z"
        fill="white" />
    </svg>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function WelcomeScreen({ onProjectCreated }: Props) {
  const createProject         = useAppStore((s) => s.createProject)
  const setCurrentProject     = useAppStore((s) => s.setCurrentProject)
  const importFromInspection  = useAppStore((s) => s.importFromInspection)
  const importProjectJSON     = useAppStore((s) => s.importProjectJSON)

  const [mode, setMode] = useState<Mode>('home')
  const [form, setForm] = useState({
    name: '', client: '', adresse: '', ville: '', codePostal: '',
    technicien: '', technicienTitre: '', verificateur: '', dateDebut: '',
    contact: '', telephone: '', contrat: '',
  })

  const inspImportRef = useRef<HTMLInputElement>(null)
  const projImportRef = useRef<HTMLInputElement>(null)

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const id = createProject({ ...form, description: '' })
    setCurrentProject(id)
    onProjectCreated()
  }

  function handleInspectionImport(files: FileList | null) {
    const file = files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as InspectionExport
        if (!data?.project && !data?.plans) { toast.error('Fichier non reconnu'); return }
        const id = importFromInspection(data)
        setCurrentProject(id)
        toast.success('Projet d\'inspection importé')
        onProjectCreated()
      } catch { toast.error('Erreur de lecture du fichier JSON') }
    }
    reader.readAsText(file)
  }

  function handleProjectImport(files: FileList | null) {
    const file = files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data?.project) { toast.error('Fichier projet invalide'); return }
        importProjectJSON(data)
        toast.success('Projet importé')
        onProjectCreated()
      } catch { toast.error('Erreur de lecture du fichier') }
    }
    reader.readAsText(file)
  }

  // ── Formulaire nouveau projet ──────────────────────────────────────────────

  if (mode === 'new') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/60 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.03) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative w-full max-w-lg">
          {/* Card */}
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header strip */}
            <div className="bg-gradient-to-r from-blue-900/60 to-sky-900/40 border-b border-slate-700/60 px-8 py-5 flex items-center gap-4">
              <AppLogo size={42} />
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Nouveau projet de nettoyage</h2>
                <p className="text-xs text-slate-400">Conduits CVAC — NADCA</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="px-8 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={LABEL}>Nom du projet *</label>
                  <input required className={FIELD} value={form.name} onChange={set('name')}
                    placeholder="ex. Cuisine centrale — Tour A" />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Client *</label>
                  <input required className={FIELD} value={form.client} onChange={set('client')} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Adresse</label>
                  <input className={FIELD} value={form.adresse} onChange={set('adresse')} />
                </div>
                <div>
                  <label className={LABEL}>Ville</label>
                  <input className={FIELD} value={form.ville} onChange={set('ville')} />
                </div>
                <div>
                  <label className={LABEL}>Code postal</label>
                  <input className={FIELD} value={form.codePostal} onChange={set('codePostal')} />
                </div>
                <div>
                  <label className={LABEL}>Technicien</label>
                  <input className={FIELD} value={form.technicien} onChange={set('technicien')} />
                </div>
                <div>
                  <label className={LABEL}>N° contrat</label>
                  <input className={FIELD} value={form.contrat} onChange={set('contrat')} />
                </div>
                <div>
                  <label className={LABEL}>Date de début</label>
                  <input type="date" className={FIELD} value={form.dateDebut} onChange={set('dateDebut')} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMode('home')}
                  className="flex-1 px-4 py-2.5 border border-slate-700 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
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
      </div>
    )
  }

  // ── Écran d'accueil / Lanceur ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Inputs cachés */}
      <input ref={inspImportRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { handleInspectionImport(e.target.files); e.target.value = '' }} />
      <input ref={projImportRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { handleProjectImport(e.target.files); e.target.value = '' }} />

      {/* Background : gradient + grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-sky-500/8 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-blue-800/10 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.04) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Barre supérieure */}
      <header className="relative z-10 flex items-center justify-between px-10 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <AppLogo size={32} />
          <span className="text-sm font-semibold text-slate-400 tracking-wide">PlanPhoto Nettoyage</span>
        </div>
        <span className="text-xs text-slate-600 font-mono">v1.0</span>
      </header>

      {/* Contenu central */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">

          {/* Logo principal */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <AppLogo size={96} />
              <div className="absolute inset-0 -z-10 blur-2xl scale-150 bg-sky-500/20 rounded-full" />
            </div>
          </div>

          {/* Nom de l'application */}
          <h1 className="text-5xl font-black tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <span className="text-white">Plan</span><span className="text-sky-400">Photo</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
            <span className="text-[11px] font-bold tracking-[0.25em] text-slate-500 uppercase">Nettoyage</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
          </div>
          <p className="text-slate-500 text-sm mb-10 leading-relaxed">
            Gestion professionnelle des travaux<br />de nettoyage de conduits CVAC
          </p>

          {/* Boutons d'action */}
          <div className="flex flex-col gap-3">
            <button onClick={() => setMode('new')}
              className="group flex items-center justify-center gap-3 px-6 py-4 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-semibold text-sm shadow-xl shadow-sky-500/25 hover:shadow-sky-400/35 transition-all hover:-translate-y-0.5 active:translate-y-0">
              <Plus className="w-5 h-5" />
              Nouveau projet de nettoyage
            </button>

            <button onClick={() => inspImportRef.current?.click()}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-sky-600/50 text-slate-200 rounded-xl font-semibold text-sm backdrop-blur transition-all hover:-translate-y-0.5">
              <Upload className="w-4.5 h-4.5 text-sky-400" />
              Importer depuis une inspection
            </button>

            <button onClick={() => projImportRef.current?.click()}
              className="flex items-center justify-center gap-3 px-6 py-4 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 text-slate-500 hover:text-slate-300 rounded-xl text-sm transition-all">
              <FileText className="w-4 h-4" />
              Ouvrir un projet (.json)
            </button>
          </div>

          <p className="text-xs text-slate-700 mt-8">
            Les projets existants sont accessibles via la barre latérale
          </p>
        </div>
      </div>

      {/* Pied de page */}
      <footer className="relative z-10 px-10 py-4 border-t border-slate-800/50 flex items-center justify-between">
        <p className="text-xs text-slate-700">© 2024 SDC inc · Tous droits réservés</p>
        <p className="text-xs text-slate-700">NADCA · CVAC Nettoyage Professionnel</p>
      </footer>
    </div>
  )
}
