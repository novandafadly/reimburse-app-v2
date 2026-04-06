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
// Pisahkan map untuk nota dan evidence
type LampiranMap = Record<string, string[]>
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
  const [notaMap, setNotaMap] = useState<LampiranMap>({})
  const [evidenceMap, setEvidenceMap] = useState<LampiranMap>({})
  const [showFilters, setShowFilters] = useState(false)
  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('transaksi').select('*, lampiran(*)').order('tanggal', { ascending: true })
    if (filterFrom) q = q.gte('tanggal', filterFrom)
    if (filterTo) q = q.lte('tanggal', filterTo)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterKategori) q = q.eq('kategori', filterKategori)
    const { data: rows } = await q
    setData(rows || [])
    const newNotaMap: LampiranMap = {}
    const newEvidenceMap: LampiranMap = {}
    for (const row of (rows || [])) {
      if (row.lampiran?.length) {
        const notaLampiran = row.lampiran.filter((l: { jenis: string }) => l.jenis !== 'evidence_rapat')
        const evidenceLampiran = row.lampiran.filter((l: { jenis: string }) => l.jenis === 'evidence_rapat')
        if (notaLampiran.length) {
          const urls = await Promise.all(
            notaLampiran.map(async (l: { storage_path: string }) => {
              const { data: signed } = await supabase.storage.from('lampiran-nota').createSignedUrl(l.storage_path, 3600)
              return signed?.signedUrl || ''
            })
          )
          newNotaMap[row.id] = urls.filter(Boolean)
        }
        if (evidenceLampiran.length) {
          const urls = await Promise.all(
            evidenceLampiran.map(async (l: { storage_path: string }) => {
              const { data: signed } = await supabase.storage.from('lampiran-nota').createSignedUrl(l.storage_path, 3600)
              return signed?.signedUrl || ''
            })
          )
          newEvidenceMap[row.id] = urls.filter(Boolean)
        }
      }
    }
    setNotaMap(newNotaMap)
    setEvidenceMap(newEvidenceMap)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [filterFrom, filterTo, filterStatus, filterKategori])
  const totalAmount = data.reduce((sum, r) => sum + r.jumlah, 0)
  const hasFilter = filterFrom || filterTo || filterStatus || filterKategori
  const updateStatus = async (id: string, status: 'belum' | 'proses' | 'selesai') => {
    await supabase.from('transaksi').update({ status }).eq('id', id)
    setData(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }
  const startEdit = (row: Transaksi) => {
    setEditId(row.id)
    setEditData({
      tanggal: row.tanggal, keterangan: row.keterangan, jumlah: row.jumlah,
      deskripsi: row.deskripsi || '', dibayar_oleh: row.dibayar_oleh || '',
      bank_penalangging: row.bank_penalangging || '',
      no_rek_penalangging: row.no_rek_penalangging || '',
      kategori: row.kategori
    })
  }
  const saveEdit = async () => {
    if (!editId) return
    setSaving(true)
    await supabase.from('transaksi').update({
      tanggal: editData.tanggal, keterangan: editData.keterangan,
      jumlah: Number(editData.jumlah), deskripsi: editData.deskripsi,
      dibayar_oleh: editData.dibayar_oleh,
      bank_penalangging: editData.bank_penalangging,
      no_rek_penalangging: editData.no_rek_penalangging,
      kategori: editData.kategori,
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
  // Cek apakah ada data rapat yang punya evidence
  const hasEvidence = data.some(row => row.kategori === 'rapat_pertemuan' && (evidenceMap[row.id]?.length ?? 0) > 0)
  return (
    <div>
      <Navbar email={email} />
      {/* Filter bar */}
      <div style={s.filterBar} className="no-print">
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48 }}>
            <button onClick={() => setShowFilters(p => !p)} style={{ ...s.btnSmall, display: 'flex', alignItems: 'center', gap: 4 }}>
              🔍 Filter {hasFilter ? '●' : ''}
            </button>
            {hasFilter && (
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterStatus(''); setFilterKategori('') }} style={s.btnSmall}>
                Reset
              </button>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => window.print()} style={s.btnPrint}>🖨️ Export PDF</button>
            </div>
          </div>
          {showFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 260px' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Dari</span>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...s.dateInput, flex: 1 }} />
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>s.d.</span>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...s.dateInput, flex: 1 }} />
              </div>
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
            </div>
          )}
        </div>
      </div>
      <main style={s.main}>
        {/* Print header */}
        <div style={{ display: 'none' }} className="print-header">
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>Rekap {kategoriLabel}</h2>
          <p style={{ textAlign: 'center', fontSize: 12, margin: '0 0 16px', color: '#374151' }}>{periodLabel()}</p>
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
            {/* Total summary (screen only) */}
            <div style={s.totalBar} className="no-print">
              <span style={{ fontSize: 13, color: '#6b7280' }}>{data.length} transaksi</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#ea580c' }}>{formatRupiah(totalAmount)}</span>
            </div>

            {/* ─── EVIDENCE SECTION: tampil sebelum rekap, di print & screen ─── */}
            {hasEvidence && (
              <div style={{ marginBottom: 28 }}>
                {/* Label section — screen */}
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#374151' }} className="no-print">
                  📎 Evidence Rapat & Pertemuan
                </h3>
                {/* Label section — print */}
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151', display: 'none' }} className="print-evidence-header">
                  Lampiran Evidence Rapat &amp; Pertemuan
                </h3>
                {data.map((row, idx) => {
                  if (row.kategori !== 'rapat_pertemuan') return null
                  const urls = evidenceMap[row.id]
                  if (!urls?.length) return null
                  return (
                    <div key={row.id} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                        {idx + 1}. {row.keterangan} — {formatTanggal(row.tanggal)} — {formatRupiah(row.jumlah)}
                      </p>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: urls.length === 1 ? '1fr' : '1fr 1fr',
                        gap: 8, width: '100%'
                      }}>
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt={`evidence ${i + 1}`}
                            style={{ width: '100%', height: 'auto', maxHeight: 320, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa' }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* Divider sebelum rekap tabel */}
                <div style={{ borderTop: '2px solid #e5e7eb', marginTop: 8 }} />
              </div>
            )}

            {/* ─── REKAP TABLE ─── */}
            <div style={s.tableWrap}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>No</th>
                      <th style={s.th}>Tanggal</th>
                      <th style={s.th}>Keterangan</th>
                      <th style={{ ...s.th }} className="screen-only">Kategori</th>
                      <th style={s.th}>Jumlah</th>
                      <th style={s.th} className="screen-only">Staf</th>
                      <th style={s.th} className="screen-only">Status</th>
                      <th style={s.th} className="no-print">Aksi</th>
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
                            <td style={s.td} className="screen-only">
                              <select value={editData.kategori || 'makan_minum'} onChange={e => setEditData(p => ({ ...p, kategori: e.target.value as Kategori }))} style={s.editInput}>
                                {(Object.entries(KATEGORI_LABEL) as [Kategori, string][]).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                              </select>
                            </td>
                            <td style={s.td}><input type="number" value={editData.jumlah || ''} onChange={e => setEditData(p => ({ ...p, jumlah: Number(e.target.value) }))} style={{ ...s.editInput, width: 90 }} /></td>
                            <td style={s.td} className="screen-only">
                              <input value={editData.dibayar_oleh || ''} onChange={e => setEditData(p => ({ ...p, dibayar_oleh: e.target.value }))} style={{ ...s.editInput, marginBottom: 3 }} placeholder="Nama" />
                              <input value={editData.bank_penalangging || ''} onChange={e => setEditData(p => ({ ...p, bank_penalangging: e.target.value }))} style={{ ...s.editInput, marginBottom: 3 }} placeholder="Bank" />
                              <input value={editData.no_rek_penalangging || ''} onChange={e => setEditData(p => ({ ...p, no_rek_penalangging: e.target.value }))} style={s.editInput} placeholder="No. Rek" />
                            </td>
                            <td style={s.td} className="screen-only">-</td>
                            <td style={s.td} className="no-print">
                              <button onClick={saveEdit} disabled={saving} style={s.btnSave}>{saving ? '...' : 'Simpan'}</button>
                              <button onClick={() => setEditId(null)} style={s.btnCancel}>Batal</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={s.td}>{idx + 1}</td>
                            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{formatTanggal(row.tanggal)}</td>
                            <td style={{ ...s.td, fontWeight: 500, minWidth: 120 }}>
                              {row.keterangan}
                              {/* Badge evidence di kolom keterangan (screen only) */}
                              {row.kategori === 'rapat_pertemuan' && (evidenceMap[row.id]?.length ?? 0) > 0 && (
                                <span className="no-print" style={{ marginLeft: 6, fontSize: 10, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 4, padding: '1px 5px', fontWeight: 600, verticalAlign: 'middle' }}>
                                  {evidenceMap[row.id].length} evidence
                                </span>
                              )}
                            </td>
                            <td style={s.td} className="screen-only">
                              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: row.kategori === 'makan_minum' ? '#fef3c7' : '#ede9fe', color: row.kategori === 'makan_minum' ? '#92400e' : '#5b21b6', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {row.kategori === 'makan_minum' ? '🍽️' : '📋'} {KATEGORI_LABEL[row.kategori]}
                              </span>
                            </td>
                            <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRupiah(row.jumlah)}</td>
                            <td style={s.td} className="screen-only">
                              {row.dibayar_oleh ? (
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.dibayar_oleh}</div>
                                  {(row.bank_penalangging || row.no_rek_penalangging) && (
                                    <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{row.bank_penalangging} {row.no_rek_penalangging}</div>
                                  )}
                                </div>
                              ) : <span style={{ color: '#d1d5db' }}>-</span>}
                            </td>
                            <td style={s.td} className="screen-only">
                              <select value={row.status} onChange={e => updateStatus(row.id, e.target.value as 'belum' | 'proses' | 'selesai')}
                                style={{ ...s.statusSelect, color: STATUS_CONFIG[row.status].color, background: STATUS_CONFIG[row.status].bg, borderColor: STATUS_CONFIG[row.status].border }}>
                                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                              </select>
                            </td>
                            <td style={{ ...s.td, whiteSpace: 'nowrap' }} className="no-print">
                              <button onClick={() => startEdit(row)} style={s.btnEdit}>Edit</button>
                              <button onClick={() => setDeleteId(row.id)} style={s.btnDelete}>✕</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#111827' }}>
                      <td colSpan={3} style={{ ...s.td, color: '#fff', fontWeight: 700, textAlign: 'right' }}>TOTAL</td>
                      <td style={s.td} className="screen-only" />
                      <td style={{ ...s.td, color: '#f97316', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiah(totalAmount)}</td>
                      <td colSpan={2} style={s.td} className="screen-only" />
                      <td style={s.td} className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ─── LAMPIRAN NOTA (setelah rekap) ─── */}
            {Object.keys(notaMap).length > 0 && (
              <div style={{ marginTop: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#374151' }} className="no-print">Lampiran Nota</h3>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151', display: 'none' }} className="print-nota-header">
                  Lampiran Nota
                </h3>
                {data.map((row, idx) => {
                  const urls = notaMap[row.id]
                  if (!urls?.length) return null
                  return (
                    <div key={row.id} style={{ marginBottom: 28, pageBreakInside: 'avoid' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                        {idx + 1}. {row.keterangan} — {formatTanggal(row.tanggal)} — {formatRupiah(row.jumlah)}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: urls.length === 1 ? '1fr' : '1fr 1fr', gap: 8, width: '100%' }}>
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt={`nota ${i + 1}`}
                            style={{ width: '100%', height: 'auto', maxHeight: 380, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa' }} />
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
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Data dan foto akan dihapus permanen.</p>
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
          .print-evidence-header { display: block !important; }
          .print-nota-header { display: block !important; }
          .screen-only { display: none !important; }
          body { background: white !important; }
          nav { display: none !important; }
        }
        @media screen {
          .print-header { display: none !important; }
          .print-evidence-header { display: none !important; }
          .print-nota-header { display: none !important; }
        }
      `}</style>
    </div>
  )
}
const s: Record<string, React.CSSProperties> = {
  filterBar: { background: '#fff', borderBottom: '1px solid #e5e7eb' },
  dateInput: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', flex: '1 1 140px', minWidth: 120 },
  main: { maxWidth: 1000, margin: '0 auto', padding: '16px 16px 60px' },
  totalBar: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 },
  th: { background: '#111827', color: '#fff', padding: '10px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  editInput: { padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', width: '100%' },
  statusSelect: { padding: '4px 6px', border: '1px solid', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 },
  btnEdit: { background: 'transparent', border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', marginRight: 4 },
  btnDelete: { background: 'transparent', border: '1px solid #fecaca', borderRadius: 5, padding: '4px 7px', fontSize: 12, cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit' },
  btnSave: { background: '#f97316', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 },
  btnCancel: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnSmall: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnPrint: { background: '#111827', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
}
