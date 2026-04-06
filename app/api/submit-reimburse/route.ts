import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const formData = await req.formData()
    const entriesRaw = formData.get('entries') as string
    const entries = JSON.parse(entriesRaw)
    const results = []
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const files = formData.getAll(`files_${i}`) as File[]
      const evidenceFiles = formData.getAll(`evidence_${i}`) as File[]
      const { data: transaksi, error: tErr } = await supabase
        .from('transaksi')
        .insert({
          tanggal: entry.tanggal.split('/').reverse().join('-'),
          keterangan: entry.keterangan,
          jumlah: Number(entry.jumlah),
          deskripsi: entry.deskripsi,
          submitted_by: user.email,
          dibayar_oleh: entry.dibayar_oleh || null,
          bank_penalangging: entry.bank_penalangging || null,
          no_rek_penalangging: entry.no_rek_penalangging || null,
          kategori: entry.kategori || 'makan_minum',
          status: 'belum',
        })
        .select()
        .single()
      if (tErr) throw new Error(`Gagal simpan transaksi: ${tErr.message}`)
      // Upload nota files (jenis: 'nota')
      const lampiranRows: { transaksi_id: string; storage_path: string; jenis: string }[] = []
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi]
        const bytes = await file.arrayBuffer()
        const path = `${user.id}/${transaksi.id}/${transaksi.id}_${fi + 1}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('lampiran-nota')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
        if (uploadErr) console.error('Upload nota error:', uploadErr)
        else lampiranRows.push({ transaksi_id: transaksi.id, storage_path: path, jenis: 'nota' })
      }
      // Upload evidence files (jenis: 'evidence_rapat')
      for (let ei = 0; ei < evidenceFiles.length; ei++) {
        const file = evidenceFiles[ei]
        const bytes = await file.arrayBuffer()
        const path = `${user.id}/${transaksi.id}/evidence_${ei + 1}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('lampiran-nota')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
        if (uploadErr) console.error('Upload evidence error:', uploadErr)
        else lampiranRows.push({ transaksi_id: transaksi.id, storage_path: path, jenis: 'evidence_rapat' })
      }
      if (lampiranRows.length > 0) {
        await supabase.from('lampiran').insert(lampiranRows)
      }
      results.push({ id: transaksi.id, notaCount: files.length, evidenceCount: evidenceFiles.length })
    }
    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Submit error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gagal submit: ${msg}` }, { status: 500 })
  }
}
