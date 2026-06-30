import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  lastSaveTime: Date | null
  hasChanges: boolean
}

function formatTimeSince(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `${diffMin} min`
  return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

export default function SaveIndicator({ lastSaveTime, hasChanges }: Props) {
  const [timeStr, setTimeStr] = useState("À l'instant")

  useEffect(() => {
    if (!lastSaveTime) return
    const update = () => setTimeStr(formatTimeSince(lastSaveTime))
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [lastSaveTime])

  if (hasChanges) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-500">
        <AlertCircle className="w-3.5 h-3.5" />
        <span className="hidden md:block">Non sauvegardé</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span className="hidden md:block">{timeStr}</span>
    </div>
  )
}
