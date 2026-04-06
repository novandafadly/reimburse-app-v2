export interface ParsedNota {
  tanggal: string
  keterangan: string
  jumlah: number
  deskripsi: string
  confidence: 'high' | 'medium' | 'low'
  catatan?: string
}

export interface NotaEntry {
  id: string
  files: File[]
  previews: string[]
  evidenceFiles?: File[]
  evidencePreviews?: string[]
  status: 'idle' | 'parsing' | 'done' | 'error'
  parsed?: ParsedNota
  edited?: Partial<ParsedNota>
  errorMsg?: string
}
