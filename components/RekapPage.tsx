'use client'

import { useState, useEffect, useRef } from 'react'
import Navbar from '@/components/Navbar'
import { createClient, type Transaksi } from '@/lib/supabase'

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatTanggal(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RekapPage({ email }: { email?: string }) {
  const supabase = createClient()
  const [data, setData] = useState<Transaksi[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Transaksi>>({})
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [lampiranMap, setLampiranMap] = useState<Record<string, string[]>>({})
  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('transaksi').select('*, lampiran(*)').order('tanggal', { ascending: true })
    if (filterFrom) q = q.gte('tanggal', filterFrom)
    if (filterTo) q = q.lte('tanggal', filterTo)
    const { data: rows } = await q
    setData(rows || [])

    // Generate signed URLs for lampiran
    const newMap: Record<string, string[]> = {}
    for (const row of (rows || [])) {
      if (row.lampiran?.length) {
        const urls = await Promise.all(
          row.lampiran.map(async (l: { storage_path: string }) => {
            const { data: signed } = await supabase.storage
              .from('lampiran-nota')
              .createSignedUrl(l.storage_path, 3600)
            return signed?.signedUrl || ''
          })
        )
        newMap[row.id] = urls.filter(Boolean)
      }
    }
    setLampiranMap(newMap)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [filterFrom, filterTo])

  const totalAmount = data.reduce((sum, r) => sum + r.jumlah, 0)

  const startEdit = (row: Transaksi) => {
    setEditId(row.id)
    setEditData({ tanggal: row.tanggal, keterangan: row.keterangan, jumlah: row.jumlah, deskripsi: row.deskripsi || '' })
  }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(true)
    await supabase.from('transaksi').update({
      tanggal: editData.tanggal,
      keterangan: editData.keterangan,
      jumlah: Number(editData.jumlah),
      deskripsi: editData.deskripsi,
    }).eq('id', editId)
    setEditId(null)
    setSaving(false)
    fetchData()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    await supabase.from('transaksi').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchData()
  }

  const handlePrint = () => window.print()

  const periodLabel = () => {
    if (filterFrom && filterTo) return `${formatTanggal(filterFrom)} s.d. ${formatTanggal(filterTo)}`
    if (filterFrom) return `Dari ${formatTanggal(filterFrom)}`
    if (filterTo) return `s.d. ${formatTanggal(filterTo)}`
    return 'Semua periode'
  }

  return (
    <div>
      <Navbar email={email} />

      {/* Filter bar */}
      <div style={s.filterBar} className="no-print">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Periode:</span>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={s.dateInput} />
          <span style={{ color: '#9ca3af' }}>s.d.</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={s.dateInput} />
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo('') }} style={s.btnSmall}>Reset</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={s.btnPrint}>🖨️ Export PDF</button>
          </div>
        </div>
      </div>

      <main style={s.main}>
        {/* Print header - hanya muncul saat print */}
        <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>
            Rekap Makan Minum {filterFrom || filterTo ? periodLabel() : ''}
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Memuat data...</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>Belum ada data rekap.</p>
            <a href="/" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>Upload nota sekarang →</a>
          </div>
        ) : (
          <div ref={printRef}>
            {/* Summary */}
            <div style={s.summary} className="no-print">
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Total Transaksi</span>
                <span style={s.summaryValue}>{data.length}</span>
              </div>
              <div style={s.summaryDivider} />
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Total Pengeluaran</span>
                <span style={{ ...s.summaryValue, color: '#ea580c' }}>{formatRupiah(totalAmount)}</span>
              </div>
              <div style={s.summaryDivider} />
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Periode</span>
                <span style={s.summaryValue}>{periodLabel()}</span>
              </div>
            </div>

            {/* Table */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No', 'Tanggal', 'Keterangan', 'Deskripsi', 'Jumlah', 'Aksi'].map(h => (
                      <th key={h} style={{ ...s.th, ...(h === 'Aksi' ? { className: 'no-print' } as React.CSSProperties : {}) }}>{h}</th>
                    ))}
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
                          <td style={s.td}><input value={editData.deskripsi || ''} onChange={e => setEditData(p => ({ ...p, deskripsi: e.target.value }))} style={s.editInput} /></td>
                          <td style={s.td}><input type="number" value={editData.jumlah || ''} onChange={e => setEditData(p => ({ ...p, jumlah: Number(e.target.value) }))} style={{ ...s.editInput, width: 100 }} /></td>
                          <td style={{ ...s.td, whiteSpace: 'nowrap' }} className="no-print">
                            <button onClick={saveEdit} disabled={saving} style={s.btnSave}>{saving ? '...' : 'Simpan'}</button>
                            <button onClick={() => setEditId(null)} style={s.btnCancel}>Batal</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={s.td}>{idx + 1}</td>
                          <td style={s.td}>{formatTanggal(row.tanggal)}</td>
                          <td style={{ ...s.td, fontWeight: 500 }}>{row.keterangan}</td>
                          <td style={{ ...s.td, color: '#6b7280', fontSize: 13 }}>{row.deskripsi || '-'}</td>
                          <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRupiah(row.jumlah)}</td>
                          <td style={{ ...s.td, whiteSpace: 'nowrap' }} className="no-print">
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
                    <td style={s.td} className="no-print" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Lampiran section - untuk print */}
            {Object.keys(lampiranMap).length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#374151' }}>Lampiran Nota</h3>
                {data.map((row, idx) => {
                  const urls = lampiranMap[row.id]
                  if (!urls?.length) return null
                  return (
                    <div key={row.id} style={{ marginBottom: 24, pageBreakInside: 'avoid' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                        {idx + 1}. {row.keterangan} — {formatTanggal(row.tanggal)}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt={`nota ${i + 1}`}
                            style={{ height: 200, maxWidth: 300, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
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
          .print-only { display: block !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  filterBar: { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 0' },
  dateInput: { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' },
  main: { maxWidth: 900, margin: '0 auto', padding: '24px 20px 60px' },
  summary: { display: 'flex', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 24px', marginBottom: 20, gap: 0 },
  summaryItem: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  summaryLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 500 },
  summaryValue: { fontSize: 18, fontWeight: 700, color: '#111827' },
  summaryDivider: { width: 1, background: '#e5e7eb', margin: '0 24px' },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { background: '#111827', color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13 },
  td: { padding: '10px 14px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  editInput: { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', width: '100%' },
  btnEdit: { background: 'transparent', border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', marginRight: 4 },
  btnDelete: { background: 'transparent', border: '1px solid #fecaca', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit' },
  btnSave: { background: '#f97316', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 },
  btnCancel: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnSmall: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
  btnPrint: { background: '#111827', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
}
