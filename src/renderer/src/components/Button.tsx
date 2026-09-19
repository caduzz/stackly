import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps): React.JSX.Element {
  return <button type={type} className={`ui-button ui-button--${variant} ${className}`.trim()} {...props} />
}
