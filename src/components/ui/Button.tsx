import type { ComponentProps } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from './cn'
import { buttonClass, type StyleProps } from './buttonStyles'

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'> & StyleProps) {
  return (
    <button type={type} className={buttonClass({ variant, size }, className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, icon, className, children, ...props }: LinkProps & StyleProps) {
  return (
    <Link className={buttonClass({ variant, size }, className)} {...props}>
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/5 hover:text-ink disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
