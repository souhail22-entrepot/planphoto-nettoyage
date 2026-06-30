import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Stage, Layer, Image as KonvaImage, Circle, Text, Line, Rect, Arrow, Group, Transformer,
} from 'react-konva'
import { useAppStore } from '@/store/useAppStore'
import { ZoomIn, ZoomOut, Maximize2, Upload, LayoutGrid } from 'lucide-react'
import { COMPOSANTES_CVAC, STATUT_PORTE, ACCESS_DOOR_TYPE_LABELS, composanteColor } from '@/types'
import type { PlanAccessDoor, Annotation, ZoneConduit } from '@/types'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'
import { nanoid } from 'nanoid'
import { savePlanImage, getPlanImage } from '@/services/planImageStorage'
import { fileToDataUrl, bakeImageOrientation } from '@/utils/imageUtils'
import { isPdf } from '@/utils/files'
import TravailPanel from '@/components/panels/TravailPanel'
import DoorPanel from '@/components/panels/DoorPanel'
import ZonePanel from '@/components/panels/ZonePanel'
import PropertiesPanel from '@/components/panels/PropertiesPanel'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// ── Image du plan avec rotation ──────────────────────────────────────────────

function usePlanImage(url: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement>()
  useEffect(() => {
    if (!url) return
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => setImg(el)
    el.src = url
  }, [url])
  return img
}

function PlanImage({ src, rotation = 0, onClick }: { src: string; rotation?: number; onClick?: () => void }) {
  const img = usePlanImage(src)
  if (!img) return null
  const r = rotation as 0 | 90 | 180 | 270
  if (r === 90)  return <KonvaImage image={img} x={img.height} y={0} rotation={90} onClick={onClick} />
  if (r === 180) return <KonvaImage image={img} x={img.width} y={img.height} rotation={180} onClick={onClick} />
  if (r === 270) return <KonvaImage image={img} x={0} y={img.width} rotation={270} onClick={onClick} />
  return <KonvaImage image={img} onClick={onClick} />
}

// ── Marqueur de travail de nettoyage ─────────────────────────────────────────

const PIN_BASE_SIZES: Record<string, number> = { xsmall: 14, small: 26, medium: 46, large: 80 }

function TravailMarker({ travail, systemeName, linkedDoors, allTravaux, isSelected, onClick, scale, currentTool, onDragEnd, onArrowEndDragEnd, onExitSideChange }: {
  travail: any
  systemeName: string
  linkedDoors: PlanAccessDoor[]
  allTravaux: { id: string; x: number; y: number }[]
  isSelected: boolean
  onClick: () => void
  scale: number
  currentTool: string
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onArrowEndDragEnd: (id: string, pos: { arrowEndX: number; arrowEndY: number }) => void
  onExitSideChange: (id: string, side: string | undefined) => void
}) {
  // ── Dimensions : taille fixe quand zoomé (scale≥1), rétrécit quand dézoomé ──
  const baseSize = PIN_BASE_SIZES[travail.pinSize || 'medium']
  const u = baseSize / Math.max(0.5, scale) // taille fixe à l'écran pour zoom ≥50 %, rétrécit en-dessous

  const CARD_W    = u * 3.8
  const HDR_H     = u * 1.6
  const PH_LINE_H = u * 0.46
  const PH_PAD    = u * 0.18

  const avantRefs = ((travail.photosAvant ?? []) as any[]).map((p) => p.ref).filter(Boolean).join(' - ')
  const apresRefs = ((travail.photosApres ?? []) as any[]).map((p) => p.ref).filter(Boolean).join(' - ')
  const hasAvant   = avantRefs !== ''
  const hasApres   = apresRefs !== ''
  const photoLines = (hasAvant ? 1 : 0) + (hasApres ? 1 : 0)
  const showPhotoRow = photoLines > 0
  const PH_H = photoLines * PH_LINE_H + PH_PAD * 2

  const CARD_H = HDR_H + (showPhotoRow ? PH_H : 0)

  // Couleur par type de porte (étiquettes PA)
  const DOOR_TYPE_COLORS: Record<string, string> = {
    acces:         '#1d4ed8',
    architectural: '#0f766e',
    plaque:        '#b45309',
  }
  const CX = -CARD_W / 2

  const FONT_NUM  = u * 0.58
  const FONT_INFO = u * 0.30
  const FONT_LBL  = u * 0.28

  // ── Couleurs ──────────────────────────────────────────────────────────────
  const fillColor: string   = composanteColor(travail.typeComposante)
  const hasAnomalie = (travail.anomalies?.length ?? 0) > 0

  // ── Labels texte ──────────────────────────────────────────────────────────
  const compLabel = travail.typeComposante ? (COMPOSANTES_CVAC as any)[travail.typeComposante]?.label ?? '' : ''

  // ── Ancre ─────────────────────────────────────────────────────────────────
  const anchorX = travail.arrowEndX ?? (travail.x + u * 2.5)
  const anchorY = travail.arrowEndY ?? (travail.y + u * 3)

  // ── Zone numéro (gauche) et info (droite) dans l'en-tête ─────────────────
  const NUM_W  = u * 0.85          // largeur de la colonne numéro
  const infoX  = CX + NUM_W + u * 0.15
  const infoW  = CARD_W - NUM_W - u * 0.35

  const stopStageDrag = (e: any) => {
    e.target.getStage()?.draggable(false)
    e.cancelBubble = true
  }
  const restoreStageDrag = (stage: any) => {
    if (stage) stage.draggable((window as any).__currentTool === 'pan')
  }

  return (
    <>
      {/* Ligne de renvoi — sortie fixe (arrowExitSide) ou auto (bord le plus proche) */}
      {(() => {
        const cardLeft   = travail.x - CARD_W / 2
        const cardRight  = travail.x + CARD_W / 2
        const cardTop    = travail.y - CARD_H
        const cardBottom = travail.y
        const cardMidX   = travail.x
        const cardMidY   = travail.y - CARD_H / 2

        const side = travail.arrowExitSide as string | undefined
        let ox: number, oy: number

        if (side === 'left')   { ox = cardLeft;   oy = cardMidY }
        else if (side === 'right')  { ox = cardRight;  oy = cardMidY }
        else if (side === 'top')    { ox = cardMidX;   oy = cardTop }
        else if (side === 'bottom') { ox = cardMidX;   oy = cardBottom }
        else {
          const dx = anchorX - cardMidX
          const dy = anchorY - cardMidY
          ox = cardMidX; oy = cardMidY
          if (Math.abs(dx) * CARD_H > Math.abs(dy) * CARD_W) {
            ox = dx > 0 ? cardRight : cardLeft
            oy = cardMidY + dy * ((ox - cardMidX) / dx)
            oy = Math.max(cardTop, Math.min(cardBottom, oy))
          } else {
            oy = dy > 0 ? cardBottom : cardTop
            ox = Math.abs(dy) > 0.001 ? cardMidX + dx * ((oy - cardMidY) / dy) : cardMidX
            ox = Math.max(cardLeft, Math.min(cardRight, ox))
          }
        }

        return (
          <Line
            points={[ox, oy, anchorX, anchorY]}
            stroke={fillColor} strokeWidth={1.2 / scale} opacity={0.8} listening={false}
          />
        )
      })()}

      {/* Handles de sortie de flèche — visibles quand sélectionné ────────────── */}
      {isSelected && (() => {
        const sides = [
          { id: 'left',   lx: travail.x - CARD_W / 2, ly: travail.y - CARD_H / 2 },
          { id: 'right',  lx: travail.x + CARD_W / 2, ly: travail.y - CARD_H / 2 },
          { id: 'top',    lx: travail.x,               ly: travail.y - CARD_H     },
          { id: 'bottom', lx: travail.x,               ly: travail.y              },
        ]
        const currentSide = travail.arrowExitSide as string | undefined
        return sides.map(({ id, lx, ly }) => {
          const isActive = currentSide === id
          return (
            <Circle
              key={id}
              x={lx} y={ly}
              radius={4.5 / scale}
              fill={isActive ? fillColor : 'white'}
              stroke={fillColor}
              strokeWidth={1.5 / scale}
              shadowBlur={isActive ? 4 / scale : 0}
              shadowColor="rgba(0,0,0,0.3)"
              onClick={(e: any) => {
                onExitSideChange(travail.id, isActive ? undefined : id)
                e.cancelBubble = true
              }}
              onTap={(e: any) => {
                onExitSideChange(travail.id, isActive ? undefined : id)
                e.cancelBubble = true
              }}
              onMouseEnter={(e: any) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer' }}
              onMouseLeave={(e: any) => { const s = e.target.getStage(); if (s) s.container().style.cursor = '' }}
            />
          )
        })
      })()}

      {/* Point d'ancrage */}
      {isSelected ? (
        <Circle
          x={anchorX} y={anchorY} radius={5 / scale}
          fill={fillColor} stroke="#fff" strokeWidth={1.5 / scale}
          draggable={currentTool === 'select'}
          onDragStart={stopStageDrag}
          onDragMove={(e: any) => { e.cancelBubble = true }}
          onDragEnd={(e: any) => {
            restoreStageDrag(e.target.getStage())
            onArrowEndDragEnd(travail.id, { arrowEndX: e.target.x(), arrowEndY: e.target.y() })
            e.cancelBubble = true
          }}
        />
      ) : (
        <Circle x={anchorX} y={anchorY} radius={3.5 / scale}
          fill={fillColor} opacity={0.75} listening={false} />
      )}

      {/* Carte principale — Group ancré au bas-centre */}
      <Group
        x={travail.x} y={travail.y}
        draggable={currentTool === 'select'}
        onDragStart={stopStageDrag}
        onDragEnd={(e: any) => {
          restoreStageDrag(e.target.getStage())
          onDragEnd(travail.id, { x: e.target.x(), y: e.target.y() })
          e.cancelBubble = true
        }}
        onClick={(e: any) => { onClick(); e.cancelBubble = true }}
        onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
      >
        {/* Halo de sélection */}
        {isSelected && (
          <Rect
            x={CX - 3/scale} y={-CARD_H - 3/scale}
            width={CARD_W + 6/scale} height={CARD_H + 3/scale}
            cornerRadius={5/scale}
            fill="rgba(59,130,246,0.10)" stroke="#3b82f6" strokeWidth={1.5/scale}
            listening={false}
          />
        )}

        {/* Fond de carte */}
        <Rect
          x={CX} y={-CARD_H}
          width={CARD_W} height={CARD_H}
          fill="white" stroke={fillColor} strokeWidth={1.2/scale}
          cornerRadius={3/scale}
          shadowBlur={isSelected ? 8/scale : 3.5/scale}
          shadowColor={isSelected ? 'rgba(59,130,246,0.45)' : 'rgba(0,0,0,0.22)'}
          shadowOffset={{ x: 0, y: 1.5/scale }}
          listening={false}
        />

        {/* ── Section en-tête ───────────────────────────────────────────── */}

        {/* Bande colorée gauche (couleur IRSST / statut) */}
        <Rect
          x={CX} y={-CARD_H}
          width={NUM_W} height={HDR_H}
          fill={fillColor}
          cornerRadius={[3/scale, 0, 0, 3/scale] as any}
          listening={false}
        />

        {/* Numéro centré dans la bande */}
        <Text
          x={CX} y={-CARD_H}
          width={NUM_W} height={HDR_H}
          text={String(travail.numero)}
          fontSize={FONT_NUM} fontStyle="bold"
          fill="#fff"
          align="center" verticalAlign="middle" listening={false}
        />

        {/* Nom du système */}
        <Text
          x={infoX} y={-CARD_H + u * 0.18}
          width={infoW} height={HDR_H / 2 - u * 0.08}
          text={systemeName}
          fontSize={FONT_INFO} fontStyle="bold" fill="#1e293b"
          align="left" verticalAlign="bottom" ellipsis={true} listening={false}
        />
        {/* Type de composante */}
        {compLabel !== '' && (
          <Text
            x={infoX} y={-CARD_H + HDR_H / 2 + u * 0.04}
            width={infoW} height={HDR_H / 2 - u * 0.15}
            text={compLabel}
            fontSize={FONT_INFO * 0.85} fill="#64748b"
            align="left" verticalAlign="top" ellipsis={true} listening={false}
          />
        )}


        {/* Indicateur anomalie (rouge, à gauche de la pastille statut) */}
        {hasAnomalie && (
          <Circle
            x={CX + CARD_W - u * 0.78} y={-CARD_H + u * 0.28}
            radius={u * 0.22}
            fill="#dc2626" stroke="white" strokeWidth={0.7/scale}
            listening={false}
          />
        )}

        {/* ── Section références photos ── */}
        {showPhotoRow && (
          <>
            <Line
              points={[CX, -PH_H, CX + CARD_W, -PH_H]}
              stroke="#e2e8f0" strokeWidth={0.6/scale} listening={false}
            />
            {hasAvant && (
              <Text
                x={CX + u * 0.22} y={-PH_H + PH_PAD}
                width={CARD_W - u * 0.44} height={PH_LINE_H}
                text={`Av : ${avantRefs}`}
                fontSize={FONT_LBL} fontStyle="bold" fill="#1d4ed8"
                align="left" verticalAlign="middle" ellipsis={true}
                listening={false}
              />
            )}
            {hasApres && (
              <Text
                x={CX + u * 0.22} y={-PH_H + PH_PAD + (hasAvant ? PH_LINE_H : 0)}
                width={CARD_W - u * 0.44} height={PH_LINE_H}
                text={`Ap : ${apresRefs}`}
                fontSize={FONT_LBL} fontStyle="bold" fill="#0f766e"
                align="left" verticalAlign="middle" ellipsis={true}
                listening={false}
              />
            )}
          </>
        )}

        {/* ── Étiquettes PA — horizontales, extérieur top-droit ── */}
        {linkedDoors.map((door, i) => {
          const tabColor  = DOOR_TYPE_COLORS[door.type] ?? '#6b7280'
          const TAB_H    = u * 0.50
          const TAB_W    = u * 2.4
          const TAB_BAND = u * 0.18
          const TAB_GAP  = u * 0.07

          const totalTabsH = linkedDoors.length * TAB_H + Math.max(0, linkedDoors.length - 1) * TAB_GAP

          // 'top'   : tabs à droite de la carte, alignés en haut (défaut)
          // 'above' : tabs au-dessus de la carte, si un voisin chevauche la zone des tabs
          const tabsMode: 'top' | 'above' = (() => {
            const tabL = travail.x + CARD_W / 2
            const tabR = tabL + TAB_W
            const tabT = travail.y - CARD_H + u * 0.12
            const tabB = tabT + totalTabsH
            return allTravaux.some((o) => {
              if (o.id === travail.id) return false
              const oL = o.x - CARD_W / 2, oR = o.x + CARD_W / 2
              const oT = o.y - CARD_H,     oB = o.y
              return tabL < oR && tabR > oL && tabT < oB && tabB > oT
            }) ? 'above' : 'top'
          })()

          // 'top' → droit de la carte | 'above' → au-dessus, aligné gauche
          const tx = tabsMode === 'top' ? CARD_W / 2 : -CARD_W / 2
          const tabBaseY = tabsMode === 'top'
            ? -CARD_H + u * 0.12
            : -CARD_H - u * 0.12 - totalTabsH
          const ty = tabBaseY + i * (TAB_H + TAB_GAP)
          const isExistante = door.statut === 'existante'
          const label = `${door.numero}${door.dimensions ? ' : ' + door.dimensions : ''}`
          const DOT_R = TAB_H * 0.20

          return (
            <Group key={door.id} listening={false}>
              {/* Ligne pointillée mode above */}
              {tabsMode === 'above' && i === 0 && (
                <Line
                  points={[tx, -CARD_H, tx, tabBaseY + totalTabsH]}
                  stroke={tabColor} strokeWidth={0.7 / scale}
                  dash={[3 / scale, 2 / scale]} listening={false}
                />
              )}
              <Rect
                x={tx} y={ty} width={TAB_W} height={TAB_H}
                fill="white" stroke={tabColor} strokeWidth={0.8 / scale}
                cornerRadius={[0, 2/scale, 2/scale, 0] as any}
                shadowBlur={2 / scale} shadowColor="rgba(0,0,0,0.15)"
                shadowOffset={{ x: 1/scale, y: 1/scale }}
              />
              <Rect x={tx} y={ty} width={TAB_BAND} height={TAB_H} fill={tabColor} />
              <Text
                x={tx + TAB_BAND + u * 0.07} y={ty}
                width={TAB_W - TAB_BAND - u * 0.1 - (isExistante ? DOT_R * 2.4 : 0)} height={TAB_H}
                text={label}
                fontSize={FONT_LBL * 0.88} fill="#1e293b"
                align="left" verticalAlign="middle" ellipsis={true} wrap="none"
              />
              {isExistante && (
                <Circle
                  x={tx + TAB_W - DOT_R - u * 0.07} y={ty + TAB_H / 2}
                  radius={DOT_R} fill="#10B981" listening={false}
                />
              )}
            </Group>
          )
        })}

        {/* Zone de clic invisible — hitbox du Group */}
        <Rect x={CX} y={-CARD_H} width={CARD_W} height={CARD_H} fill="transparent" />
      </Group>
    </>
  )
}

// ── Zone de conduit (polygone coloré semi-transparent) ───────────────────────

function ZoneShape({ zone, isSelected, onClick, onPointsDragEnd, scale, currentTool }: {
  zone: ZoneConduit
  isSelected: boolean
  onClick: () => void
  onPointsDragEnd: (id: string, points: number[]) => void
  scale: number
  currentTool: string
}) {
  const color = composanteColor(zone.typeComposante)

  const stopStageDrag    = (e: any) => { e.target.getStage()?.draggable(false); e.cancelBubble = true }
  const restoreStageDrag = (e: any) => { e.target.getStage()?.draggable((window as any).__currentTool === 'pan') }

  const vertices: [number, number][] = []
  for (let i = 0; i < zone.points.length - 1; i += 2) {
    vertices.push([zone.points[i], zone.points[i + 1]])
  }

  return (
    <>
      <Line
        points={zone.points}
        closed
        fill={color}
        opacity={zone.opacity}
        stroke={color}
        strokeWidth={2 / scale}
        onClick={(e: any) => { onClick(); e.cancelBubble = true }}
        onTap={(e: any) => { onClick(); e.cancelBubble = true }}
        shadowBlur={isSelected ? 8 : 0}
        shadowColor="rgba(59,130,246,0.4)"
        draggable={currentTool === 'select'}
        onDragStart={stopStageDrag}
        onDragEnd={(e: any) => {
          restoreStageDrag(e)
          const dx = e.target.x(), dy = e.target.y()
          const moved = zone.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
          onPointsDragEnd(zone.id, moved)
          e.target.x(0); e.target.y(0)
          e.cancelBubble = true
        }}
      />
      {/* Handles de vertex quand sélectionné */}
      {isSelected && vertices.map(([vx, vy], idx) => (
        <Circle
          key={idx}
          x={vx} y={vy}
          radius={7 / scale}
          fill="white" stroke={color} strokeWidth={2 / scale}
          shadowBlur={4 / scale} shadowColor="rgba(0,0,0,0.25)"
          draggable
          onDragStart={stopStageDrag}
          onDragEnd={(e: any) => {
            restoreStageDrag(e)
            const newPoints = [...zone.points]
            newPoints[idx * 2]     = e.target.x()
            newPoints[idx * 2 + 1] = e.target.y()
            onPointsDragEnd(zone.id, newPoints)
            e.cancelBubble = true
          }}
        />
      ))}
    </>
  )
}

// ── Marqueur de porte d'accès — cercle (identique à l'app inspection) ────────

const DOOR_TYPE_COLORS: Record<string, string> = {
  acces:         '#1d4ed8',
  architectural: '#0f766e',
  plaque:        '#b45309',
}

function AccessDoorMarker({ door, linkedTravaux, isSelected, onClick, onDragEnd, scale, currentTool }: {
  door: PlanAccessDoor
  linkedTravaux: { numero: number; color: string }[]
  isSelected: boolean
  onClick: () => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  scale: number
  currentTool: string
}) {
  const SIZE    = 28 / scale       // diamètre du cercle, fixe à l'écran
  const HALF    = SIZE / 2
  const FSZ     = SIZE * 0.33      // taille du numéro dans le cercle
  const DIM_FSZ = SIZE * 0.28      // taille du texte dimensions
  const DIM_PAD = SIZE * 0.18
  const labelW  = SIZE * 3.2       // largeur de l'étiquette dimensions
  const labelH  = DIM_FSZ + DIM_PAD * 2
  const labelY  = HALF + 3 / scale // position Y de l'étiquette (sous le cercle)

  const fill    = DOOR_TYPE_COLORS[door.type] ?? '#6b7280'
  const statut  = door.statut ?? 'existante'

  const stopStageDrag    = (e: any) => { e.target.getStage()?.draggable(false); e.cancelBubble = true }
  const restoreStageDrag = (e: any) => { e.target.getStage()?.draggable((window as any).__currentTool === 'pan') }

  return (
    <Group
      x={door.x} y={door.y}
      draggable={currentTool === 'select'}
      onDragStart={stopStageDrag}
      onDragEnd={(e: any) => {
        restoreStageDrag(e)
        onDragEnd(door.id, { x: e.target.x(), y: e.target.y() })
        e.cancelBubble = true
      }}
      onClick={(e: any) => { onClick(); e.cancelBubble = true }}
      onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
    >
      {/* Halo de sélection */}
      {isSelected && (
        <Circle
          radius={HALF + 4 / scale}
          fill="rgba(59,130,246,0.18)"
          stroke="#3b82f6" strokeWidth={1.5 / scale}
          listening={false}
        />
      )}

      {/* Cercle principal */}
      <Circle
        radius={HALF}
        fill={fill}
        stroke="#fff" strokeWidth={2 / scale}
        shadowBlur={4 / scale} shadowColor="rgba(0,0,0,0.35)"
        shadowOffset={{ x: 0, y: 1.5 / scale }}
        listening={false}
      />

      {/* Cercle intérieur pointillé = porte existante */}
      {statut === 'existante' && (
        <Circle
          radius={HALF * 0.65}
          stroke="#fff" strokeWidth={1.2 / scale}
          dash={[4 / scale, 3 / scale]}
          listening={false}
        />
      )}

      {/* Numéro centré */}
      <Text
        x={-HALF} y={-FSZ * 0.6}
        width={SIZE}
        text={door.numero}
        fontSize={FSZ} fontStyle="bold" fill="white"
        align="center" listening={false}
      />

      {/* Étiquette dimensions sous le cercle */}
      {door.dimensions && (
        <>
          <Rect
            x={-labelW / 2} y={labelY}
            width={labelW} height={labelH}
            fill="white" stroke={fill} strokeWidth={0.8 / scale}
            cornerRadius={2 / scale}
            shadowBlur={2 / scale} shadowColor="rgba(0,0,0,0.18)"
            listening={false}
          />
          <Text
            x={-labelW / 2} y={labelY}
            width={labelW} height={labelH}
            text={door.dimensions}
            fontSize={DIM_FSZ} fontStyle="bold" fill={fill}
            align="center" verticalAlign="middle"
            listening={false}
          />
        </>
      )}

      {/* Chips travaux liés — à gauche du cercle */}
      {linkedTravaux.map((t, i) => {
        const CHIP_H   = SIZE * 0.52
        const CHIP_W   = SIZE * 0.72
        const CHIP_GAP = SIZE * 0.1
        const totalH   = linkedTravaux.length * CHIP_H + (linkedTravaux.length - 1) * CHIP_GAP
        const cx = -HALF - CHIP_W - 3 / scale
        const cy = -totalH / 2 + i * (CHIP_H + CHIP_GAP)
        return (
          <Group key={i} listening={false}>
            <Rect
              x={cx} y={cy} width={CHIP_W} height={CHIP_H}
              fill={t.color}
              cornerRadius={[2 / scale, 0, 0, 2 / scale] as any}
              shadowBlur={2 / scale} shadowColor="rgba(0,0,0,0.2)"
            />
            <Text
              x={cx} y={cy}
              width={CHIP_W} height={CHIP_H}
              text={`T${t.numero}`}
              fontSize={SIZE * 0.27} fontStyle="bold" fill="white"
              align="center" verticalAlign="middle"
            />
          </Group>
        )
      })}

      {/* Zone de clic invisible */}
      <Circle radius={HALF} fill="transparent" />
    </Group>
  )
}

// ── Annotation ────────────────────────────────────────────────────────────────

function AnnotationShape({ annotation, isSelected, onClick, onDblClick, onDragEnd, onEndpointDragEnd, scale, currentTool }: {
  annotation: Annotation
  isSelected: boolean
  onClick: () => void
  onDblClick?: () => void
  onDragEnd: (id: string, data: any) => void
  onEndpointDragEnd: (id: string, data: any) => void
  scale: number
  currentTool: string
}) {
  const noteArrowRef  = useRef<any>(null)
  const [textHeight, setTextHeight] = useState(60)

  const stopStageDrag = (e: any) => {
    e.target.getStage()?.draggable(false)
    e.cancelBubble = true
  }
  const restoreStageDrag = (e: any) => {
    e.target.getStage()?.draggable((window as any).__currentTool === 'pan')
    e.cancelBubble = true
  }
  const handleDragStart = (e: any) => {
    e.target.getStage()?.draggable(false)
    e.cancelBubble = true
  }
  const handleDragEnd = (e: any) => {
    e.target.getStage()?.draggable((window as any).__currentTool === 'pan')
    onDragEnd(annotation.id, { x: e.target.x(), y: e.target.y() })
    e.cancelBubble = true
  }

  const color = (annotation as any).color as string
  const sw    = (annotation as any).strokeWidth as number

  const commonProps = {
    stroke: color,
    strokeWidth: sw,
    onClick: (e: any) => { onClick(); e.cancelBubble = true },
    onTap:   (e: any) => { onClick(); e.cancelBubble = true },
    shadowBlur: isSelected ? 10 : 0,
    shadowColor: 'rgba(59,130,246,0.5)',
    draggable: currentTool === 'select',
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  }

  switch (annotation.type) {
    case 'arrow': {
      const [ax1, ay1, ax2, ay2] = annotation.points
      return (
        <>
          <Arrow
            points={annotation.points}
            pointerLength={20} pointerWidth={20}
            fill={color} stroke={color} strokeWidth={sw}
            onClick={(e: any) => { onClick(); e.cancelBubble = true }}
            onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
            shadowBlur={isSelected ? 10 : 0} shadowColor="rgba(59,130,246,0.5)"
            draggable={currentTool === 'select'}
            onDragStart={stopStageDrag}
            onDragEnd={(e: any) => {
              e.target.getStage()?.draggable((window as any).__currentTool === 'pan')
              const dx = e.target.x(), dy = e.target.y()
              onDragEnd(annotation.id, { points: [ax1 + dx, ay1 + dy, ax2 + dx, ay2 + dy] })
              e.target.x(0); e.target.y(0)
              e.cancelBubble = true
            }}
          />
          {isSelected && (
            <>
              <Circle x={ax1} y={ay1} radius={6 / scale} fill="white" stroke="#3B82F6" strokeWidth={1.5 / scale}
                draggable onDragStart={stopStageDrag}
                onDragEnd={(e: any) => { restoreStageDrag(e); onEndpointDragEnd(annotation.id, { points: [e.target.x(), e.target.y(), ax2, ay2] }) }} />
              <Circle x={ax2} y={ay2} radius={6 / scale} fill="white" stroke="#3B82F6" strokeWidth={1.5 / scale}
                draggable onDragStart={stopStageDrag}
                onDragEnd={(e: any) => { restoreStageDrag(e); onEndpointDragEnd(annotation.id, { points: [ax1, ay1, e.target.x(), e.target.y()] }) }} />
            </>
          )}
        </>
      )
    }

    case 'rectangle':
      return (
        <Rect id={annotation.id}
          x={(annotation as any).x} y={(annotation as any).y}
          width={(annotation as any).width} height={(annotation as any).height}
          {...commonProps} />
      )

    case 'circle':
      return (
        <Circle id={annotation.id}
          x={(annotation as any).x} y={(annotation as any).y}
          radius={(annotation as any).radius}
          {...commonProps} />
      )

    case 'freehand':
      return (
        <Line points={(annotation as any).points}
          tension={0.5} lineCap="round" lineJoin="round"
          stroke={color} strokeWidth={sw}
          onClick={(e: any) => { onClick(); e.cancelBubble = true }}
          onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
          shadowBlur={isSelected ? 10 : 0} shadowColor="rgba(59,130,246,0.5)"
          draggable={false}
        />
      )

    case 'text': {
      const ann  = annotation as any
      const pad  = 8
      const txtW = ann.width ?? 300
      const fs   = `${ann.italic ? 'italic' : ''} ${ann.bold ? 'bold' : 'normal'}`.trim() || 'normal'
      return (
        <Group
          id={annotation.id}
          x={ann.x} y={ann.y}
          draggable={currentTool === 'select'}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}
          onClick={(e: any) => { onClick(); e.cancelBubble = true }}
          onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
          onDblClick={(e: any) => { if (currentTool === 'select') { onDblClick?.(); e.cancelBubble = true } }}
          shadowBlur={isSelected ? 10 : 0} shadowColor="rgba(59,130,246,0.5)"
        >
          <Rect x={-pad} y={-pad}
            width={txtW + pad * 2}
            height={(ann.height ?? (textHeight || ann.fontSize * 1.5)) + pad * 2}
            fill={ann.bgColor || 'rgba(255,255,255,0.92)'}
            stroke={isSelected ? '#3B82F6' : color}
            strokeWidth={(isSelected ? 2 : 1) / scale}
            cornerRadius={4}
            dash={isSelected ? [6 / scale, 3 / scale] : undefined}
          />
          <Text
            ref={(node: any) => {
              if (node) { const h = node.height(); if (h > 0 && Math.abs(h - textHeight) > 0.5) setTextHeight(h) }
            }}
            text={ann.text}
            fontSize={ann.fontSize}
            fontFamily={ann.fontFamily || 'Arial'}
            fontStyle={fs}
            textDecoration={ann.underline ? 'underline' : ''}
            align={ann.align || 'left'}
            fill={color}
            width={txtW}
            wrap="word"
            listening={false}
          />
        </Group>
      )
    }

    case 'note': {
      const ann    = annotation as any
      const endX   = ann.arrowEndX ?? ann.x + ann.width / 2
      const endY   = ann.arrowEndY ?? ann.y + ann.height + 80
      const handleNoteDragMove = (e: any) => {
        if (noteArrowRef.current) {
          noteArrowRef.current.points([e.target.x() + ann.width / 2, e.target.y() + ann.height, endX, endY])
          noteArrowRef.current.getLayer()?.batchDraw()
        }
      }
      const handleNoteDragEnd = (e: any) => {
        restoreStageDrag(e)
        onDragEnd(annotation.id, { x: e.target.x(), y: e.target.y() })
        e.cancelBubble = true
      }
      return (
        <>
          <Arrow ref={noteArrowRef}
            points={[ann.x + ann.width / 2, ann.y + ann.height, endX, endY]}
            pointerLength={8 / scale} pointerWidth={8 / scale}
            fill={color} stroke={color} strokeWidth={sw} listening={false} />
          <Circle x={endX} y={endY} radius={6 / scale} fill={color} stroke="#fff" strokeWidth={2 / scale}
            draggable={currentTool === 'select'}
            onDragStart={stopStageDrag}
            onDragEnd={(e: any) => { restoreStageDrag(e); onEndpointDragEnd(annotation.id, { arrowEndX: e.target.x(), arrowEndY: e.target.y() }); e.cancelBubble = true }}
            onClick={(e: any) => e.cancelBubble = true}
          />
          <Rect id={annotation.id}
            x={ann.x} y={ann.y} width={ann.width} height={ann.height}
            fill="rgba(255,252,200,0.95)" stroke={color}
            strokeWidth={Math.max(sw, 2)} cornerRadius={6}
            onClick={(e: any) => { onClick(); e.cancelBubble = true }}
            onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
            shadowBlur={isSelected ? 10 : 3} shadowColor={isSelected ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.25)'}
            draggable={currentTool === 'select'}
            onDragStart={handleDragStart} onDragMove={handleNoteDragMove} onDragEnd={handleNoteDragEnd}
          />
          <Rect x={ann.x} y={ann.y} width={ann.width} height={Math.max(8, ann.height * 0.12)}
            fill={color} cornerRadius={6} listening={false} />
          <Text x={ann.x + 10} y={ann.y + Math.max(8, ann.height * 0.12) + 6}
            text={ann.text}
            fontSize={ann.fontSize || Math.max(14, ann.width * 0.07)}
            fontStyle={`${ann.italic ? 'italic ' : ''}${ann.bold ? 'bold' : 'normal'}`}
            textDecoration={ann.underline ? 'underline' : ''}
            fill="#1e1e1e" width={ann.width - 20} wrap="word" listening={false} />
        </>
      )
    }

    case 'measure': {
      const [mx1, my1, mx2, my2] = (annotation as any).points as number[]
      const midX    = (mx1 + mx2) / 2
      const midY    = (my1 + my2) / 2
      const lblText = `${(annotation as any).distance.toFixed(2)} ${(annotation as any).unit}`
      const fontSize = 16 / scale
      const labelW   = 90 / scale
      const labelH   = fontSize + 8 / scale
      return (
        <>
          <Line points={(annotation as any).points}
            stroke={color} strokeWidth={sw} hitStrokeWidth={20 / scale}
            onClick={(e: any) => { onClick(); e.cancelBubble = true }}
            onTap={(e: any)   => { onClick(); e.cancelBubble = true }}
            shadowBlur={isSelected ? 10 : 0} shadowColor="rgba(59,130,246,0.5)"
            draggable={currentTool === 'select'}
            onDragStart={stopStageDrag}
            onDragEnd={(e: any) => {
              restoreStageDrag(e)
              const dx = e.target.x(), dy = e.target.y()
              e.target.x(0); e.target.y(0)
              const np = [mx1 + dx, my1 + dy, mx2 + dx, my2 + dy]
              const dist = Math.sqrt(Math.pow(np[2] - np[0], 2) + Math.pow(np[3] - np[1], 2))
              onDragEnd(annotation.id, { points: np, distance: dist / 10 })
              e.cancelBubble = true
            }}
          />
          <Rect x={midX - labelW / 2} y={midY - labelH - 4 / scale}
            width={labelW} height={labelH} fill="white" opacity={0.88} cornerRadius={3 / scale} listening={false} />
          <Text x={midX - labelW / 2} y={midY - labelH - 2 / scale}
            text={lblText} fontSize={fontSize} fill={color} fontStyle="bold"
            align="center" width={labelW} listening={false} />
          {isSelected && (
            <>
              <Circle x={mx1} y={my1} radius={6 / scale} fill="white" stroke="#3B82F6" strokeWidth={1.5 / scale}
                draggable onDragStart={stopStageDrag}
                onDragEnd={(e: any) => {
                  restoreStageDrag(e)
                  const nx = e.target.x(), ny = e.target.y()
                  const dist = Math.sqrt(Math.pow(mx2 - nx, 2) + Math.pow(my2 - ny, 2))
                  onEndpointDragEnd(annotation.id, { points: [nx, ny, mx2, my2], distance: dist / 10 })
                }} />
              <Circle x={mx2} y={my2} radius={6 / scale} fill="white" stroke="#3B82F6" strokeWidth={1.5 / scale}
                draggable onDragStart={stopStageDrag}
                onDragEnd={(e: any) => {
                  restoreStageDrag(e)
                  const nx = e.target.x(), ny = e.target.y()
                  const dist = Math.sqrt(Math.pow(nx - mx1, 2) + Math.pow(ny - my1, 2))
                  onEndpointDragEnd(annotation.id, { points: [mx1, my1, nx, ny], distance: dist / 10 })
                }} />
            </>
          )}
        </>
      )
    }

    default:
      return null
  }
}

// ── Zone d'import de plan ─────────────────────────────────────────────────────

function PlanImportZone() {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const addPlan          = useAppStore((s) => s.addPlan)
  const updatePlan       = useAppStore((s) => s.updatePlan)
  const setCurrentPlan   = useAppStore((s) => s.setCurrentPlan)
  const [loading, setLoading]   = useState(false)
  const [isDragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!currentProjectId) return
    setLoading(true)
    try {
      if (isPdf(file)) {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const total = pdf.numPages
        for (let pageNum = 1; pageNum <= total; pageNum++) {
          const page     = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas   = document.createElement('canvas')
          canvas.width   = viewport.width
          canvas.height  = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          const dataUrl  = canvas.toDataURL('image/jpeg', 0.85)
          const baseName = file.name.replace(/\.pdf$/i, '')
          const planName = total > 1 ? `${baseName} — Page ${pageNum}` : baseName
          const id = addPlan({
            projectId: currentProjectId,
            name: planName,
            type: 'pdf',
            width: viewport.width,
            height: viewport.height,
            pageNumber: pageNum,
            totalPages: total,
          })
          await savePlanImage(id, dataUrl)
          updatePlan(id, { url: dataUrl })
          if (pageNum === 1) setCurrentPlan(id)
        }
        toast.success(`PDF importé (${total} page${total > 1 ? 's' : ''})`)
      } else {
        const raw    = await fileToDataUrl(file)
        const dataUrl = await bakeImageOrientation(raw)
        const img    = new Image()
        await new Promise<void>((res) => { img.onload = () => res(); img.src = dataUrl })
        const id = addPlan({
          projectId: currentProjectId,
          name:      file.name.replace(/\.[^.]+$/, ''),
          type:      'image',
          width:     img.naturalWidth,
          height:    img.naturalHeight,
        })
        await savePlanImage(id, dataUrl)
        updatePlan(id, { url: dataUrl })
        setCurrentPlan(id)
        toast.success('Plan importé')
      }
    } catch (err) {
      console.error('Import plan:', err)
      toast.error("Erreur lors de l'import du plan")
    } finally {
      setLoading(false)
    }
  }, [currentProjectId, addPlan, updatePlan, setCurrentPlan])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files).find(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    )
    if (file) processFile(file)
  }

  return (
    <div
      className={`flex-1 flex items-center justify-center p-8 transition-colors ${isDragOver ? 'bg-blue-50' : 'bg-gray-50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} />
      <button
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all ${
          isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-white'
        }`}
      >
        {loading
          ? <p className="text-gray-500 text-sm">Import en cours…</p>
          : (
            <>
              <Upload className="w-12 h-12 text-gray-300" />
              <p className="font-semibold text-gray-700">Importer un plan mécanique</p>
              <p className="text-sm text-gray-400">PDF ou image (PNG, JPG, WEBP…)</p>
            </>
          )
        }
      </button>
    </div>
  )
}

// ── Canvas principal ──────────────────────────────────────────────────────────

export default function MainContent() {
  const {
    plans, currentPlanId, setCurrentPlan,
    travaux, selectedTravailId, setSelectedTravail,
    annotations, selectedAnnotationId, selectAnnotation,
    zones, selectedZoneId, selectZone, addZone, updateZone, removeZone,
    currentTool, setCurrentTool,
    annotationColor, annotationStrokeWidth, annotationFontSize,
    addTravail, updateTravail, deleteTravail,
    addAccessDoor, updateAccessDoor, removeAccessDoor,
    addAnnotation, updateAnnotation, deleteAnnotation,
    projects, currentProjectId,
  } = useAppStore()

  const currentProject  = projects.find((p) => p.id === currentProjectId)
  const currentPlan     = plans.find((p) => p.id === currentPlanId)
  const currentTravaux  = travaux.filter((t) => t.planId === currentPlanId)
  const currentAnnots   = annotations.filter((a) => a.planId === currentPlanId)
  const currentDoors    = currentPlan?.accessDoors ?? []
  const currentZones    = zones.filter((z) => z.planId === currentPlanId)

  const [planImageUrl, setPlanImageUrl] = useState<string>('')
  const [selectedDoorId, setSelectedDoorId]   = useState<string | null>(null)
  const [inProgressZone, setInProgressZone]   = useState<number[]>([])
  const [zoneMousePos,   setZoneMousePos]     = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale]       = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShape, setCurrentShape] = useState<any>(null)

  // Overlay textarea pour saisie/édition de texte
  type TextOverlay = { canvasX: number; canvasY: number; editId?: string }
  const [textOverlay, setTextOverlay] = useState<TextOverlay | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const stageRef       = useRef<any>(null)
  const layerRef       = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const containerRef   = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  // ── Barres de défilement ────────────────────────────────────────────────────
  const scrollDragRef = useRef<{ axis: 'h'|'v'; startClient: number; startPos: number } | null>(null)

  const isPanningRef    = useRef(false)
  const panStartRef     = useRef({ x: 0, y: 0 })
  const panStartPosRef  = useRef({ x: 0, y: 0 })

  // Charger l'image du plan depuis IndexedDB
  useEffect(() => {
    if (!currentPlanId) { setPlanImageUrl(''); return }
    const planId = currentPlanId
    const notify = () => requestAnimationFrame(() => requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent('planphoto:plan-ready', { detail: planId }))
    ))
    if (currentPlan?.url) { setPlanImageUrl(currentPlan.url); notify(); return }
    getPlanImage(planId).then(async (url) => {
      if (url) { setPlanImageUrl(url); notify(); return }
      // Fallback : lire directement depuis le dossier sur disque (après chargement via ↓)
      const { getPlanImageFromDisk } = await import('@/services/fileSystemSave')
      const { savePlanImage }        = await import('@/services/planImageStorage')
      const diskUrl = currentProjectId ? await getPlanImageFromDisk(currentProjectId, planId) : null
      if (diskUrl) {
        setPlanImageUrl(diskUrl)
        savePlanImage(planId, diskUrl)  // mise en cache IndexedDB pour la suite
      }
      notify()
    })
  }, [currentPlanId, currentPlan?.url])

  // Sync outil vers window pour sous-composants
  useEffect(() => { (window as any).__currentTool = currentTool }, [currentTool])

  // Capture canvas pour PDF
  useEffect(() => {
    (window as any).__captureCurrentPlan = () => {
      if (!stageRef.current || !currentPlanId) return null
      try {
        const stage = stageRef.current
        const sx = stage.scaleX(), sy = stage.scaleY()
        const px = stage.x(),     py = stage.y()
        stage.scale({ x: 1, y: 1 })
        stage.position({ x: 0, y: 0 })
        const rot  = currentPlan?.rotation ?? 0
        const baseW = currentPlan?.width  ?? stage.width()
        const baseH = currentPlan?.height ?? stage.height()
        const captureW = (rot === 90 || rot === 270) ? baseH : baseW
        const captureH = (rot === 90 || rot === 270) ? baseW : baseH
        const dataUrl = stage.toDataURL({ x: 0, y: 0, width: captureW, height: captureH, mimeType: 'image/jpeg', quality: 0.85, pixelRatio: 1 })
        stage.scale({ x: sx, y: sy })
        stage.position({ x: px, y: py })
        stage.batchDraw()
        return { planId: currentPlanId, dataUrl }
      } catch { return null }
    }
  }, [currentPlanId, currentPlan])

  // Résizer — ré-observe à chaque fois que le container apparaît dans le DOM
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        if (width > 0 && height > 0) setSize({ w: width, h: height })
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [currentPlanId])

  // Fit to screen dès le chargement de l'image
  useEffect(() => {
    if (!planImageUrl || !currentPlan) return
    const img = new Image()
    img.onload = () => {
      const rot  = currentPlan.rotation ?? 0
      const imgW = (rot === 90 || rot === 270) ? img.naturalHeight : img.naturalWidth
      const imgH = (rot === 90 || rot === 270) ? img.naturalWidth  : img.naturalHeight
      const s    = Math.min(size.w / imgW, size.h / imgH, 1)
      setScale(s)
      setPosition({ x: (size.w - imgW * s) / 2, y: (size.h - imgH * s) / 2 })
    }
    img.src = planImageUrl
  }, [planImageUrl])

  // Transformer Konva
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return
    const sel = currentAnnots.find((a) => a.id === selectedAnnotationId)
    if (sel && (sel.type === 'rectangle' || sel.type === 'circle' || sel.type === 'note' || sel.type === 'text')) {
      const node = layerRef.current.findOne('#' + selectedAnnotationId)
      if (node) { transformerRef.current.nodes([node]); transformerRef.current.getLayer()?.batchDraw(); return }
    }
    transformerRef.current.nodes([])
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedAnnotationId, currentAnnots])

  const handleTransformEnd = (e: any) => {
    e.target.getStage()?.draggable((window as any).__currentTool === 'pan')
    const node = e.target
    const ann  = currentAnnots.find((a) => a.id === node.id())
    if (!ann) return
    if (ann.type === 'text') {
      const pad  = 8
      const origW = ((ann as any).width  ?? 300) + pad * 2
      const origH = ((ann as any).height ?? 60)  + pad * 2
      const newW  = Math.max(60,  origW * Math.abs(node.scaleX()) - pad * 2)
      const newH  = Math.max(20,  origH * Math.abs(node.scaleY()) - pad * 2)
      updateAnnotation(node.id(), { x: node.x(), y: node.y(), width: newW, height: newH } as any)
      node.scaleX(1); node.scaleY(1)
    } else if (ann.type === 'rectangle' || ann.type === 'note') {
      updateAnnotation(node.id(), { x: node.x(), y: node.y(), width: Math.abs(node.width() * node.scaleX()), height: Math.abs(node.height() * node.scaleY()) } as any)
      node.scaleX(1); node.scaleY(1)
    } else if (ann.type === 'circle') {
      updateAnnotation(node.id(), { x: node.x(), y: node.y(), radius: Math.abs((ann as any).radius * Math.max(node.scaleX(), node.scaleY())) } as any)
      node.scaleX(1); node.scaleY(1)
    }
  }

  // Touches clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape' && inProgressZone.length > 0) {
        setInProgressZone([])
        setZoneMousePos(null)
        return
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (selectedTravailId) {
        if (window.confirm('Supprimer ce travail de nettoyage ?')) {
          deleteTravail(selectedTravailId)
          setSelectedTravail(null)
        }
        return
      }
      if (selectedAnnotationId) {
        deleteAnnotation(selectedAnnotationId)
        return
      }
      if (selectedZoneId) {
        if (window.confirm('Supprimer cette zone ?')) {
          removeZone(selectedZoneId)
          selectZone(null)
        }
        return
      }
      if (selectedDoorId && currentPlanId) {
        removeAccessDoor(currentPlanId, selectedDoorId)
        setSelectedDoorId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedTravailId, selectedAnnotationId, selectedDoorId, selectedZoneId, currentPlanId,
      inProgressZone, deleteTravail, setSelectedTravail, deleteAnnotation, removeAccessDoor, removeZone, selectZone])

  // ── Gestionnaires canvas ───────────────────────────────────────────────────

  const getCanvasPos = useCallback((e: any): { x: number; y: number } => {
    const stage   = e.target.getStage()
    const pointer = stage.getPointerPosition()
    return {
      x: (pointer.x - position.x) / scale,
      y: (pointer.y - position.y) / scale,
    }
  }, [position, scale])

  const handleStageClick = (e: any) => {
    if (!currentPlanId) return
    if (e.target === e.target.getStage()) {
      setSelectedTravail(null)
      setSelectedDoorId(null)
      selectAnnotation(null)
      selectZone(null)
    }
    // Note : les clics sur l'image du plan sont gérés par PlanImage.onClick

    const { x, y } = getCanvasPos(e)

    if (currentTool === 'pin') {
      const proj = currentProject
      addTravail({
        planId:    currentPlanId,
        systemeId: proj?.systemes[0]?.id ?? '',
        x, y,
        arrowEndX: x + 20, arrowEndY: y + 80,
        pinSize:   'medium',
        statut:    'a_faire',
        anomalies:     [],
        photosAvant:   [],
        photosPendant: [],
        photosApres:   [],
        portesUtilisees: [],
      })
      setCurrentTool('select')
      toast.success('Travail ajouté')
      return
    }

    if (currentTool === 'porte') {
      const newDoorId = addAccessDoor(currentPlanId, x, y)
      setCurrentTool('select')
      if (newDoorId) {
        setSelectedDoorId(newDoorId)
        setSelectedTravail(null)
      }
      toast.success("Porte d'accès ajoutée")
      return
    }

    if (currentTool === 'zone') {
      if (inProgressZone.length >= 6) {
        const fx = inProgressZone[0], fy = inProgressZone[1]
        const dist = Math.sqrt(Math.pow(x - fx, 2) + Math.pow(y - fy, 2))
        if (dist < 18 / scale) {
          const newZone: ZoneConduit = {
            id: nanoid(), planId: currentPlanId,
            typeComposante: undefined,
            points: inProgressZone,
            opacity: 0.35,
          }
          addZone(newZone)
          selectZone(newZone.id)
          setInProgressZone([])
          setZoneMousePos(null)
          setCurrentTool('select')
          toast.success('Zone ajoutée — sélectionnez le type dans le panneau')
          return
        }
      }
      setInProgressZone((prev) => [...prev, x, y])
      return
    }

    if (currentTool === 'text') {
      setTextOverlay({ canvasX: x, canvasY: y })
      return
    }

    if (currentTool === 'note') {
      const text = prompt("Entrez la note :")
      if (text) {
        addAnnotation({
          id: nanoid(), type: 'note', planId: currentPlanId,
          x, y, text, width: 280, height: 140, fontSize: annotationFontSize,
          arrowEndX: x + 140, arrowEndY: y + 260,
          color: annotationColor as any, strokeWidth: annotationStrokeWidth,
          createdAt: new Date().toISOString(),
        })
        toast.success('Note ajoutée')
      }
      setCurrentTool('select')
      return
    }

  }

  const handleMouseDown = (e: any) => {
    if (currentTool === 'pan') return
    if (currentTool === 'select') {
      if (e.target === e.target.getStage()) {
        const pointer = e.target.getStage().getPointerPosition()
        if (pointer) {
          isPanningRef.current    = true
          panStartRef.current     = { x: pointer.x, y: pointer.y }
          panStartPosRef.current  = { x: position.x, y: position.y }
        }
      }
      return
    }
    if (!currentPlanId) return
    const { x, y } = getCanvasPos(e)
    setIsDrawing(true)
    if (currentTool === 'arrow' || currentTool === 'measure') setCurrentShape({ startX: x, startY: y, endX: x, endY: y })
    else if (currentTool === 'rectangle') setCurrentShape({ x, y, width: 0, height: 0 })
    else if (currentTool === 'circle')    setCurrentShape({ x, y, radius: 0 })
    else if (currentTool === 'freehand')  setCurrentShape({ points: [x, y] })
  }

  const handleMouseMove = (e: any) => {
    if (isPanningRef.current) {
      const pointer = e.target.getStage?.()?.getPointerPosition()
      if (pointer) setPosition({
        x: panStartPosRef.current.x + (pointer.x - panStartRef.current.x),
        y: panStartPosRef.current.y + (pointer.y - panStartRef.current.y),
      })
      return
    }
    if (currentTool === 'zone' && inProgressZone.length > 0) {
      setZoneMousePos(getCanvasPos(e))
      return
    }
    if (!isDrawing || !currentShape) return
    const { x, y } = getCanvasPos(e)
    if (currentTool === 'arrow' || currentTool === 'measure') setCurrentShape({ ...currentShape, endX: x, endY: y })
    else if (currentTool === 'rectangle') setCurrentShape({ ...currentShape, width: x - currentShape.x, height: y - currentShape.y })
    else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - currentShape.x, 2) + Math.pow(y - currentShape.y, 2))
      setCurrentShape({ ...currentShape, radius })
    }
    else if (currentTool === 'freehand') setCurrentShape({ points: [...currentShape.points, x, y] })
  }

  const handleMouseUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return }
    if (!isDrawing || !currentShape || !currentPlanId) return
    setIsDrawing(false)

    const base = { planId: currentPlanId, color: annotationColor as any, strokeWidth: annotationStrokeWidth, createdAt: new Date().toISOString() }

    if (currentTool === 'arrow') {
      addAnnotation({ ...base, id: nanoid(), type: 'arrow', points: [currentShape.startX, currentShape.startY, currentShape.endX, currentShape.endY] })
    } else if (currentTool === 'rectangle' && (currentShape.width !== 0 || currentShape.height !== 0)) {
      addAnnotation({ ...base, id: nanoid(), type: 'rectangle', x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height })
    } else if (currentTool === 'circle' && currentShape.radius > 0) {
      addAnnotation({ ...base, id: nanoid(), type: 'circle', x: currentShape.x, y: currentShape.y, radius: currentShape.radius })
    } else if (currentTool === 'freehand' && currentShape.points.length > 2) {
      addAnnotation({ ...base, id: nanoid(), type: 'freehand', points: currentShape.points })
    } else if (currentTool === 'measure') {
      const dist = Math.sqrt(Math.pow(currentShape.endX - currentShape.startX, 2) + Math.pow(currentShape.endY - currentShape.startY, 2))
      addAnnotation({ ...base, id: nanoid(), type: 'measure', points: [currentShape.startX, currentShape.startY, currentShape.endX, currentShape.endY], distance: dist / 10, unit: 'm' })
    }

    setCurrentShape(null)
    setCurrentTool('select')
  }

  const handleWheel = (e: any) => {
    e.evt.preventDefault()
    const by = 1.1
    const newScale = Math.max(0.1, Math.min(5, e.evt.deltaY < 0 ? scale * by : scale / by))
    setScale(newScale)
  }

  const fitToScreen = () => {
    if (!currentPlan) return
    const rot   = currentPlan.rotation ?? 0
    const baseW = (rot === 90 || rot === 270) ? currentPlan.height : currentPlan.width
    const baseH = (rot === 90 || rot === 270) ? currentPlan.width  : currentPlan.height
    const s     = Math.min(size.w / baseW, size.h / baseH, 1)
    setScale(s)
    setPosition({ x: (size.w - baseW * s) / 2, y: (size.h - baseH * s) / 2 })
  }

  const reorganizePins = () => {
    if (!currentPlan) { toast.error('Aucun plan sélectionné'); return }
    if (!currentTravaux.length) { toast('Aucune épingle sur ce plan.'); return }

    // ── Dimensions plan ───────────────────────────────────────────────────────
    const rot   = currentPlan.rotation ?? 0
    const planW = (rot === 90 || rot === 270) ? currentPlan.height : currentPlan.width
    const planH = (rot === 90 || rot === 270) ? currentPlan.width  : currentPlan.height
    const pcx = planW / 2, pcy = planH / 2

    // Tailles des cartes en coordonnées-monde (scale=1).
    // Les positions (t.x, t.y) sont stockées en world px ; le rendu adapte visuellement
    // via u = baseSize/scale dans TravailMarker. Placer ici à scale=1 garantit que
    // les positions restent cohérentes quel que soit le niveau de zoom au moment
    // de la réorganisation.
    const u       = PIN_BASE_SIZES['medium']  // 46 — taille référence à zoom=100 %
    const CW      = u * 3.8    // ≈ 175 px monde (carte medium)
    const CH      = u * 2.5    // ≈ 115 px monde (en-tête + 2 lignes photos)
    const PAD     = u * 0.5    // ≈ 23 px monde
    const GAP_MAX = u * 0.8    // ≈ 37 px monde

    // ── Segment-crossing counter (console report) ─────────────────────────────
    const c2d = (ox: number, oy: number, ax: number, ay: number, bx: number, by: number) =>
      (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)
    const segsCross = (ax: number, ay: number, bx: number, by: number,
                       p1x: number, p1y: number, p2x: number, p2y: number): boolean => {
      const d1 = c2d(p1x, p1y, p2x, p2y, ax, ay), d2 = c2d(p1x, p1y, p2x, p2y, bx, by)
      const d3 = c2d(ax, ay, bx, by, p1x, p1y),   d4 = c2d(ax, ay, bx, by, p2x, p2y)
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
             ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    }
    type Snap = { id: string; x: number; y: number }
    const anchorMap = new Map(currentTravaux.map((t) => [t.id, { ex: t.arrowEndX, ey: t.arrowEndY }]))
    const countCrossings = (snaps: Snap[]) => {
      let count = 0
      for (let i = 0; i < snaps.length; i++)
        for (let j = i + 1; j < snaps.length; j++) {
          const ai = anchorMap.get(snaps[i].id)!, aj = anchorMap.get(snaps[j].id)!
          if (segsCross(snaps[i].x, snaps[i].y, ai.ex, ai.ey, snaps[j].x, snaps[j].y, aj.ex, aj.ey)) count++
        }
      return count
    }
    const crossingsBefore = countCrossings(currentTravaux.map((t) => ({ id: t.id, x: t.x, y: t.y })))

    // ── Assign each pin to the nearest side (by anchor angle from plan centre) ─
    type Side = 'right' | 'bottom' | 'left' | 'top'
    const buckets: Record<Side, typeof currentTravaux> = { right: [], bottom: [], left: [], top: [] }
    // Leader line exits from the card edge that faces the plan interior
    const cardExit: Record<Side, 'left' | 'right' | 'top' | 'bottom'> = {
      right: 'left', left: 'right', top: 'bottom', bottom: 'top',
    }
    for (const t of currentTravaux) {
      const angle = Math.atan2(t.arrowEndY - pcy, t.arrowEndX - pcx)
      if      (angle >= -Math.PI / 4 && angle <  Math.PI / 4)         buckets.right.push(t)
      else if (angle >=  Math.PI / 4 && angle <  3 * Math.PI / 4)     buckets.bottom.push(t)
      else if (angle >=  3 * Math.PI / 4 || angle < -3 * Math.PI / 4) buckets.left.push(t)
      else                                                              buckets.top.push(t)
    }
    buckets.right.sort((a, b) => a.arrowEndY - b.arrowEndY)
    buckets.left.sort((a, b) => a.arrowEndY - b.arrowEndY)
    buckets.top.sort((a, b) => a.arrowEndX - b.arrowEndX)
    buckets.bottom.sort((a, b) => a.arrowEndX - b.arrowEndX)

    // ── Place cards — INSIDE the plan, hugging the interior margin ────────────
    const afterSnaps: Snap[] = []

    // Vertical list: all cards share the same x, stacked top→bottom
    const placeV = (list: typeof currentTravaux, px: number, side: Side) => {
      const n = list.length; if (!n) return
      const availH = planH - 2 * PAD
      // Adaptive gap: shrinks if list is too tall, capped at GAP_MAX
      const gap    = n > 1 ? Math.min(GAP_MAX, Math.max(0, (availH - n * CH) / (n - 1))) : 0
      const totalH = n * CH + (n - 1) * gap
      const startTop = PAD + Math.max(0, (availH - totalH) / 2)   // centre list vertically
      list.forEach((t, i) => {
        const ny = Math.round(Math.min(planH - PAD, startTop + i * (CH + gap) + CH))
        afterSnaps.push({ id: t.id, x: px, y: ny })
        updateTravail(t.id, { x: Math.round(px), y: ny, arrowExitSide: cardExit[side] })
      })
    }

    // Horizontal list: all cards share the same y, stacked left→right
    const placeH = (list: typeof currentTravaux, py: number, side: Side) => {
      const n = list.length; if (!n) return
      const availW = planW - 2 * PAD
      const gap    = n > 1 ? Math.min(GAP_MAX, Math.max(0, (availW - n * CW) / (n - 1))) : 0
      const totalW = n * CW + (n - 1) * gap
      const startLeft = PAD + Math.max(0, (availW - totalW) / 2)
      list.forEach((t, i) => {
        const nx = Math.round(Math.min(planW - CW / 2 - PAD, startLeft + i * (CW + gap) + CW / 2))
        afterSnaps.push({ id: t.id, x: nx, y: py })
        updateTravail(t.id, { x: nx, y: Math.round(py), arrowExitSide: cardExit[side] })
      })
    }

    // x/y for each side — inside the plan, hugging its interior edge
    const rightX  = planW - CW / 2 - PAD    // card right edge at planW − PAD
    const leftX   = CW / 2 + PAD            // card left edge at PAD
    const topY    = CH + PAD                 // card top edge at PAD
    const bottomY = planH - PAD             // card bottom edge at planH − PAD

    placeV(buckets.right,  rightX,  'right')
    placeV(buckets.left,   leftX,   'left')
    placeH(buckets.top,    topY,    'top')
    placeH(buckets.bottom, bottomY, 'bottom')

    // ── Console report ────────────────────────────────────────────────────────
    const crossingsAfter = countCrossings(afterSnaps)
    console.group('%c[PlanPhoto] Réorganisation (marges intérieures)', 'font-weight:bold;color:#3B82F6')
    console.log(`📌 ${currentTravaux.length} épingles — D:${buckets.right.length} G:${buckets.left.length} H:${buckets.top.length} B:${buckets.bottom.length}`)
    console.log(`↗️  Croisements : ${crossingsBefore} → ${crossingsAfter}`)
    console.log(`📐 Plan ${planW}×${planH} | CW=${CW.toFixed(0)} CH=${CH.toFixed(0)} PAD=${PAD.toFixed(0)} GAP_MAX=${GAP_MAX.toFixed(0)} | scale affichage=${scale.toFixed(2)}`)
    console.groupEnd()

    toast.success(
      `Réorganisation — ${currentTravaux.length} épingles dans le plan · D${buckets.right.length} G${buckets.left.length} H${buckets.top.length} B${buckets.bottom.length} · ${crossingsBefore}→${crossingsAfter} croisements`,
      { duration: 4000 },
    )
  }

  // Curseur selon l'outil
  const cursorMap: Record<string, string> = {
    pan: 'grab', pin: 'crosshair', porte: 'crosshair', zone: 'crosshair',
    text: 'text', note: 'crosshair',
    arrow: 'crosshair', rectangle: 'crosshair', circle: 'crosshair',
    freehand: 'crosshair', measure: 'crosshair',
    select: 'default',
  }
  const cursor = cursorMap[currentTool] ?? 'default'

  // ── Forme en cours de dessin (aperçu live) ────────────────────────────────

  const renderPreview = () => {
    // Aperçu zone en cours de dessin
    if (currentTool === 'zone' && inProgressZone.length > 0) {
      const previewPts = zoneMousePos
        ? [...inProgressZone, zoneMousePos.x, zoneMousePos.y]
        : inProgressZone
      const vertices: [number, number][] = []
      for (let i = 0; i < inProgressZone.length - 1; i += 2) {
        vertices.push([inProgressZone[i], inProgressZone[i + 1]])
      }
      return (
        <>
          <Line points={previewPts} stroke="#3B82F6" strokeWidth={2 / scale}
            dash={[6 / scale, 3 / scale]} listening={false} />
          {vertices.map(([vx, vy], idx) => (
            <Circle key={idx} x={vx} y={vy} radius={(idx === 0 ? 8 : 5) / scale}
              fill={idx === 0 ? '#10B981' : '#3B82F6'} stroke="white"
              strokeWidth={1.5 / scale} listening={false} />
          ))}
          {/* Hint fermeture */}
          {vertices.length >= 3 && zoneMousePos && (() => {
            const d = Math.sqrt(
              Math.pow(zoneMousePos.x - inProgressZone[0], 2) +
              Math.pow(zoneMousePos.y - inProgressZone[1], 2)
            )
            return d < 18 / scale ? (
              <Circle x={inProgressZone[0]} y={inProgressZone[1]} radius={12 / scale}
                fill="rgba(16,185,129,0.3)" stroke="#10B981" strokeWidth={2 / scale} listening={false} />
            ) : null
          })()}
        </>
      )
    }

    if (!isDrawing || !currentShape) return null
    const color = annotationColor
    const sw    = annotationStrokeWidth
    if (currentTool === 'arrow') {
      return <Arrow points={[currentShape.startX, currentShape.startY, currentShape.endX, currentShape.endY]}
        pointerLength={20} pointerWidth={20} fill={color} stroke={color} strokeWidth={sw} listening={false} />
    }
    if (currentTool === 'rectangle') {
      return <Rect x={currentShape.x} y={currentShape.y} width={currentShape.width} height={currentShape.height}
        stroke={color} strokeWidth={sw} fill="transparent" dash={[8, 4]} listening={false} />
    }
    if (currentTool === 'circle') {
      return <Circle x={currentShape.x} y={currentShape.y} radius={currentShape.radius}
        stroke={color} strokeWidth={sw} fill="transparent" dash={[8, 4]} listening={false} />
    }
    if (currentTool === 'freehand') {
      return <Line points={currentShape.points} stroke={color} strokeWidth={sw} tension={0.5} lineCap="round" lineJoin="round" listening={false} />
    }
    if (currentTool === 'measure') {
      const dist = Math.sqrt(Math.pow(currentShape.endX - currentShape.startX, 2) + Math.pow(currentShape.endY - currentShape.startY, 2))
      const midX = (currentShape.startX + currentShape.endX) / 2
      const midY = (currentShape.startY + currentShape.endY) / 2
      const fz   = 16 / scale
      const lw   = 90 / scale
      const lh   = fz + 8 / scale
      return (
        <>
          <Line points={[currentShape.startX, currentShape.startY, currentShape.endX, currentShape.endY]}
            stroke={color} strokeWidth={sw} listening={false} />
          <Rect x={midX - lw / 2} y={midY - lh - 4 / scale} width={lw} height={lh}
            fill="white" opacity={0.88} cornerRadius={3 / scale} listening={false} />
          <Text x={midX - lw / 2} y={midY - lh - 2 / scale} text={`${(dist / 10).toFixed(2)} m`}
            fontSize={fz} fill={color} fontStyle="bold" align="center" width={lw} listening={false} />
        </>
      )
    }
    return null
  }

  if (!currentPlanId) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <PlanImportZone />
        {selectedTravailId && <TravailPanel />}
      </div>
    )
  }

  const showDoorPanel = selectedDoorId && currentPlanId

  return (
    <div className="flex flex-1 overflow-hidden">
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-900" style={{ cursor }}>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button onClick={() => setScale((s) => Math.min(s * 1.2, 5))}
            className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
            <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button onClick={() => setScale((s) => Math.max(s / 1.2, 0.1))}
            className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
            <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button onClick={fitToScreen}
            className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
            <Maximize2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
          </button>
          {currentTravaux.length > 0 && (
            <button onClick={reorganizePins} title="Réorganiser les épingles"
              className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg shadow border border-blue-200 dark:border-blue-700 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors">
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </button>
          )}
        </div>

        {/* Indicateur d'échelle */}
        <div className="absolute bottom-3 left-3 z-10 text-xs text-gray-400 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
          {Math.round(scale * 100)} %
        </div>

        <Stage
          ref={stageRef}
          width={size.w} height={size.h}
          scaleX={scale} scaleY={scale}
          x={position.x} y={position.y}
          draggable={currentTool === 'pan'}
          onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer ref={layerRef}>
            {/* Image du plan */}
            {planImageUrl && currentPlan && (
              <PlanImage
                src={planImageUrl}
                rotation={currentPlan.rotation ?? 0}
                onClick={() => {
                  setSelectedTravail(null)
                  setSelectedDoorId(null)
                  selectAnnotation(null)
                  selectZone(null)
                }}
              />
            )}

            {/* Zones de conduit — en dessous des épingles */}
            {currentZones.map((zone) => (
              <ZoneShape
                key={zone.id}
                zone={zone}
                isSelected={zone.id === selectedZoneId}
                onClick={() => { selectZone(zone.id); setSelectedTravail(null); setSelectedDoorId(null); selectAnnotation(null) }}
                onPointsDragEnd={(id, pts) => updateZone(id, { points: pts })}
                scale={scale}
                currentTool={currentTool}
              />
            ))}

            {/* Annotations */}
            {currentAnnots.map((ann) => (
              <AnnotationShape
                key={ann.id}
                annotation={ann}
                isSelected={ann.id === selectedAnnotationId}
                onClick={() => { selectAnnotation(ann.id) }}
                onDblClick={() => {
                  if (ann.type === 'text') {
                    selectAnnotation(ann.id)
                    setTextOverlay({ canvasX: (ann as any).x, canvasY: (ann as any).y, editId: ann.id })
                  }
                }}
                onDragEnd={(id, data) => updateAnnotation(id, data as any)}
                onEndpointDragEnd={(id, data) => updateAnnotation(id, data as any)}
                scale={scale}
                currentTool={currentTool}
              />
            ))}

            {/* Travaux */}
            {currentTravaux.map((t) => {
              const sysNom = currentProject?.systemes.find((s) => s.id === t.systemeId)?.nom ?? ''
              const linkedDoors = (currentPlan?.accessDoors ?? []).filter(
                (d) => (t.portesUtilisees ?? []).includes(d.id)
              )
              return (
                <TravailMarker
                  key={t.id}
                  travail={t}
                  systemeName={sysNom}
                  linkedDoors={linkedDoors}
                  allTravaux={currentTravaux}
                  isSelected={t.id === selectedTravailId}
                  onClick={() => { setSelectedTravail(t.id); setSelectedDoorId(null); selectZone(null) }}
                  scale={scale}
                  currentTool={currentTool}
                  onDragEnd={(id, pos) => updateTravail(id, pos)}
                  onArrowEndDragEnd={(id, pos) => updateTravail(id, pos)}
                  onExitSideChange={(id, side) => updateTravail(id, { arrowExitSide: side as any })}
                />
              )
            })}


            {/* Aperçu de la forme en cours */}
            {renderPreview()}

            {/* Transformer Konva */}
            <Transformer
              ref={transformerRef}
              onTransformStart={(e: any) => e.target.getStage()?.draggable(false)}
              onTransformEnd={handleTransformEnd}
              boundBoxFunc={(old, newBox) => (newBox.width < 20 || newBox.height < 20 ? old : newBox)}
            />
          </Layer>
        </Stage>

        {/* ── Barres de défilement ───────────────────────────────────────── */}
        {(() => {
          const SB = 10  // épaisseur barre
          const rot   = currentPlan?.rotation ?? 0
          const planW = ((rot === 90 || rot === 270) ? currentPlan?.height : currentPlan?.width)  ?? size.w
          const planH = ((rot === 90 || rot === 270) ? currentPlan?.width  : currentPlan?.height) ?? size.h
          const contentW = planW * scale
          const contentH = planH * scale
          const overflowX = contentW > size.w
          const overflowY = contentH > size.h

          const thumbW = overflowX ? Math.max(30, (size.w / contentW) * (size.w - SB)) : 0
          const thumbH = overflowY ? Math.max(30, (size.h / contentH) * (size.h - SB)) : 0

          const trackW = size.w - SB
          const trackH = size.h - SB

          const thumbX = overflowX
            ? Math.min(trackW - thumbW, (-position.x / (contentW - size.w)) * (trackW - thumbW))
            : 0
          const thumbY = overflowY
            ? Math.min(trackH - thumbH, (-position.y / (contentH - size.h)) * (trackH - thumbH))
            : 0

          return (
            <>
              {/* Barre horizontale */}
              {overflowX && (
                <div className="absolute z-10 rounded-full bg-gray-300/40 dark:bg-gray-700/40"
                  style={{ bottom: overflowY ? SB : 2, left: 2, width: trackW - 4, height: SB - 2 }}>
                  <div
                    className="absolute rounded-full bg-gray-400/70 dark:bg-gray-500/70 hover:bg-gray-500/90 dark:hover:bg-gray-400/90 transition-colors cursor-pointer"
                    style={{ left: thumbX, top: 1, width: thumbW, height: SB - 4 }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId)
                      scrollDragRef.current = { axis: 'h', startClient: e.clientX, startPos: position.x }
                    }}
                    onPointerMove={(e) => {
                      const dr = scrollDragRef.current
                      if (!dr || dr.axis !== 'h') return
                      const delta = e.clientX - dr.startClient
                      const ratio = delta / (trackW - thumbW)
                      const newX  = Math.min(0, Math.max(-(contentW - size.w), dr.startPos - ratio * (contentW - size.w)))
                      setPosition((p) => ({ ...p, x: newX }))
                    }}
                    onPointerUp={() => { scrollDragRef.current = null }}
                  />
                </div>
              )}

              {/* Barre verticale */}
              {overflowY && (
                <div className="absolute z-10 rounded-full bg-gray-300/40 dark:bg-gray-700/40"
                  style={{ right: overflowX ? SB : 2, top: 2, height: trackH - 4, width: SB - 2 }}>
                  <div
                    className="absolute rounded-full bg-gray-400/70 dark:bg-gray-500/70 hover:bg-gray-500/90 dark:hover:bg-gray-400/90 transition-colors cursor-pointer"
                    style={{ top: thumbY, left: 1, height: thumbH, width: SB - 4 }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId)
                      scrollDragRef.current = { axis: 'v', startClient: e.clientY, startPos: position.y }
                    }}
                    onPointerMove={(e) => {
                      const dr = scrollDragRef.current
                      if (!dr || dr.axis !== 'v') return
                      const delta = e.clientY - dr.startClient
                      const ratio = delta / (trackH - thumbH)
                      const newY  = Math.min(0, Math.max(-(contentH - size.h), dr.startPos - ratio * (contentH - size.h)))
                      setPosition((p) => ({ ...p, y: newY }))
                    }}
                    onPointerUp={() => { scrollDragRef.current = null }}
                  />
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* ── Overlay saisie / édition de texte ───────────────────────── */}
      {textOverlay && (() => {
        const editAnn  = textOverlay.editId ? (currentAnnots.find((a) => a.id === textOverlay.editId) as any) : null
        const fz       = editAnn?.fontSize ?? annotationFontSize
        const ff       = editAnn?.fontFamily ?? 'Arial'
        const fsBold   = editAnn?.bold   ? 'bold'   : 'normal'
        const fsItalic = editAnn?.italic ? 'italic' : 'normal'
        const clr      = editAnn?.color ?? annotationColor
        const txtW     = editAnn?.width ? editAnn.width * scale : undefined
        const screenX  = position.x + textOverlay.canvasX * scale
        const screenY  = position.y + textOverlay.canvasY * scale

        const confirmText = () => {
          const ta = textareaRef.current
          if (!ta) return
          const text = ta.value.trim()
          if (!text) { setTextOverlay(null); if (!textOverlay.editId) setCurrentTool('select'); return }
          const wCanvas = ta.offsetWidth / scale
          const hCanvas = ta.offsetHeight / scale
          if (textOverlay.editId) {
            updateAnnotation(textOverlay.editId, { text, width: wCanvas, height: hCanvas } as any)
          } else {
            addAnnotation({
              id: nanoid(), type: 'text', planId: currentPlanId!,
              x: textOverlay.canvasX, y: textOverlay.canvasY,
              text, fontSize: fz, fontFamily: ff,
              width: wCanvas, height: hCanvas,
              color: annotationColor as any,
              strokeWidth: annotationStrokeWidth,
              createdAt: new Date().toISOString(),
            })
            setCurrentTool('select')
          }
          setTextOverlay(null)
        }

        return (
          <textarea
            ref={(el) => {
              (textareaRef as any).current = el
              if (el) {
                el.focus()
                if (editAnn?.text) { el.value = editAnn.text; el.select() }
                // auto-height initial
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }
            }}
            defaultValue={editAnn?.text ?? ''}
            onInput={(e) => {
              const ta = e.currentTarget
              ta.style.height = 'auto'
              ta.style.height = ta.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setTextOverlay(null); if (!textOverlay.editId) setCurrentTool('select') }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirmText() }
            }}
            onBlur={confirmText}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: txtW ? txtW + 16 : undefined,
              minWidth: 80,
              padding: '6px 8px',
              fontSize: fz * scale,
              fontFamily: ff,
              fontWeight: fsBold,
              fontStyle: fsItalic,
              color: clr,
              background: 'rgba(255,255,255,0.96)',
              border: '2px dashed #3B82F6',
              borderRadius: 4,
              outline: 'none',
              resize: 'both',
              overflow: 'hidden',
              zIndex: 40,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }}
          />
        )
      })()}

      {/* Panneau latéral droit — un seul à la fois */}
      {selectedTravailId && !selectedDoorId && !selectedZoneId && <TravailPanel />}
      {showDoorPanel && !selectedTravailId && !selectedZoneId && (
        <DoorPanel
          doorId={selectedDoorId}
          planId={currentPlanId}
          onClose={() => setSelectedDoorId(null)}
        />
      )}
      {selectedZoneId && !selectedTravailId && !selectedDoorId && (
        <ZonePanel
          zoneId={selectedZoneId}
          onClose={() => selectZone(null)}
        />
      )}
      {selectedAnnotationId && !selectedTravailId && !selectedDoorId && !selectedZoneId && (
        <PropertiesPanel />
      )}
    </div>
  )
}
