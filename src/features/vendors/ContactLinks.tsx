import { AtSign, Globe, Mail, MessageCircle, Phone } from 'lucide-react'
import { instagramLink, safeUrl, whatsappLink, whatsappNumber } from '../../lib/contact'
import type { Vendor } from '../../types/database'

const linkClass =
  'inline-flex size-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition-colors hover:border-brand-300 hover:text-brand-700'

/** Botones rápidos de contacto: llamar, WhatsApp, correo, Instagram, web */
export function ContactLinks({ vendor }: { vendor: Pick<Vendor, 'name' | 'phone' | 'email' | 'instagram' | 'website'> }) {
  const ig = instagramLink(vendor.instagram)
  const web = safeUrl(vendor.website)
  return (
    <div className="flex flex-wrap gap-1.5">
      {vendor.phone && (
        <a className={linkClass} href={`tel:${vendor.phone.replace(/[^\d+]/g, '')}`} aria-label={`Llamar a ${vendor.name}`} title="Llamar">
          <Phone className="size-4" />
        </a>
      )}
      {whatsappNumber(vendor.phone) && (
        <a className={linkClass} href={whatsappLink(vendor.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${vendor.name}`} title="WhatsApp">
          <MessageCircle className="size-4" />
        </a>
      )}
      {vendor.email && (
        <a className={linkClass} href={`mailto:${vendor.email}`} aria-label={`Correo de ${vendor.name}`} title="Correo">
          <Mail className="size-4" />
        </a>
      )}
      {ig && (
        <a className={linkClass} href={ig} target="_blank" rel="noreferrer" aria-label={`Instagram de ${vendor.name}`} title="Instagram">
          <AtSign className="size-4" />
        </a>
      )}
      {web && (
        <a className={linkClass} href={web} target="_blank" rel="noreferrer" aria-label={`Sitio web de ${vendor.name}`} title="Sitio web">
          <Globe className="size-4" />
        </a>
      )}
    </div>
  )
}
