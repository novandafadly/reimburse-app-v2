'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Navbar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/', label: 'Upload Nota' },
    { href: '/rekap', label: 'Rekap' },
    { href: '/dashboard', label: 'Dashboard' },
  ]

  return (
    <nav style={s.nav} className="no-print">
      <div style={s.inner}>
        <div style={s.brand}>🧾 <span style={{ fontWeight: 700 }}>Reimburse</span></div>

        {/* Desktop links - hidden on mobile */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {links.map(l => (
              <a key={l.href} href={l.href}
                style={{ ...s.link, ...(pathname === l.href ? s.linkActive : {}) }}>
                {l.label}
              </a>
            ))}
            <button onClick={logout} style={s.logoutBtn}>Keluar</button>
          </div>
        )}

        {/* Hamburger - mobile only */}
        {isMobile && (
          <button onClick={() => setMenuOpen(p => !p)} style={s.hamburger} aria-label="Menu">
            <span style={{ ...s.bar, ...(menuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}) }} />
            <span style={{ ...s.bar, ...(menuOpen ? { opacity: 0 } : {}) }} />
            <span style={{ ...s.bar, ...(menuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}) }} />
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {isMobile && menuOpen && (
        <div style={s.mobileMenu}>
          {links.map(l => (
            <a key={l.href} href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{ ...s.mobileLink, ...(pathname === l.href ? s.mobileLinkActive : {}) }}>
              {l.label}
            </a>
          ))}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 8 }}>
            <button onClick={logout} style={s.mobileLogout}>Keluar</button>
          </div>
        </div>
      )}
    </nav>
  )
}

const s: Record<string, React.CSSProperties> = {
  nav: { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 },
  inner: { maxWidth: 1000, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 },
  linkActive: { background: '#fff7ed', color: '#ea580c' },
  logoutBtn: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', marginLeft: 8 },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 },
  bar: { display: 'block', width: 22, height: 2, background: '#374151', borderRadius: 2, transition: 'all 0.2s' },
  mobileMenu: { background: '#fff', borderTop: '1px solid #f3f4f6', padding: '8px 0 12px' },
  mobileLink: { display: 'block', padding: '12px 16px', fontSize: 15, color: '#374151', textDecoration: 'none', fontWeight: 500 },
  mobileLinkActive: { background: '#fff7ed', color: '#ea580c' },
  mobileLogout: { display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: 15, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
}
