import { Trash2, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { COMPOSANTES_CVAC, composanteColor } from '@/types'
import type { TypeComposanteCVAC } from '@/types'

interface Props {
  zoneId: string
  onClose: () => void
}

const SELECT = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const LBL   = 'block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1'

export default function ZonePanel({ zoneId, onClose }: Props) {
  const zones      = useAppStore((s) => s.zones)
  const updateZone = useAppStore((s) => s.updateZone)
  const removeZone = useAppStore((s) => s.removeZone)

  const zone = zones.find((z) => z.id === zoneId)
  if (!zone) return null

  const color = composanteColor(zone.typeComposante)

  const handleDelete = () => {
    if (window.confirm('Supprimer cette zone ?')) {
      removeZone(zoneId)
      onClose()
    }
  }

  return (
    <div className="w-72 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: color }} />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Zone de conduit</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 p-4 space-y-4">

        {/* Type de composante */}
        <div>
          <label className={LBL}>Type de composante</label>
          <select
            className={SELECT}
            value={zone.typeComposante ?? ''}
            onChange={(e) => updateZone(zoneId, { typeComposante: e.target.value || undefined })}
          >
            <option value="">— Non défini</option>
            {(Object.entries(COMPOSANTES_CVAC) as [TypeComposanteCVAC, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Opacité */}
        <div>
          <label className={LBL}>Opacité du remplissage — {Math.round(zone.opacity * 100)} %</label>
          <input
            type="range" min={10} max={80} step={5}
            value={Math.round(zone.opacity * 100)}
            onChange={(e) => updateZone(zoneId, { opacity: parseInt(e.target.value) / 100 })}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Info sommets */}
        <p className="text-xs text-gray-400 dark:text-gray-600">
          {zone.points.length / 2} sommet{zone.points.length / 2 !== 1 ? 's' : ''} — déplacer les points blancs pour ajuster la forme
        </p>
      </div>

      {/* Supprimer */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-500 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer la zone
        </button>
      </div>
    </div>
  )
}
