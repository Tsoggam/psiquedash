// src/app/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLINIC_LIST, ClinicConfig } from '@/lib/clinics'

export default function ClinicSelectorPage() {
    const router = useRouter()
    const [selecting, setSelecting] = useState<string | null>(null)
    const [leaving, setLeaving] = useState(false)

    async function handleSelect(clinic: ClinicConfig) {
        if (selecting) return
        setSelecting(clinic.slug)
        await new Promise(r => setTimeout(r, 250))  // card anima
        setLeaving(true)
        await new Promise(r => setTimeout(r, 380))  // fade-out da página
        router.push(`/login/${clinic.slug}`)
    }

    return (
        <div className={`cs-root${leaving ? ' cs-leaving' : ''}`}>
            <div className="cs-left">
                <div className="cs-left-content">
                    <div className="cs-logo">
                        <div className="cs-brand-icon">
                            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.137.562 4.14 1.544 5.872L0 24l6.306-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="cs-brand-name">WhatsApp</div>
                            <div className="cs-brand-sub"> - Psique</div>
                        </div>
                    </div>

                    <div className="cs-hero">
                        <h1 className="cs-hero-title">
                            Selecione<br />
                            <span>sua unidade</span>
                        </h1>
                        <p className="cs-hero-sub">
                            Painel de atendimento.
                        </p>
                    </div>
                </div>

                <div className="cs-orb cs-orb-1" />
                <div className="cs-orb cs-orb-2" />
            </div>

            <div className="cs-right">
                <div className="cs-form-wrap">
                    <div className="cs-header">
                        <h2 className="cs-title">Qual é a sua unidade?</h2>
                    </div>

                    <div className="cs-cards">
                        {CLINIC_LIST.map((clinic) => (
                            <button
                                key={clinic.slug}
                                className={`cs-card${selecting === clinic.slug ? ' cs-card-selected' : ''}${selecting && selecting !== clinic.slug ? ' cs-card-dimmed' : ''}`}
                                onClick={() => handleSelect(clinic)}
                                disabled={!!selecting}
                                style={{ '--clinic-color': clinic.primaryColor } as React.CSSProperties}
                            >
                                <div className="cs-card-icon">
                                    {clinic.logoUrl ? (
                                        <img src={clinic.logoUrl} alt={clinic.name} width={28} height={28} style={{ objectFit: 'contain' }} />
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="cs-card-info">
                                    <span className="cs-card-name">{clinic.name}</span>
                                    <span className="cs-card-sub">{clinic.subtitle}</span>
                                </div>
                                {selecting === clinic.slug ? (
                                    <span className="cs-card-spinner" />
                                ) : (
                                    <svg className="cs-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}