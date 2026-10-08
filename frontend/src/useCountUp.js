import { useEffect, useRef, useState } from 'react'

/** Animates a number from its previous value to `target` (ease-out). */
export default function useCountUp(target, duration = 900) {
  const end = Number(target) || 0
  const [val, setVal] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === end) { from.current = end; setVal(end); return }
    const start = from.current
    const t0 = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(start + (end - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = end
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = end }
  }, [end, duration])

  return val
}