// src/lib/clinics.ts

export type ClinicSlug = 'psique' | 'clinica-b' | 'clinica-c'

export interface ClinicConfig {
    slug: ClinicSlug
    name: string
    subtitle: string
    logoUrl?: string
    primaryColor: string
    primaryDark: string
    clinicId: string // deve bater com user_metadata.clinic_id no Supabase Auth
}

export const CLINICS: Record<ClinicSlug, ClinicConfig> = {
    psique: {
        slug: 'psique',
        name: 'Psique',
        subtitle: 'Unidade BSB',
        logoUrl: 'https://srtyjwpmsveiyugatiqj.supabase.co/storage/v1/object/public/icon/leaves.png',
        primaryColor: '#6B9B7C',
        primaryDark: '#4a7a5b',
        clinicId: 'psique',
    },
    'clinica-b': {
        slug: 'clinica-b',
        name: 'Unidade B',
        subtitle: '...',
        primaryColor: '#6B7CB4',
        primaryDark: '#4a5a9a',
        clinicId: 'clinica-b',
    },
    'clinica-c': {
        slug: 'clinica-c',
        name: 'Unidade C',
        subtitle: '...',
        primaryColor: '#B47C6B',
        primaryDark: '#9a5a4a',
        clinicId: 'clinica-c',
    },
}

export const CLINIC_LIST = Object.values(CLINICS)

export function getClinic(slug: string): ClinicConfig | null {
    return CLINICS[slug as ClinicSlug] ?? null
}