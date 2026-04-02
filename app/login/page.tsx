'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [success, setSuccess] = useState('')

  const supabase = createClient()

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.href = '/'
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) setError(error.message)
      else setSuccess('Cek email kamu untuk konfirmasi akun.')
    }
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🧾</div>
        <h1 style={s.title}>Reimburse Makan</h1>
        <p style={s.subtitle}>Sistem rekap reimburse kantor</p>

        <div style={s.tabs}>
          <button onClick={() => setMode('login')} style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }}>Masuk</button>
          <button onClick={() => setMode('register')} style={{ ...s.tab, ...(mode === 'register' ? s.tabActive : {}) }}>Daftar</button>
        </div>

        <div style={s.form}>
          <div>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              style={s.input}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={s.input}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}
          {success && <div style={s.successMsg}>✓ {success}</div>}

          <button onClick={handleSubmit} disabled={loading || !email || !password} style={{ ...s.btn, opacity: loading || !email || !password ? 0.6 : 1 }}>
            {loading ? 'Loading...' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 380, border: '1px solid #e5e7eb', textAlign: 'center' },
  logo: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '0 0 24px' },
  tabs: { display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, marginBottom: 20 },
  tab: { flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: '#6b7280', fontFamily: 'inherit' },
  tabActive: { background: '#fff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, letterSpacing: '0.04em' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fafafa' },
  btn: { background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', color: '#991b1b', fontSize: 13 },
  successMsg: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', color: '#166534', fontSize: 13 },
}
