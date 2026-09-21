import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from './cn'

/** Código QR en SVG (se ve nítido en pantalla y al imprimir) */
export function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let active = true
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2d2926', light: '#ffffff' } })
      .then((out) => {
        if (active) setSvg(out)
      })
      .catch(() => {
        if (active) setSvg('')
      })
    return () => {
      active = false
    }
  }, [value])

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('aspect-square bg-white [&>svg]:size-full', className)}
      // SVG generado localmente por la librería qrcode a partir de nuestra propia URL
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
