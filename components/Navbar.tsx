'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Navbar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/', label: 'Upload Nota' },
    { href: '/rekap', label: 'Rekap' },
  ]

  return (
    <nav style={s.nav}>
      <div style={s.inner}>
        <div style={s.brand}>🧾 <span style={{ fontWeight: 700 }}>Reimburse Makan</span></div>
        <div style={s.links}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ ...s.link, ...(pathname === l.href ? s.linkActive : {}) }}>
              {l.label}
            </a>
          ))}
        </div>
        <div style={s.right}>
          {email && <span style={s.email}>{email}</span>}
          <button onClick={logout} style={s.logoutBtn}>Keluar</button>
        </div>
      </div>
    </nav>
  )
}

const s: Record<string, React.CSSProperties> = {
  nav: { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 },
  inner: { maxWidth: 900, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 24 },
  brand: { fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  links: { display: 'flex', gap: 4, flex: 1 },
  link: { padding: '6px 12px', borderRadius: 6, fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 },
  linkActive: { background: '#fff7ed', color: '#ea580c' },
  right: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  email: { fontSize: 13, color: '#9ca3af', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
}
