import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group } from 'react-konva'
import { useAppStore } from '@/store/useAppStore'
import { getPlanImage } from '@/services/planImageStorage'
import { STATUT_PORTE, ACCESS_DOOR_TYPE_LABELS } from '@/types'
import type { PlanAccessDoor, AccessDoorType } from '@/types'
import DoorPanel from '@/components/panels/DoorPanel'
import { DoorOpen, ZoomIn, ZoomOut, Plus, Download, List } from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

// ── Tailles de marqueurs ──────────────────────────────────────────────────────
const BASE_SIZES: Record<string, number> = { small: 18, medium: 28, large: 42 }

const DOOR_TYPE_COLORS: Record<AccessDoorType, string> = {
  acces:         '#1d4ed8',
  architectural: '#0f766e',
  plaque:        '#b45309',
}

// ── Marqueur de porte ─────────────────────────────────────────────────────────
function DoorMarker({ door, isSelected, onClick, onDragEnd, scale }: {
  door: PlanAccessDoor
  isSelected: boolean
  onClick: () => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  scale: number
}) {
  const base  = BASE_SIZES[door.doorSize ?? 'medium']
  const SIZE  = base / scale
  const HALF  = SIZE / 2
  const FSZ   = SIZE * 0.35
  const DIM_FSZ = SIZE * 0.29
  const DIM_PAD = SIZE * 0.17
  const labelW  = SIZE * 3.2
  const labelH  = DIM_FSZ + DIM_PAD * 2
  const fill    = DOOR_TYPE_COLORS[door.type] ?? '#6b7280'

  const stopDrag    = (e: any) => { e.target.getStage()?.draggable(false); e.cancelBubble = true }
  const restoreDrag = (e: any) => { e.target.getStage()?.draggable(true) }

  return (
    <Group
      x={door.x} y={door.y}
      draggable
      onDragStart={stopDrag}
      onDragEnd={(e: any) => {
        restoreDrag(e)
        onDragEnd(door.id, { x: e.target.x(), y: e.target.y() })
        e.cancelBubble = true
      }}
      onClick={(e: any) => { onClick(); e.cancelBubble = true }}
      onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
    >
      {/* Halo sélection */}
      {isSelected && (
        <Circle radius={HALF + 5 / scale} fill="rgba(59,130,246,0.18)"
          stroke="#3b82f6" strokeWidth={2 / scale} listening={false} />
      )}

      {/* Corps du cercle */}
      <Circle radius={HALF} fill={fill} stroke="#fff" strokeWidth={2 / scale}
        shadowBlur={5 / scale} shadowColor="rgba(0,0,0,0.35)"
        shadowOffset={{ x: 0, y: 1.5 / scale }} listening={false} />

      {/* Cercle intérieur pointillé = porte existante */}
      {(door.statut ?? 'existante') === 'existante' && (
        <Circle radius={HALF * 0.65} stroke="#fff" strokeWidth={1.2 / scale}
          dash={[4 / scale, 3 / scale]} listening={false} />
      )}

      {/* Numéro */}
      <Text x={-HALF} y={-FSZ * 0.62} width={SIZE}
        text={door.numero} fontSize={FSZ} fontStyle="bold" fill="white"
        align="center" listening={false} />

      {/* Étiquette dimensions */}
      {door.dimensions && (
        <>
          <Rect x={-labelW / 2} y={HALF + 3 / scale}
            width={labelW} height={labelH}
            fill="white" stroke={fill} strokeWidth={0.8 / scale}
            cornerRadius={2 / scale} shadowBlur={2 / scale}
            shadowColor="rgba(0,0,0,0.18)" listening={false} />
          <Text x={-labelW / 2} y={HALF + 3 / scale}
            width={labelW} height={labelH}
            text={door.dimensions} fontSize={DIM_FSZ} fontStyle="bold" fill={fill}
            align="center" verticalAlign="middle" listening={false} />
        </>
      )}

      {/* Zone de clic invisible */}
      <Circle radius={HALF} fill="transparent" />
    </Group>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────────
export default function AccessDoorsView({ onShowList }: { onShowList: () => void }) {
  const currentProjectId  = useAppStore((s) => s.currentProjectId)
  const plans             = useAppStore((s) => s.plans.filter((p) => p.projectId === currentProjectId))
  const addAccessDoor     = useAppStore((s) => s.addAccessDoor)
  const updateAccessDoor  = useAppStore((s) => s.updateAccessDoor)
  const removeAccessDoor  = useAppStore((s) => s.removeAccessDoor)

  const [currentPlanId,  setCurrentPlanId]  = useState<string | null>(null)
  const [planImageUrl,   setPlanImageUrl]   = useState('')
  const [planImage,      setPlanImage]      = useState<HTMLImageElement>()
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null)
  const [addMode,        setAddMode]        = useState(false)
  const [scale,          setScale]          = useState(1)
  const [position,       setPosition]       = useState({ x: 0, y: 0 })

  const stageRef     = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Premier plan au montage
  useEffect(() => {
    if (!currentPlanId && plans.length > 0) setCurrentPlanId(plans[0].id)
  }, [plans])

  // Charger l'image depuis IndexedDB
  useEffect(() => {
    if (!currentPlanId) { setPlanImageUrl(''); return }
    const plan = plans.find((p) => p.id === currentPlanId)
    if (plan?.url) { setPlanImageUrl(plan.url); return }
    getPlanImage(currentPlanId).then((url) => setPlanImageUrl(url ?? ''))
  }, [currentPlanId, plans])

  useEffect(() => {
    if (!planImageUrl) { setPlanImage(undefined); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setPlanImage(img)
    img.src = planImageUrl
  }, [planImageUrl])

  // Centrage automatique quand le plan change
  useEffect(() => {
    if (!planImage || !containerRef.current) return
    const cW = containerRef.current.clientWidth
    const cH = containerRef.current.clientHeight
    const s  = Math.min(cW / planImage.width, cH / planImage.height, 1)
    setScale(s)
    setPosition({ x: (cW - planImage.width * s) / 2, y: (cH - planImage.height * s) / 2 })
  }, [planImage, currentPlanId])

  // Suppression au clavier
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (selectedDoorId && currentPlanId) {
        removeAccessDoor(currentPlanId, selectedDoorId)
        setSelectedDoorId(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selectedDoorId, currentPlanId, removeAccessDoor])

  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null
  const planDoors   = currentPlan?.accessDoors ?? []

  // Zoom à la molette
  const handleWheel = (e: any) => {
    e.evt.preventDefault()
    const stage  = stageRef.current
    const ptr    = stage.getPointerPosition()
    const factor = e.evt.deltaY < 0 ? 1.12 : 1 / 1.12
    const ns     = Math.min(Math.max(scale * factor, 0.05), 5)
    const mp     = { x: (ptr.x - position.x) / scale, y: (ptr.y - position.y) / scale }
    setScale(ns)
    setPosition({ x: ptr.x - mp.x * ns, y: ptr.y - mp.y * ns })
  }

  // Appliquer une taille globale à tous les marqueurs du plan
  const applyGlobalSize = (sz: 'small' | 'medium' | 'large') => {
    if (!currentPlanId) return
    for (const door of planDoors) updateAccessDoor(currentPlanId, door.id, { doorSize: sz } as any)
  }

  // Export PDF du plan avec les marqueurs
  const handleDownload = () => {
    if (!stageRef.current || !planImage || !currentPlan) return
    const stage = stageRef.current
    // Sauvegarder l'état courant
    const prevSX = stage.scaleX(), prevSY = stage.scaleY()
    const prevX  = stage.x(),      prevY  = stage.y()
    // Capturer à l'échelle 1:1
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
    const dataUrl = stage.toDataURL({
      mimeType: 'image/jpeg', quality: 0.9, pixelRatio: 1.5,
      x: 0, y: 0, width: planImage.width, height: planImage.height,
    })
    // Restaurer
    stage.scale({ x: prevSX, y: prevSY })
    stage.position({ x: prevX, y: prevY })

    const isLandscape = planImage.width > planImage.height
    const pdf  = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
    const PW   = pdf.internal.pageSize.getWidth()
    const PH   = pdf.internal.pageSize.getHeight()
    const MARGIN = 10
    const ratio  = Math.min((PW - MARGIN * 2) / planImage.width, (PH - 20 - MARGIN) / planImage.height)
    const imgW   = planImage.width  * ratio
    const imgH   = planImage.height * ratio
    const mx     = (PW - imgW) / 2

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(`Portes d'accès — ${currentPlan.name}`, PW / 2, 8, { align: 'center' })
    pdf.addImage(dataUrl, 'JPEG', mx, 14, imgW, imgH)

    // Légende en bas
    const ly = 14 + imgH + 5
    if (ly < PH - 6) {
      const types: [string, string][] = [
        ['#1d4ed8', "P.A. Porte d'accès"],
        ['#0f766e', 'P.Ar. Porte arch.'],
        ['#b45309', 'PL Plaque'],
      ]
      pdf.setFontSize(7)
      types.forEach(([col, lbl], i) => {
        const lx = mx + i * 40
        pdf.setFillColor(col)
        pdf.circle(lx + 2, ly + 2, 2, 'F')
        pdf.setTextColor('#374151')
        pdf.text(lbl, lx + 5, ly + 3.5)
      })
    }

    pdf.save(`portes-acces_${currentPlan.name.replace(/\s+/g, '-')}.pdf`)
    toast.success('PDF téléchargé')
  }

  return (
    <div className="flex flex-1 overflow-hidden min-w-0 bg-gray-100 dark:bg-gray-900">

      {/* ── Panneau gauche ───────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

        {/* Titre */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-blue-500" /> Portes d'accès
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {planDoors.length} marqueur{planDoors.length !== 1 ? 's' : ''} sur ce plan
          </p>
        </div>

        {/* Actions */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 space-y-1.5">
          <button
            onClick={() => { setAddMode((m) => !m); setSelectedDoorId(null) }}
            disabled={!currentPlanId}
            className={`w-full text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 ${
              addMode
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Plus className="w-3 h-3" />
            {addMode ? 'Cliquer sur le plan…' : 'Ajouter une porte'}
          </button>

          <button
            onClick={handleDownload}
            disabled={!currentPlan || planDoors.length === 0}
            className="w-full text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3 h-3" /> Télécharger PDF
          </button>

          <button
            onClick={onShowList}
            className="w-full text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <List className="w-3 h-3" /> Voir la liste complète
          </button>
        </div>

        {/* Taille globale */}
        {planDoors.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Taille des marqueurs
            </p>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map((sz, i) => (
                <button key={sz} onClick={() => applyGlobalSize(sz)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 transition-all">
                  {['S', 'M', 'L'][i]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Liste des plans */}
        <div className="flex-1 overflow-y-auto">
          {plans.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">Aucun plan importé</p>
          )}
          {plans.map((plan) => {
            const doorCount = plan.accessDoors?.length ?? 0
            return (
              <button key={plan.id}
                onClick={() => { setCurrentPlanId(plan.id); setSelectedDoorId(null); setAddMode(false) }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                  plan.id === currentPlanId
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{plan.name}</p>
                {doorCount > 0
                  ? <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">{doorCount} porte{doorCount > 1 ? 's' : ''}</p>
                  : <p className="text-[10px] text-gray-400 mt-0.5">Aucune porte</p>
                }
              </button>
            )
          })}
        </div>

        {/* Zoom */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button onClick={() => setScale((s) => Math.min(s * 1.2, 5))}
            title="Zoom avant"
            className="flex-1 p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
            <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button onClick={() => setScale((s) => Math.max(s / 1.2, 0.05))}
            title="Zoom arrière"
            className="flex-1 p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
            <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* ── Zone canvas ──────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-200 dark:bg-gray-700"
        style={{ cursor: addMode ? 'crosshair' : 'grab' }}
      >
        {!currentPlan ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">Sélectionnez un plan</p>
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={containerRef.current?.clientWidth ?? window.innerWidth}
            height={containerRef.current?.clientHeight ?? window.innerHeight}
            x={position.x} y={position.y}
            scaleX={scale} scaleY={scale}
            draggable={!addMode}
            onDragEnd={(e: any) => setPosition({ x: e.target.x(), y: e.target.y() })}
            onWheel={handleWheel}
            onClick={(e: any) => {
              if (addMode && currentPlanId) {
                const pos = stageRef.current.getPointerPosition()
                const x   = (pos.x - position.x) / scale
                const y   = (pos.y - position.y) / scale
                const newId = addAccessDoor(currentPlanId, x, y)
                if (newId) setSelectedDoorId(newId)
                setAddMode(false)
                toast.success("Porte ajoutée — configurez-la dans le panneau")
                e.cancelBubble = true
                return
              }
              setSelectedDoorId(null)
            }}
          >
            <Layer>
              {planImage && <KonvaImage image={planImage} />}
              {planDoors.map((door) => (
                <DoorMarker
                  key={door.id}
                  door={door}
                  isSelected={selectedDoorId === door.id}
                  onClick={() => setSelectedDoorId(door.id)}
                  onDragEnd={(id, pos) => updateAccessDoor(currentPlanId!, id, pos)}
                  scale={scale}
                />
              ))}
            </Layer>
          </Stage>
        )}

        {/* Message plan vide */}
        {currentPlan && planDoors.length === 0 && !addMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <DoorOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucune porte sur ce plan</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cliquez "Ajouter une porte"</p>
            </div>
          </div>
        )}

        {/* Légende */}
        {currentPlan && (
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-3 shadow text-xs space-y-1.5 pointer-events-none" style={{ zIndex: 10 }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Types</p>
            {([
              ['#1d4ed8', "P.A. — Porte d'accès conduit"],
              ['#0f766e', 'P.Ar. — Porte architecturale'],
              ['#b45309', 'PL — Plaque'],
            ] as [string, string][]).map(([col, lbl]) => (
              <div key={col} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col }} />
                <span className="text-gray-600 dark:text-gray-300">{lbl}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-600 pt-1.5 mt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Statuts</p>
              {Object.entries(STATUT_PORTE).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white dark:border-gray-700" style={{ backgroundColor: v.color }} />
                  <span className="text-gray-600 dark:text-gray-300">{v.label}</span>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 mt-1">⊙ = Existante (pointillé)</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Panneau droit : édition porte sélectionnée ───────────────── */}
      {selectedDoorId && currentPlanId && (
        <DoorPanel
          doorId={selectedDoorId}
          planId={currentPlanId}
          onClose={() => setSelectedDoorId(null)}
        />
      )}
    </div>
  )
}
