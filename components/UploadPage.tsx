'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { createClient, type Staf, type Kategori, KATEGORI_LABEL } from '@/lib/supabase'
import type { NotaEntry, ParsedNota } from '@/lib/types'

function generateId() { return Math.random().toString(36).slice(2, 9) }
function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

async function compressImage(file: File, maxWidthPx = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(new File([blob!], file.name, { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.src = url
  })
}

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; color: string }> = {
    high: { label: 'Akurat', color: '#166534' },
    medium: { label: 'Perlu cek', color: '#92400e' },
    low: { label: 'Kurang jelas', color: '#991b1b' },
  }
  const { label, color } = map[level] || map.medium
  return <span style={{ fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 7px', background: color + '12' }}>{label}</span>
}

export default function UploadPage({ email }: { email?: string }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<NotaEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [stafList, setStafList] = useState<Staf[]>([])
  const [selectedStaf, setSelectedStaf] = useState<string>('')
  const [kategori, setKategori] = useState<Kategori>('makan_minum')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('penalangging').select('*').eq('aktif', true).order('nama')
      .then(({ data }) => { if (data) setStafList(data) })
  }, [])

  const selectedInfo = stafList.find(p => p.id === selectedStaf)

  const addEntry = useCallback(async (files: File[]) => {
    if (!files.length) return
    const compressed = await Promise.all(files.map(f => compressImage(f)))
    const entry: NotaEntry = {
      id: generateId(),
      files: compressed,
      previews: compressed.map(f => URL.createObjectURL(f)),
      status: 'idle'
    }
    setEntries(prev => [...prev, entry])
    parseEntry(entry)
  }, [])

  const parseEntry = async (entry: NotaEntry) => {
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'parsing' } : e))
    const form = new FormData()
    entry.files.forEach(f => form.append('files', f))
    try {
      const res = await fetch('/api/parse-nota', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json.data) {
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', errorMsg: json.error || 'Gagal parse' } : e))
        return
      }
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done', parsed: json.data, edited: json.data } : e))
    } catch {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', errorMsg: 'Network error' } : e))
    }
  }

  const updateField = (id: string, field: keyof ParsedNota, value: string | number) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, edited: { ...e.edited, [field]: value } } : e))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) addEntry(files)
  }, [addEntry])

  const totalAmount = entries.filter(e => e.status === 'done').reduce((sum, e) => sum + (Number(e.edited?.jumlah) || 0), 0)
  const allDone = entries.length > 0 && entries.every(e => e.status === 'done' || e.status === 'error')
  const hasValid = entries.some(e => e.status === 'done')

  const handleSubmit = async () => {
    if (!hasValid) return
    setSubmitting(true); setSubmitError('')
    const formData = new FormData()
    const payload = entries.filter(e => e.status === 'done').map((e, i) => {
      e.files.forEach(f => formData.append(`files_${i}`, f))
      return {
        tanggal: e.edited?.tanggal || '',
        keterangan: e.edited?.keterangan || '',
        jumlah: Number(e.edited?.jumlah) || 0,
        deskripsi: e.edited?.deskripsi || '',
        fileCount: e.files.length,
        kategori,
        dibayar_oleh: selectedInfo?.nama || null,
        bank_penalangging: selectedInfo?.bank || null,
        no_rek_penalangging: selectedInfo?.no_rekening || null,
      }
    })
    formData.append('entries', JSON.stringify(payload))
    try {
      const res = await fetch('/api/submit-reimburse', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSubmitted(true)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal submit')
    } finally { setSubmitting(false) }
  }

  if (submitted) return (
    <div>
      <Navbar email={email} />
      <main style={s.main}>
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontSize: 26, marginBottom: 8, color: '#166534' }}>Berhasil disimpan!</h2>
          <p style={{ color: '#6b7280', marginBottom: 4 }}>{entries.filter(e => e.status === 'done').length} nota · {formatRupiah(totalAmount)}</p>
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>
            Kategori: {KATEGORI_LABEL[kategori]} · Dibayar: {selectedInfo?.nama || '-'}
          </p>
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 32 }}>Data & foto sudah tersimpan.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => { setEntries([]); setSubmitted(false) }} style={s.btnSecondary}>Upload lagi</button>
            <button onClick={() => window.location.href = '/rekap'} style={s.btnPrimary}>Lihat Rekap →</button>
          </div>
        </div>
      </main>
    </div>
  )

  return (
    <div>
      <Navbar email={email} />
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.title}>Upload Nota</h1>
            <p style={s.subtitle}>Upload foto → AI parse otomatis → Tersimpan ke database</p>
          </div>
          {entries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{formatRupiah(totalAmount)}</span>
            </div>
          )}
        </header>

        {/* Pengaturan submit */}
        <div style={s.settingCard}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={s.fieldLabel}>Kategori</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(Object.entries(KATEGORI_LABEL) as [Kategori, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => setKategori(val)}
                    style={{ ...s.toggleBtn, ...(kategori === val ? s.toggleBtnActive : {}) }}>
                    {val === 'makan_minum' ? '🍽️' : '📋'} {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={s.fieldLabel}>Dibayar oleh (Staf)</label>
              <select value={selectedStaf} onChange={e => setSelectedStaf(e.target.value)} style={s.select}>
                <option value="">-- Pilih staf --</option>
                {stafList.map(p => (
                  <option key={p.id} value={p.id}>{p.nama} · {p.bank} {p.no_rekening}</option>
                ))}
              </select>
              {selectedInfo && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                  {selectedInfo.bank} · {selectedInfo.no_rekening}
                </p>
              )}
            </div>
          </div>
        </div>

        <div ref={dropRef} onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          style={{ ...s.dropzone, ...(dragging ? s.dropzoneActive : {}) }}
          onClick={() => document.getElementById('fileInput')?.click()}>
          <input id="fileInput" type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { const f = Array.from(e.target.files || []); if (f.length) addEntry(f); e.target.value = '' }} />
          <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Drop nota di sini atau klik untuk pilih</p>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Pilih beberapa file sekaligus untuk 1 transaksi</p>
        </div>

        {entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entries.map((entry, idx) => (
              <EntryCard key={entry.id} entry={entry} index={idx + 1}
                onUpdate={updateField}
                onRemove={id => setEntries(prev => prev.filter(e => e.id !== id))}
                onRetry={() => parseEntry(entry)} />
            ))}
          </div>
        )}

        {allDone && hasValid && (
          <div style={s.submitBar}>
            <div>
              <span style={{ fontWeight: 600 }}>{entries.filter(e => e.status === 'done').length} nota</span>
              <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>
                {KATEGORI_LABEL[kategori]} · {selectedInfo?.nama || <span style={{ color: '#ef4444' }}>pilih staf</span>}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{formatRupiah(totalAmount)}</span>
              <button onClick={handleSubmit} disabled={submitting || !selectedStaf}
                style={{ ...s.btnPrimary, opacity: submitting || !selectedStaf ? 0.5 : 1 }}>
                {submitting ? 'Menyimpan...' : 'Simpan →'}
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#991b1b', fontSize: 14 }}>
            ⚠️ {submitError}
          </div>
        )}
      </main>
    </div>
  )
}

function EntryCard({ entry, index, onUpdate, onRemove, onRetry }: {
  entry: NotaEntry; index: number
  onUpdate: (id: string, field: keyof ParsedNota, value: string | number) => void
  onRemove: (id: string) => void; onRetry: () => void
}) {
  const [showPreviews, setShowPreviews] = useState(false)
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.indexBadge}>#{index}</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{entry.files.length} file{entry.files.length > 1 ? 's' : ''}</span>
          {entry.parsed && <ConfidenceBadge level={entry.parsed.confidence} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPreviews(p => !p)} style={s.btnSmall}>{showPreviews ? 'Sembunyikan' : 'Lihat foto'}</button>
          <button onClick={() => onRemove(entry.id)} style={{ ...s.btnSmall, color: '#ef4444' }}>Hapus</button>
        </div>
      </div>
      {showPreviews && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 8px' }}>
          {entry.previews.map((src, i) => <img key={i} src={src} alt={`nota ${i + 1}`} style={{ height: 140, borderRadius: 6, border: '1px solid #e5e7eb', flexShrink: 0 }} />)}
        </div>
      )}
      {entry.status === 'parsing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 14, padding: '8px 0' }}>
          <div style={s.spinner} /><span>Membaca nota...</span>
        </div>
      )}
      {entry.status === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <span style={{ color: '#ef4444', fontSize: 14 }}>⚠️ {entry.errorMsg}</span>
          <button onClick={onRetry} style={s.btnSmall}>Coba lagi</button>
        </div>
      )}
      {entry.status === 'done' && entry.edited && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {([
            { label: 'Tanggal', field: 'tanggal', placeholder: 'DD/MM/YYYY' },
            { label: 'Keterangan', field: 'keterangan', placeholder: 'Nama restoran/tempat' },
            { label: 'Jumlah (Rp)', field: 'jumlah', placeholder: '125000' },
          ] as { label: string; field: keyof ParsedNota; placeholder: string }[]).map(({ label, field, placeholder }) => (
            <div key={field}>
              <label style={s.fieldLabel}>{label}</label>
              <input value={String(entry.edited?.[field] || '')}
                onChange={e => onUpdate(entry.id, field, field === 'jumlah' ? Number(e.target.value.replace(/\D/g, '')) : e.target.value)}
                placeholder={placeholder} style={s.fieldInput} />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={s.fieldLabel}>Deskripsi</label>
            <input value={entry.edited?.deskripsi || ''} onChange={e => onUpdate(entry.id, 'deskripsi', e.target.value)} placeholder="Detail pesanan" style={s.fieldInput} />
          </div>
          {entry.edited?.catatan && (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '6px 10px' }}>
              💡 {entry.edited.catatan}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px', display: 'flex', flexDirection: 'column', gap: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '4px 0 0' },
  settingCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' },
  toggleBtn: { flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f9fafb', color: '#6b7280', fontFamily: 'inherit', fontWeight: 500 },
  toggleBtnActive: { background: '#fff7ed', borderColor: '#f97316', color: '#ea580c', fontWeight: 700 },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fafafa' },
  dropzone: { border: '2px dashed #d1d5db', borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb', transition: 'all 0.15s' },
  dropzoneActive: { borderColor: '#f97316', background: '#fff7ed' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  indexBadge: { background: '#111827', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
  fieldLabel: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  fieldInput: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fafafa' },
  spinner: { width: 16, height: 16, border: '2px solid #e5e7eb', borderTop: '2px solid #f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  submitBar: { position: 'sticky', bottom: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  btnPrimary: { background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
}
