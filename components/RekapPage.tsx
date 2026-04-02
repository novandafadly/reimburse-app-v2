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

export default function RekapPage({ email }: { email?: string }) {
  const supabase = createClient()
  const [data, setData] = useState<Transaksi[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterKategori, setFilterKategori] = useState<Kategori | ''>('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Transaksi>>({})
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [lampiranMap, setLampiranMap] = useState<Record<string, string[]>>({})

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('transaksi').select('*, lampiran(*)').order('tanggal', { ascending: true })
    if (filterFrom) q = q.gte('tanggal', filterFrom)
    if (filterTo) q = q.lte('tanggal', filterTo)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterKategori) q = q.eq('kategori', filterKategori)
    const { data: rows } = await q
    setData(rows || [])

    const newMap: Record<string, string[]> = {}
    for (const row of (rows || [])) {
      if (row.lampiran?.length) {
        const urls = await Promise.all(
          row.lampiran.map(async (l: { storage_path: string }) => {
            const { data: signed } = await supabase.storage.from('lampiran-nota').createSignedUrl(l.storage_path, 3600)
            return signed?.signedUrl || ''
          })
        )
        newMap[row.id] = urls.filter(Boolean)
      }
    }
    setLampiranMap(newMap)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [filterFrom, filterTo, filterStatus, filterKategori])

  const totalAmount = data.reduce((sum, r) => sum + r.jumlah, 0)

  // Summary per penalangging
  const summaryPenalangging = data.reduce((acc, r) => {
    const key = r.dibayar_oleh || 'Tidak diketahui'
    if (!acc[key]) acc[key] = { nama: key, bank: r.bank_penalangging, noRek: r.no_rek_penalangging, total: 0, belum: 0, proses: 0, selesai: 0 }
    acc[key].total += r.jumlah
    acc[key][r.status] += r.jumlah
    return acc
  }, {} as Record<string, { nama: string; bank: string | null; noRek: string | null; total: number; belum: number; proses: number; selesai: number }>)

  const updateStatus = async (id: string, status: 'belum' | 'proses' | 'selesai') => {
    await supabase.from('transaksi').update({ status }).eq('id', id)
    setData(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const startEdit = (row: Transaksi) => {
    setEditId(row.id)
    setEditData({ tanggal: row.tanggal, keterangan: row.keterangan, jumlah: row.jumlah, deskripsi: row.deskripsi || '', dibayar_oleh: row.dibayar_oleh || '', bank_penalangging: row.bank_penalangging || '', no_rek_penalangging: row.no_rek_penalangging || '', kategori: row.kategori })
  }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(true)
    await supabase.from('transaksi').update({
      tanggal: editData.tanggal, keterangan: editData.keterangan,
      jumlah: Number(editData.jumlah), deskripsi: editData.deskripsi,
      dibayar_oleh: editData.dibayar_oleh, bank_penalangging: editData.bank_penalangging,
      no_rek_penalangging: editData.no_rek_penalangging, kategori: editData.kategori,
    }).eq('id', editId)
    setEditId(null); setSaving(false); fetchData()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    await supabase.from('transaksi').delete().eq('id', deleteId)
    setDeleteId(null); fetchData()
  }

  const periodLabel = () => {
    if (filterFrom && filterTo) return `${formatTanggal(filterFrom)} s.d. ${formatTanggal(filterTo)}`
    if (filterFrom) return `Dari ${formatTanggal(filterFrom)}`
    if (filterTo) return `s.d. ${formatTanggal(filterTo)}`
    return 'Semua periode'
  }

  const kategoriLabel = filterKategori ? KATEGORI_LABEL[filterKategori] : 'Semua Kategori'

  return (
    <div>
      <Navbar email={email} />

      {/* Filter bar */}
      <div style={s.filterBar} className="no-print">
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={s.dateInput} />
          <span style={{ color: '#9ca3af', fontSize: 13 }}>s.d.</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={s.dateInput} />
          <select value={filterKategori} onChange={e => setFilterKategori(e.target.value as Kategori | '')} style={s.dateInput}>
            <option value="">Semua Kategori</option>
            {(Object.entries(KATEGORI_LABEL) as [Kategori, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={s.dateInput}>
            <option value="">Semua Status</option>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
          </select>
          {(filterFrom || filterTo || filterStatus || filterKategori) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterStatus(''); setFilterKategori('') }} style={s.btnSmall}>Reset</button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => window.print()} style={s.btnPrint}>🖨️ Export PDF</button>
          </div>
        </div>
      </div>

      <main style={s.main}>
        {/* Print header */}
        <div style={{ display: 'none' }} className="print-header">
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>
            Rekap {kategoriLabel} — {periodLabel()}
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Memuat data...</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>Belum ada data.</p>
            <a href="/" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>Upload nota →</a>
          </div>
        ) : (
          <>
            {/* Summary per penalangging */}
            <div style={s.summarySection} className="no-print">
              <h3 style={s.sectionTitle}>Posisi per Penalangging</h3>
              <div style={s.penalanggingGrid}>
                {Object.values(summaryPenalangging).map(p => (
                  <div key={p.nama} style={s.penalanggingCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nama}</div>
                        {p.bank && <div style={{ fontSize: 12, color: '#6b7280' }}>{p.bank} · {p.noRek}</div>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{formatRupiah(p.total)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.belum > 0 && <span style={{ ...s.statusPill, color: STATUS_CONFIG.belum.color, background: STATUS_CONFIG.belum.bg, border: `1px solid ${STATUS_CONFIG.belum.border}` }}>Belum: {formatRupiah(p.belum)}</span>}
                      {p.proses > 0 && <span style={{ ...s.statusPill, color: STATUS_CONFIG.proses.color, background: STATUS_CONFIG.proses.bg, border: `1px solid ${STATUS_CONFIG.proses.border}` }}>Proses: {formatRupiah(p.proses)}</span>}
                      {p.selesai > 0 && <span style={{ ...s.statusPill, color: STATUS_CONFIG.selesai.color, background: STATUS_CONFIG.selesai.bg, border: `1px solid ${STATUS_CONFIG.selesai.border}` }}>Selesai: {formatRupiah(p.selesai)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary penalangging untuk print */}
            <div style={{ display: 'none', marginBottom: 20 }} className="print-summary">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Penalangging</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Bank / No. Rek</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Total</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Belum Cair</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Proses</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Sudah Cair</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(summaryPenalangging).map(p => (
                    <tr key={p.nama} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.nama}</td>
                      <td style={{ padding: '6px 8px', color: '#6b7280', fontSize: 10 }}>{p.bank} {p.noRek}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{formatRupiah(p.total)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#991b1b' }}>{p.belum > 0 ? formatRupiah(p.belum) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#92400e' }}>{p.proses > 0 ? formatRupiah(p.proses) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#166534' }}>{p.selesai > 0 ? formatRupiah(p.selesai) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Main table */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>No</th>
                    <th style={s.th}>Tanggal</th>
                    <th style={s.th}>Keterangan</th>
                    <th style={s.th}>Kategori</th>
                    <th style={s.th}>Jumlah</th>
                    <th style={s.th}>Penalangging</th>
                    <th style={s.th}>Status</th>
                    <th style={{ ...s.th, ...s.noprint }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {editId === row.id ? (
                        <>
                          <td style={s.td}>{idx + 1}</td>
                          <td style={s.td}><input type="date" value={editData.tanggal || ''} onChange={e => setEditData(p => ({ ...p, tanggal: e.target.value }))} style={s.editInput} /></td>
                          <td style={s.td}><input value={editData.keterangan || ''} onChange={e => setEditData(p => ({ ...p, keterangan: e.target.value }))} style={s.editInput} /></td>
                          <td style={s.td}>
                            <select value={editData.kategori || 'makan_minum'} onChange={e => setEditData(p => ({ ...p, kategori: e.target.value as Kategori }))} style={s.editInput}>
                              {(Object.entries(KATEGORI_LABEL) as [Kategori, string][]).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                            </select>
                          </td>
                          <td style={s.td}><input type="number" value={editData.jumlah || ''} onChange={e => setEditData(p => ({ ...p, jumlah: Number(e.target.value) }))} style={{ ...s.editInput, width: 90 }} /></td>
                          <td style={s.td}>
                            <input value={editData.dibayar_oleh || ''} onChange={e => setEditData(p => ({ ...p, dibayar_oleh: e.target.value }))} style={{ ...s.editInput, marginBottom: 3 }} placeholder="Nama" />
                            <input value={editData.bank_penalangging || ''} onChange={e => setEditData(p => ({ ...p, bank_penalangging: e.target.value }))} style={{ ...s.editInput, marginBottom: 3 }} placeholder="Bank" />
                            <input value={editData.no_rek_penalangging || ''} onChange={e => setEditData(p => ({ ...p, no_rek_penalangging: e.target.value }))} style={s.editInput} placeholder="No. Rek" />
                          </td>
                          <td style={s.td}>-</td>
                          <td style={{ ...s.td, ...s.noprint, whiteSpace: 'nowrap' }}>
                            <button onClick={saveEdit} disabled={saving} style={s.btnSave}>{saving ? '...' : 'Simpan'}</button>
                            <button onClick={() => setEditId(null)} style={s.btnCancel}>Batal</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={s.td}>{idx + 1}</td>
                          <td style={s.td}>{formatTanggal(row.tanggal)}</td>
                          <td style={{ ...s.td, fontWeight: 500 }}>{row.keterangan}</td>
                          <td style={s.td}>
                            <span style={{ fontSize: 12, padding: '2px 7px', borderRadius: 4, background: row.kategori === 'makan_minum' ? '#fef3c7' : '#ede9fe', color: row.kategori === 'makan_minum' ? '#92400e' : '#5b21b6', fontWeight: 600 }}>
                              {row.kategori === 'makan_minum' ? '🍽️' : '📋'} {KATEGORI_LABEL[row.kategori]}
                            </span>
                          </td>
                          <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRupiah(row.jumlah)}</td>
                          <td style={s.td}>
                            {row.dibayar_oleh ? (
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.dibayar_oleh}</div>
                                {(row.bank_penalangging || row.no_rek_penalangging) && (
                                  <div style={{ fontSize: 11, color: '#6b7280' }}>{row.bank_penalangging} {row.no_rek_penalangging}</div>
                                )}
                              </div>
                            ) : <span style={{ color: '#d1d5db' }}>-</span>}
                          </td>
                          <td style={s.td}>
                            <select value={row.status} onChange={e => updateStatus(row.id, e.target.value as 'belum' | 'proses' | 'selesai')}
                              style={{ ...s.statusSelect, color: STATUS_CONFIG[row.status].color, background: STATUS_CONFIG[row.status].bg, borderColor: STATUS_CONFIG[row.status].border }}>
                              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                            </select>
                          </td>
                          <td style={{ ...s.td, ...s.noprint, whiteSpace: 'nowrap' }}>
                            <button onClick={() => startEdit(row)} style={s.btnEdit}>Edit</button>
                            <button onClick={() => setDeleteId(row.id)} style={s.btnDelete}>Hapus</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#111827' }}>
                    <td colSpan={4} style={{ ...s.td, color: '#fff', fontWeight: 700, textAlign: 'right' }}>TOTAL</td>
                    <td style={{ ...s.td, color: '#f97316', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{formatRupiah(totalAmount)}</td>
                    <td colSpan={2} style={s.td} />
                    <td style={{ ...s.td, ...s.noprint }} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Lampiran */}
            {Object.keys(lampiranMap).length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#374151' }}>Lampiran Nota</h3>
                {data.map((row, idx) => {
                  const urls = lampiranMap[row.id]
                  if (!urls?.length) return null
                  return (
                    <div key={row.id} style={{ marginBottom: 28, pageBreakInside: 'avoid' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                        {idx + 1}. {row.keterangan} — {formatTanggal(row.tanggal)} — {formatRupiah(row.jumlah)}
                        {row.dibayar_oleh && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {row.dibayar_oleh}</span>}
                      </p>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt={`nota ${i + 1}`}
                            style={{ height: 320, maxWidth: 400, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {deleteId && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Hapus transaksi?</h3>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Data dan foto lampiran akan dihapus permanen.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={s.btnCancel}>Batal</button>
              <button onClick={confirmDelete} style={{ ...s.btnDelete, padding: '8px 16px' }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          .print-summary { display: block !important; }
          body { background: white !important; }
          nav { display: none !important; }
        }
      `}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  filterBar: { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 0' },
  dateInput: { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' },
  main: { maxWidth: 1000, margin: '0 auto', padding: '24px 20px 60px' },
  summarySection: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px' },
  penalanggingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 },
  penalanggingCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' },
  statusPill: { fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { background: '#111827', color: '#fff', padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12 },
  td: { padding: '9px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  noprint: {},
  editInput: { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', width: '100%' },
  statusSelect: { padding: '4px 7px', border: '1px solid', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  btnEdit: { background: 'transparent', border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', marginRight: 4 },
  btnDelete: { background: 'transparent', border: '1px solid #fecaca', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit' },
  btnSave: { background: '#f97316', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 },
  btnCancel: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnSmall: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnPrint: { background: '#111827', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
}
