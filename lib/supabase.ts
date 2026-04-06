import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Profile = {
  id: string
  nama: string | null
  bank: string | null
  no_rekening: string | null
}

export type Staf = {
  id: string
  nama: string
  bank: string
  no_rekening: string
  aktif: boolean
}

export type Kategori = 'makan_minum' | 'rapat_pertemuan'

export const KATEGORI_LABEL: Record<Kategori, string> = {
  makan_minum: 'Makan & Minum',
  rapat_pertemuan: 'Rapat & Pertemuan',
}

export type Lampiran = {
  id: string
  transaksi_id: string
  storage_path: string
  created_at: string
  jenis: 'nota' | 'evidence_rapat'
}

export type Transaksi = {
  id: string
  tanggal: string
  keterangan: string
  jumlah: number
  deskripsi: string | null
  submitted_by: string | null
  submitted_at: string
  created_at: string
  dibayar_oleh: string | null
  bank_penalangging: string | null
  no_rek_penalangging: string | null
  status: 'belum' | 'proses' | 'selesai'
  kategori: Kategori
  lampiran?: Lampiran[]
}
