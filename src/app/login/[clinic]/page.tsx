// src/app/login/[clinic]/page.tsx
'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getClinic } from '@/lib/clinics'

export default function LoginPage() {
  const params = useParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const clinicData = getClinic(params.clinic as string)
  if (!clinicData) notFound()
  const clinic = clinicData!

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    const userClinicId = data.user.user_metadata?.clinic_id
    if (userClinicId && userClinicId !== clinic.clinicId) {
      await supabase.auth.signOut()
      setError('Acesso não autorizado para esta clínica.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="lp-root"
      style={{
        '--lp-primary': clinic.primaryColor,
        '--lp-dark': clinic.primaryDark,
      } as React.CSSProperties}
    >
      <div className="lp-left">
        <div className="lp-left-content">
          <div className="lp-logo">
            <div className="lp-brand-icon">
              {clinic.logoUrl ? (
                <img src={clinic.logoUrl} alt={clinic.name} width={24} height={24} style={{ objectFit: 'contain' }} />
              ) : (
                <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.137.562 4.14 1.544 5.872L0 24l6.306-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                </svg>
              )}
            </div>
            <div>
              <div className="lp-brand-name">WhatsApp</div>
              <div className="lp-brand-sub">{clinic.name}</div>
            </div>
          </div>

          <div className="lp-hero">
            <h1 className="lp-hero-title">
              Atendimento<br />
            </h1>
          </div>

          <div className="lp-stats">
            <div className="lp-stat">
              <span className="lp-stat-num">IA</span>
              <span className="lp-stat-label">Triagem automática.</span>
            </div>
            <div className="lp-stat-divider" />
            <div className="lp-stat">
              <span className="lp-stat-num">24h</span>
              <span className="lp-stat-label">Sempre disponível.</span>
            </div>
            <div className="lp-stat-divider" />
            <div className="lp-stat">
              <span className="lp-stat-num">Real</span>
              <span className="lp-stat-label">Tempo real.</span>
            </div>
          </div>
        </div>

        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
      </div>

      <div className="lp-right">
        <div className="lp-form-wrap">
          <button className="lp-back" onClick={() => router.push('/')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Voltar
          </button>

          <div className="lp-form-header">
            <h2 className="lp-form-title">Entrar</h2>
            <p className="lp-form-clinic">{clinic.name} · {clinic.subtitle}</p>
          </div>

          <form onSubmit={handleLogin} className="lp-form">
            <div className="lp-field">
              <label className="lp-label">Email</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  className="lp-input"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  placeholder="operador@clinica.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label">Senha</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input lp-input-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="lp-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? (
                <span className="lp-spinner" />
              ) : (
                <>
                  Entrar no painel
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}