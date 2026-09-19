import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type Source = {
  text: string
  rect: { top: number; right: number; bottom: number; left: number; width: number; height: number }
  placement: 'side' | 'vertical'
}

type Position = { left: number; top: number }

function tooltipTarget(value: EventTarget | null): HTMLElement | null {
  return value instanceof Element ? value.closest<HTMLElement>('[data-tooltip]') : null
}

export function TooltipLayer(): React.JSX.Element | null {
  const [source, setSource] = useState<Source | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!source || !tooltip) return
    const bounds = tooltip.getBoundingClientRect()
    const gap = 8
    const edge = 8
    let left: number
    let top: number

    if (source.placement === 'side') {
      const fitsRight = source.rect.right + gap + bounds.width <= window.innerWidth - edge
      left = fitsRight ? source.rect.right + gap : source.rect.left - gap - bounds.width
      top = source.rect.top + (source.rect.height - bounds.height) / 2
    } else {
      const fitsBelow = source.rect.bottom + gap + bounds.height <= window.innerHeight - edge
      left = source.rect.left + (source.rect.width - bounds.width) / 2
      top = fitsBelow ? source.rect.bottom + gap : source.rect.top - gap - bounds.height
    }

    setPosition({
      left: Math.min(Math.max(left, edge), window.innerWidth - bounds.width - edge),
      top: Math.min(Math.max(top, edge), window.innerHeight - bounds.height - edge)
    })
  }, [source])

  useEffect(() => {
    function clearTimer(): void {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
    }

    function hide(): void {
      clearTimer()
      setSource(null)
      setPosition(null)
    }

    function schedule(target: HTMLElement | null, immediate = false): void {
      clearTimer()
      if (!target?.dataset.tooltip) return
      const bounds = target.getBoundingClientRect()
      const next: Source = {
        text: target.dataset.tooltip,
        rect: { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left, width: bounds.width, height: bounds.height },
        placement: target.closest('.shell-sidebar') ? 'side' : 'vertical'
      }
      const show = (): void => { setPosition(null); setSource(next) }
      if (immediate) show()
      else timer.current = window.setTimeout(show, 350)
    }

    function onPointerOver(event: PointerEvent): void { schedule(tooltipTarget(event.target)) }
    function onPointerOut(event: PointerEvent): void {
      const target = tooltipTarget(event.target)
      if (target && event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return
      hide()
    }
    function onFocusIn(event: FocusEvent): void { schedule(tooltipTarget(event.target), true) }
    function onFocusOut(event: FocusEvent): void {
      const target = tooltipTarget(event.target)
      if (target && event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return
      hide()
    }

    document.addEventListener('pointerover', onPointerOver, true)
    document.addEventListener('pointerout', onPointerOut, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      clearTimer()
      document.removeEventListener('pointerover', onPointerOver, true)
      document.removeEventListener('pointerout', onPointerOut, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  if (!source) return null
  return <div ref={tooltipRef} className="app-tooltip" role="tooltip" style={position ?? { visibility: 'hidden' }}>{source.text}</div>
}
