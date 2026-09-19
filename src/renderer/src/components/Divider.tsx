type DividerProps = { orientation?: 'horizontal' | 'vertical' }

export function Divider({ orientation = 'horizontal' }: DividerProps): React.JSX.Element {
  return <div className={`ui-divider ui-divider--${orientation}`} role="separator" aria-orientation={orientation} />
}
