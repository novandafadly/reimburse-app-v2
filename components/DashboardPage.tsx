'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { createClient, type Transaksi, type Kategori, KATEGORI_LABEL } from '@/lib/supabase'

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatTanggal(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_CONFIG = {
  belum: { label: 'Belum Diajukan', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  proses: { label: 'Dalam Proses', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  selesai: { label: 'Sudah Direimburse', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
}

export default function DashboardPage({ email }: { email?: string }) {
  const supabase = createClient()
  const [data, setData] = useState<Transaksi[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKategori, setFilterKategori] = useState<Kategori | ''>('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [expandedStaf, setExpandedStaf] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('transaksi').select('*').order('tanggal', { ascending: false })
    if (filterKategori) q = q.eq('kategori', filterKategori)
    if (filterFrom) q = q.gte('tanggal', filterFrom)
    if (filterTo) q = q.lte('tanggal', filterTo)
    const { data: rows } = await q
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [filterKategori, filterFrom, filterTo])

  const total = data.reduce((s, r) => s + r.jumlah, 0)
  const byStatus = {
    belum: data.filter(r => r.status === 'belum'),
    proses: data.filter(r => r.status === 'proses'),
    selesai: data.filter(r => r.status === 'selesai'),
  }

  const byStaf = data.reduce((acc, r) => {
    const key = r.dibayar_oleh || 'Tidak diketahui'
    if (!acc[key]) acc[key] = {
      nama: key, bank: r.bank_penalangging, noRek: r.no_rek_penalangging,
      transaksi: [], totalBelum: 0, totalProses: 0, totalSelesai: 0, total: 0,
    }
    acc[key].transaksi.push(r)
    acc[key].total += r.jumlah
    if (r.status === 'belum') acc[key].totalBelum += r.jumlah
    if (r.status === 'proses') acc[key].totalProses += r.jumlah
    if (r.status === 'selesai') acc[key].totalSelesai += r.jumlah
    return acc
  }, {} as Record<string, {
    nama: string; bank: string | null; noRek: string | null
    transaksi: Transaksi[]
    totalBelum: number; totalProses: number; totalSelesai: number; total: number
  }>)

  return (
    <div>
      <Navbar email={email} />
      <main style={s.main}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={s.title}>Dashboard</h1>
          <p style={s.subtitle}>Posisi dan status reimburse semua staf</p>
        </header>

        {/* Filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <select value={filterKategori} onChange={e => setFilterKategori(e.target.value as Kategori | '')} style={s.filterInput}>
            <option value="">Semua Kategori</option>
            {(Object.entries(KATEGORI_LABEL) as [Kategori, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={s.filterInput} />
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={s.filterInput} />
          {(filterKategori || filterFrom || filterTo) && (
            <button onClick={() => { setFilterKategori(''); setFilterFrom(''); setFilterTo('') }} style={s.btnSmall}>Reset</button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Memuat...</div>
        ) : (
          <>
            {/* Status cards - 2x2 grid on mobile */}
            <div style={s.statusGrid}>
              <div style={{ ...s.statusCard, borderTop: '3px solid #111827', gridColumn: 'span 2' }}>
                <div style={s.statusLabel}>Total Keseluruhan</div>
                <div style={{ ...s.statusAmount, fontSize: 20 }}>{formatRupiah(total)}</div>
                <div style={s.statusCount}>{data.length} transaksi</div>
              </div>
              {(Object.entries(byStatus) as [keyof typeof STATUS_CONFIG, Transaksi[]][]).map(([status, rows]) => {
                const cfg = STATUS_CONFIG[status]
                const amt = rows.reduce((s, r) => s + r.jumlah, 0)
                return (
                  <div key={status} style={{ ...s.statusCard, borderTop: `3px solid ${cfg.border}`, background: cfg.bg }}>
                    <div style={{ ...s.statusLabel, color: cfg.color }}>{cfg.label}</div>
                    <div style={{ ...s.statusAmount, color: cfg.color, fontSize: 15 }}>{formatRupiah(amt)}</div>
                    <div style={{ ...s.statusCount, color: cfg.color }}>{rows.length} transaksi</div>
                  </div>
                )
              })}
            </div>

            {/* Per staf */}
            <h2 style={s.sectionTitle}>Posisi per Staf</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.values(byStaf).sort((a, b) => b.total - a.total).map(p => {
                const isExpanded = expandedStaf === p.nama
                return (
                  <div key={p.nama} style={s.stafCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => setExpandedStaf(isExpanded ? null : p.nama)}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nama}</div>
                        {p.bank && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{p.bank} · {p.noRek}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{formatRupiah(p.total)}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.transaksi.length} transaksi</div>
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {p.totalBelum > 0 && <span style={{ ...s.pill, color: STATUS_CONFIG.belum.color, background: STATUS_CONFIG.belum.bg, border: `1px solid ${STATUS_CONFIG.belum.border}` }}>Belum: {formatRupiah(p.totalBelum)}</span>}
                      {p.totalProses > 0 && <span style={{ ...s.pill, color: STATUS_CONFIG.proses.color, background: STATUS_CONFIG.proses.bg, border: `1px solid ${STATUS_CONFIG.proses.border}` }}>Proses: {formatRupiah(p.totalProses)}</span>}
                      {p.totalSelesai > 0 && <span style={{ ...s.pill, color: STATUS_CONFIG.selesai.color, background: STATUS_CONFIG.selesai.bg, border: `1px solid ${STATUS_CONFIG.selesai.border}` }}>Selesai: {formatRupiah(p.totalSelesai)}</span>}
                    </div>

                    {p.total > 0 && (
                      <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${(p.totalSelesai / p.total) * 100}%`, background: '#16a34a' }} />
                        <div style={{ width: `${(p.totalProses / p.total) * 100}%`, background: '#f59e0b' }} />
                        <div style={{ width: `${(p.totalBelum / p.total) * 100}%`, background: '#ef4444' }} />
                      </div>
                    )}

                    {isExpanded && (
                      <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                        {/* Mobile: card list instead of table */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {p.transaksi.map(t => (
                            <div key={t.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, flex: 1, marginRight: 8 }}>{t.keterangan}</div>
                                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', color: '#ea580c' }}>{formatRupiah(t.jumlah)}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#6b7280' }}>{formatTanggal(t.tanggal)}</span>
                                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: t.kategori === 'makan_minum' ? '#fef3c7' : '#ede9fe', color: t.kategori === 'makan_minum' ? '#92400e' : '#5b21b6', fontWeight: 600 }}>
                                  {t.kategori === 'makan_minum' ? '🍽️' : '📋'}
                                </span>
                                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, fontWeight: 600, color: STATUS_CONFIG[t.status].color, background: STATUS_CONFIG[t.status].bg, border: `1px solid ${STATUS_CONFIG[t.status].border}` }}>
                                  {STATUS_CONFIG[t.status].label}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff7ed', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>{formatRupiah(p.total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { maxWidth: 900, margin: '0 auto', padding: '20px 16px 60px' },
  title: { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: '#6b7280', margin: '3px 0 0' },
  filterInput: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff', flex: '1 1 130px', minWidth: 110 },
  statusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
  statusCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3 },
  statusLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280' },
  statusAmount: { fontSize: 16, fontWeight: 700, color: '#111827' },
  statusCount: { fontSize: 11, color: '#9ca3af' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 10px' },
  stafCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' },
  pill: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 },
  btnSmall: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
}
