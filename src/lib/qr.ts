import QRCode from 'qrcode'

/** Descarga un QR en PNG de alta resolución (para imprimir en invitaciones) */
export async function downloadQrPng(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, { margin: 2, width: 800, errorCorrectionLevel: 'M' })
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
