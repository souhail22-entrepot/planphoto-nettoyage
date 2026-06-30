import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from '@/store/useAppStore'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'
import MainContent from '@/components/layout/MainContent'
import Dashboard from '@/components/views/Dashboard'
import TravauxView from '@/components/views/TravauxView'
import PhotosView from '@/components/views/PhotosView'
import ReportView from '@/components/views/ReportView'
import WelcomeScreen from '@/components/views/WelcomeScreen'
import SystemesView from '@/components/views/SystemesView'
import PortesView from '@/components/views/PortesView'
import AccessDoorsView from '@/components/views/AccessDoorsView'
import InterventionReportView from '@/components/views/InterventionReportView'
import PhotoMatchingView from '@/components/views/PhotoMatchingView'
import TemplateLibraryView from '@/components/views/TemplateLibraryView'
import MesuresDebitView from '@/components/views/MesuresDebitView'

type View = 'plan' | 'dashboard' | 'systemes' | 'travaux' | 'portes' | 'photos' | 'report' | 'intervention' | 'matching' | 'templates' | 'debit'

declare global {
  interface Window {
    setAppView: (v: View) => void
    __currentTool: string
    __captureCurrentPlan: () => { planId: string; dataUrl: string } | null
    __cleanupTravaux: () => void
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [portesMode, setPortesMode]   = useState<'canvas' | 'list'>('canvas')
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const darkMode         = useAppStore((s) => s.darkMode)
  const restorePlanImages         = useAppStore((s) => s.restorePlanImages)
  const restoreTravailPhotos      = useAppStore((s) => s.restoreTravailPhotos)
  const restoreInterventionPhotos = useAppStore((s) => s.restoreInterventionPhotos)

  // Expose window.setAppView pour les sous-composants
  useEffect(() => { window.setAppView = setCurrentView }, [])

  // Outil de nettoyage des travaux orphelins (accessible depuis la console)
  useEffect(() => {
    window.__cleanupTravaux = () => {
      const { travaux, plans, projects } = useAppStore.getState()
      const planIdSet = new Set(plans.map((p) => p.id))
      const projectIdSet = new Set(projects.map((p) => p.id))
      const avant = travaux.length
      const cleaned = travaux.filter((t) => {
        if (t.planId) return planIdSet.has(t.planId)           // avec plan → doit exister
        return !!t.projectId && projectIdSet.has(t.projectId)  // sans plan → projectId valide
      })
      useAppStore.setState({ travaux: cleaned })
      console.log(`✅ Nettoyage terminé : ${avant - cleaned.length} travaux orphelins supprimés. Reste : ${cleaned.length}`)
    }
  }, [])

  // Mode sombre
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else          document.documentElement.classList.remove('dark')
  }, [darkMode])

  // Restaurer images depuis IndexedDB à l'ouverture
  useEffect(() => {
    restorePlanImages().catch((e) => console.error('[App] restorePlanImages :', e))
  }, [])

  useEffect(() => {
    if (currentProjectId) {
      restoreTravailPhotos().catch((e) => console.error('[App] restoreTravailPhotos :', e))
      restoreInterventionPhotos().catch((e) => console.error('[App] restoreInterventionPhotos :', e))
    }
  }, [currentProjectId])

  if (!currentProjectId) {
    return (
      <>
        <WelcomeScreen onProjectCreated={() => setCurrentView('dashboard')} />
        <Toaster position="bottom-right" />
      </>
    )
  }

  const showMain = currentView === 'plan'

  return (
    <div className={`h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 ${darkMode ? 'dark' : ''}`}>
      <TopBar currentView={currentView} setCurrentView={setCurrentView} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />

        <main className="flex-1 overflow-hidden flex flex-col">

          {/* MainContent toujours monté (Konva stage doit rester dans le DOM) */}
          <div style={{ display: showMain ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <MainContent />
          </div>

          {currentView === 'dashboard' && (
            <div className="flex-1 overflow-y-auto">
              <Dashboard onNavigate={setCurrentView} />
            </div>
          )}
          {currentView === 'systemes' && (
            <div className="flex-1 overflow-y-auto">
              <SystemesView />
            </div>
          )}
          {currentView === 'travaux' && (
            <div className="flex-1 overflow-y-auto">
              <TravauxView onNavigatePlan={() => setCurrentView('plan')} />
            </div>
          )}
          {currentView === 'portes' && portesMode === 'canvas' && (
            <AccessDoorsView onShowList={() => setPortesMode('list')} />
          )}
          {currentView === 'portes' && portesMode === 'list' && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 px-6 pt-5">
                <button
                  onClick={() => setPortesMode('canvas')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-medium transition-colors"
                >
                  ← Vue plan
                </button>
              </div>
              <PortesView />
            </div>
          )}
          {currentView === 'photos' && (
            <div className="flex-1 overflow-y-auto">
              <PhotosView />
            </div>
          )}
          {currentView === 'report' && (
            <div className="flex-1 overflow-y-auto">
              <ReportView />
            </div>
          )}
          {currentView === 'intervention' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <InterventionReportView />
            </div>
          )}
          {currentView === 'matching' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <PhotoMatchingView />
            </div>
          )}
          {currentView === 'templates' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <TemplateLibraryView />
            </div>
          )}
          {currentView === 'debit' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <MesuresDebitView />
            </div>
          )}
        </main>
      </div>

      <Toaster position="bottom-right" />
    </div>
  )
}
