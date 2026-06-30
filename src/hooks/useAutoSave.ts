import { useEffect, useRef, useState } from 'react'

export function useAutoSave(onSave: () => void, delayMs = 2000) {
  const [saved, setSaved] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSave = () => {
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSave()
      setSaved(true)
    }, delayMs)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { saved, triggerSave }
}
