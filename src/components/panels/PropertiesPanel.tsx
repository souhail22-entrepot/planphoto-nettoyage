import { X, Type, Circle, Square, ArrowRight, MessageSquare, Pencil,
         AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { ANNOTATION_COLORS } from '@/types/index'
import type { AnnotationColor } from '@/types/index'

const FONTS = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS']

export default function PropertiesPanel() {
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId)
  const annotations          = useAppStore((s) => s.annotations)
  const updateAnnotation     = useAppStore((s) => s.updateAnnotation)
  const selectAnnotation     = useAppStore((s) => s.selectAnnotation)
  const deleteAnnotation     = useAppStore((s) => s.deleteAnnotation)

  if (!selectedAnnotationId) return null
  const annotation = annotations.find((a) => a.id === selectedAnnotationId)
  if (!annotation) return null

  const ann = annotation as any

  const hexColors: { id: AnnotationColor; hex: string }[] = [
    { id: 'red',    hex: ANNOTATION_COLORS.red },
    { id: 'blue',   hex: ANNOTATION_COLORS.blue },
    { id: 'green',  hex: ANNOTATION_COLORS.green },
    { id: 'yellow', hex: ANNOTATION_COLORS.yellow },
    { id: 'black',  hex: ANNOTATION_COLORS.black },
    { id: 'white',  hex: ANNOTATION_COLORS.white },
  ]

  const upd = (data: any) => updateAnnotation(annotation.id, data)

  const getIcon = () => {
    switch (annotation.type) {
      case 'text':      return <Type className="w-4 h-4" />
      case 'note':      return <MessageSquare className="w-4 h-4" />
      case 'circle':    return <Circle className="w-4 h-4" />
      case 'rectangle': return <Square className="w-4 h-4" />
      case 'arrow':     return <ArrowRight className="w-4 h-4" />
      case 'freehand':  return <Pencil className="w-4 h-4" />
      default:          return null
    }
  }

  const getTypeLabel = () => {
    switch (annotation.type) {
      case 'text':      return 'Texte'
      case 'note':      return 'Note'
      case 'arrow':     return 'Flèche'
      case 'rectangle': return 'Rectangle'
      case 'circle':    return 'Cercle'
      case 'freehand':  return 'Dessin libre'
      case 'measure':   return 'Mesure'
      default:          return 'Annotation'
    }
  }

  const isText = annotation.type === 'text'

  return (
    <div className="absolute right-4 top-20 bottom-4 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center gap-2 text-gray-800 dark:text-white">
          {getIcon()}
          <span className="font-semibold text-sm">{getTypeLabel()}</span>
        </div>
        <button onClick={() => selectAnnotation(null)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">

        {/* ── Couleur ───────────────────────────────────────────────── */}
        <Section label="Couleur">
          <div className="flex gap-1.5 flex-wrap">
            {hexColors.map((c) => {
              const active = ann.color === c.hex || ann.color === c.id
              return (
                <button key={c.id}
                  onClick={() => upd({ color: c.hex })}
                  title={c.id}
                  className={`w-7 h-7 rounded border-2 transition-all ${
                    active ? 'border-blue-500 scale-110 shadow' : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              )
            })}
          </div>
        </Section>

        {/* ── Outils TEXTE ──────────────────────────────────────────── */}
        {isText && (
          <>
            {/* Police + taille */}
            <Section label="Police">
              <select
                value={ann.fontFamily || 'Arial'}
                onChange={(e) => upd({ fontFamily: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs mb-2"
              >
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <button onClick={() => upd({ fontSize: Math.max(8, (ann.fontSize ?? 16) - 2) })}
                  className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center">−</button>
                <input type="number" min={6} max={200} step={1}
                  value={ann.fontSize ?? 16}
                  onChange={(e) => upd({ fontSize: Math.max(6, Number(e.target.value)) })}
                  className="flex-1 text-center px-1 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                />
                <button onClick={() => upd({ fontSize: Math.min(200, (ann.fontSize ?? 16) + 2) })}
                  className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center">+</button>
                <span className="text-xs text-gray-400 ml-0.5">px</span>
              </div>
            </Section>

            {/* Gras / Italique / Souligné */}
            <Section label="Style">
              <div className="flex gap-1">
                <StyleBtn label="B" active={!!ann.bold}      className="font-bold"  onClick={() => upd({ bold:      !ann.bold })} />
                <StyleBtn label="I" active={!!ann.italic}    className="italic"     onClick={() => upd({ italic:    !ann.italic })} />
                <StyleBtn label="U" active={!!ann.underline} className="underline"  onClick={() => upd({ underline: !ann.underline })} />
              </div>
            </Section>

            {/* Alignement */}
            <Section label="Alignement">
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((a) => {
                  const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                  return (
                    <button key={a} onClick={() => upd({ align: a })} title={a}
                      className={`flex-1 py-1.5 rounded flex items-center justify-center transition-all ${
                        (ann.align || 'left') === a
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* Fond */}
            <Section label="Fond">
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'Blanc', val: 'rgba(255,255,255,0.92)' },
                  { label: 'Jaune', val: 'rgba(254,249,195,0.95)' },
                  { label: 'Bleu',  val: 'rgba(219,234,254,0.95)' },
                  { label: 'Aucun', val: 'rgba(0,0,0,0)' },
                ].map((bg) => (
                  <button key={bg.label} onClick={() => upd({ bgColor: bg.val })} title={bg.label}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      (ann.bgColor || 'rgba(255,255,255,0.92)') === bg.val
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}>
                    {bg.label}
                  </button>
                ))}
              </div>
            </Section>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
              Double-clic → éditer le texte<br />
              Poignées bleues → redimensionner la zone
            </p>
          </>
        )}

        {/* ── Épaisseur (non-texte, non-note) ──────────────────────── */}
        {annotation.type !== 'text' && annotation.type !== 'note' && (
          <Section label={`Épaisseur : ${ann.strokeWidth}px`}>
            <input type="range" min="1" max="10" step="1"
              value={ann.strokeWidth}
              onChange={(e) => upd({ strokeWidth: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>Fine</span><span>Épaisse</span>
            </div>
          </Section>
        )}

        {/* ── Note : texte + taille police ─────────────────────────── */}
        {annotation.type === 'note' && (
          <>
            <Section label="Texte">
              <textarea rows={3} value={ann.text || ''}
                onChange={(e) => upd({ text: e.target.value })}
                className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-xs"
              />
            </Section>
            <Section label={`Police : ${ann.fontSize || 14}px`}>
              <input type="range" min="10" max="48" step="2"
                value={ann.fontSize || 14}
                onChange={(e) => upd({ fontSize: Number(e.target.value) })}
                className="w-full"
              />
            </Section>
          </>
        )}

      </div>

      {/* Supprimer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button onClick={() => { deleteAnnotation(annotation.id); selectAnnotation(null) }}
          className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
          <X className="w-3.5 h-3.5" />
          Supprimer
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function StyleBtn({ label, active, className, onClick }: { label: string; active: boolean; className?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-1.5 rounded text-xs transition-all ${className} ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}>
      {label}
    </button>
  )
}
