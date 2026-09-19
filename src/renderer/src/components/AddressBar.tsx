import { useEffect, useRef, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { normalizeAddress } from '../normalizeAddress'

type AddressBarProps = { currentUrl: string; onSubmit: (address: string) => void }

export function AddressBar({ currentUrl, onSubmit }: AddressBarProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(currentUrl)
  }, [currentUrl])

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const address = normalizeAddress(value)
    if (address) {
      submittedRef.current = true
      onSubmit(address)
      inputRef.current?.blur()
    }
  }

  return <form className="address-bar" onSubmit={submit} role="search">
    <Globe2 size={15} strokeWidth={1.75} aria-hidden="true" />
    <input
      ref={inputRef}
      aria-label="Address"
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => {
        if (!submittedRef.current) setValue(currentUrl)
        submittedRef.current = false
      }}
      placeholder="Search or enter an address"
    />
  </form>
}
