'use client'

import Link from 'next/link'
import { usePathname } from "next/navigation"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['admin@psique.com', 'rosanne@psique.com', 'anapaula@psique.com', 'cleiton@psique.com']

export default function Sidebar() {
    const pathname = usePathname()
    const [loggingOut, setLoggingOut] = useState(false)
    const [userEmail, setUserEmail] = useState<string | null>(null)

    // Report modal
    const [reportOpen, setReportOpen] = useState(false)
    const [reportType, setReportType] = useState<'bug' | 'melhoria'>('bug')
    const [reportDesc, setReportDesc] = useState('')
    const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email ?? null)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserEmail(session?.user?.email ?? null)
        })
        return () => subscription.unsubscribe()
    }, [])

    if (pathname === '/' || pathname.startsWith('/login')) return null

    const isAdmin = !!userEmail && ADMIN_EMAILS.includes(userEmail)

    const links = [
        {
            href: '/dashboard', label: 'CONVERSAS', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            )
        },
        {
            href: '/dashboard/contacts', label: 'CONTATOS', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            )
        },
        ...(isAdmin ? [{
            href: '/dashboard/admin',
            label: 'RELATÓRIOS',
            icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            ),
        }] : []),
    ]

    async function handleLogout() {
        setLoggingOut(true)
        await supabase.auth.signOut()
        window.location.replace('/')
    }

    function handleReportClose() {
        setReportOpen(false)
        setReportDesc('')
        setReportStatus('idle')
        setReportType('bug')
    }

    async function handleReportSubmit() {
        if (!reportDesc.trim() || reportStatus === 'sending') return
        setReportStatus('sending')
        try {
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: reportType, description: reportDesc, operator: userEmail }),
            })
            if (!res.ok) throw new Error()
            setReportStatus('done')
            setTimeout(handleReportClose, 1800)
        } catch {
            setReportStatus('error')
        }
    }

    return (
        <>
            <aside className="app-sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">
                        <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                        </svg>
                    </div>
                    <div>
                        <div className="brand-name">Whatsapp</div>
                        <div className="brand-sub">Psique</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {links.map(link => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{link.icon}</span>
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </nav>

                {userEmail && (
                    <div style={{
                        padding: '8px 16px',
                        marginBottom: '8px',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {isAdmin && (
                            <span style={{
                                display: 'inline-block',
                                background: 'rgba(212,172,13,0.2)',
                                color: '#D4AC0D',
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                letterSpacing: '0.5px',
                            }}>
                                ADMIN
                            </span>
                        )}
                        <div>{userEmail}</div>
                    </div>
                )}

                {/* Botões inferiores: report + sair */}
                <div className="nav-bottom-actions">
                    <button
                        onClick={() => setReportOpen(true)}
                        title="Reportar bug ou sugestão"
                        className="nav-report-btn"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </button>

                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="nav-logout"
                    >
                        {loggingOut ? (
                            <span className="nav-logout-spinner" />
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        )}
                        <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>
                    </button>
                </div>
            </aside>

            {/* Modal de report */}
            {reportOpen && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) handleReportClose() }}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                    }}
                >
                    <div style={{
                        background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 440,
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1px solid var(--border)', overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>Feedback</p>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-gray)' }}>{userEmail}</p>
                            </div>
                            <button onClick={handleReportClose} style={{
                                width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 8,
                                background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--text-gray)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>×</button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['bug', 'melhoria'] as const).map(t => (
                                    <button key={t} onClick={() => setReportType(t)} style={{
                                        flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                                        border: '1.5px solid', fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s',
                                        borderColor: reportType === t ? 'var(--primary)' : 'var(--border)',
                                        background: reportType === t ? 'var(--primary-light)' : 'transparent',
                                        color: reportType === t ? 'var(--primary-dark)' : 'var(--text-gray)',
                                        fontWeight: reportType === t ? 600 : 400,
                                    }}>
                                        {t === 'bug' ? 'Bug' : 'Melhoria'}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-gray)' }}>
                                    {reportType === 'bug' ? 'O que aconteceu? Em qual tela?' : 'O que melhoraria seu fluxo?'}
                                </label>
                                <textarea
                                    rows={5}
                                    value={reportDesc}
                                    onChange={e => setReportDesc(e.target.value)}
                                    placeholder={reportType === 'bug'
                                        ? 'Ex: Ao clicar em enviar arquivo, a mensagem não aparece...'
                                        : 'Ex: Seria útil filtrar chats por data de abertura...'
                                    }
                                    style={{
                                        resize: 'vertical', padding: '12px 14px', borderRadius: 10,
                                        border: '1.5px solid var(--border)', background: 'var(--bg-lighter)',
                                        color: 'var(--text-dark)', fontFamily: 'Inter, inherit', fontSize: 13,
                                        lineHeight: 1.6, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                                    }}
                                    onFocus={e => {
                                        e.currentTarget.style.borderColor = 'var(--primary)'
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,155,124,0.12)'
                                        e.currentTarget.style.background = 'var(--white)'
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.style.borderColor = 'var(--border)'
                                        e.currentTarget.style.boxShadow = 'none'
                                        e.currentTarget.style.background = 'var(--bg-lighter)'
                                    }}
                                />
                            </div>

                            {reportStatus === 'error' && (
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                                    ⚠️ Erro ao enviar. Tente novamente.
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={handleReportClose} style={{
                                padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                                background: 'transparent', color: 'var(--text-gray)', cursor: 'pointer',
                                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                            }}>Cancelar</button>
                            <button
                                onClick={handleReportSubmit}
                                disabled={reportStatus === 'sending' || reportStatus === 'done' || !reportDesc.trim()}
                                style={{
                                    padding: '10px 20px', borderRadius: 10, border: 'none',
                                    background: reportStatus === 'done' ? 'var(--success)' : 'var(--primary)',
                                    color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                    cursor: !reportDesc.trim() ? 'not-allowed' : 'pointer',
                                    opacity: !reportDesc.trim() ? 0.5 : 1,
                                    minWidth: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    transition: 'background 0.2s',
                                }}
                            >
                                {reportStatus === 'sending' && (
                                    <span style={{
                                        width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff', borderRadius: '50%',
                                        display: 'inline-block', animation: 'spin 0.8s linear infinite',
                                    }} />
                                )}
                                {reportStatus === 'done' ? '✓ Enviado!' : reportStatus === 'sending' ? 'Enviando' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .nav-bottom-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: calc(100% - 24px);
                    margin: 0 12px 12px;
                }
                .nav-report-btn {
                    width: 34px;
                    height: 34px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 9px;
                    color: rgba(255,255,255,0.35);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .nav-report-btn:hover {
                    background: rgba(107,155,124,0.12);
                    border-color: rgba(107,155,124,0.35);
                    color: #6B9B7C;
                }
                .nav-logout {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    padding: 8px 12px;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 9px;
                    color: rgba(255,255,255,0.4);
                    font-size: 13px;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .nav-logout:hover:not(:disabled) {
                    background: rgba(231,76,60,0.08);
                    border-color: rgba(231,76,60,0.3);
                    color: #ff6b6b;
                }
                .nav-logout:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .nav-logout-spinner {
                    width: 13px;
                    height: 13px;
                    border: 2px solid rgba(255,255,255,0.15);
                    border-top-color: #ff6b6b;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    flex-shrink: 0;
                }
            `}</style>
        </>
    )
}