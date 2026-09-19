import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; 'aria-label': string }

export function IconButton({ icon: Icon, className = '', type = 'button', title, 'aria-label': ariaLabel, ...props }: IconButtonProps): React.JSX.Element {
  return <button type={type} className={`ui-icon-button ${className}`.trim()} aria-label={ariaLabel} data-tooltip={title ?? ariaLabel} {...props}>
    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
}
