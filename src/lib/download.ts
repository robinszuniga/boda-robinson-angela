/** Descarga un archivo generado en el navegador */
export function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV con BOM para que Excel reconozca las tildes */
export function downloadCsv(content: string, filename: string) {
  download(String.fromCharCode(0xfeff) + content, filename, 'text/csv;charset=utf-8')
}
