// src/app/contacts/page.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Contact {
    id?: number
    name: string
    phone: string
    email?: string
    profile_image?: string
    created_at?: string
}

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('55') && digits.length >= 12) {
        const sem55 = digits.slice(2)
        const ddd = sem55.slice(0, 2)
        const num = sem55.slice(2)
        if (num.length === 9) return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`
        if (num.length === 8) return `+55 ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`
    }
    return `+${digits}`
}

function parseCSV(text: string): Contact[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
        return {
            name: obj['name'] ?? obj['nome'] ?? '',
            phone: obj['phone'] ?? obj['telefone'] ?? obj['fone'] ?? '',
            email: obj['email'] ?? '',
            profile_image: obj['profile_image'] ?? obj['avatar'] ?? obj['foto'] ?? '',
        }
    }).filter(c => c.name || c.phone)
}

function parseJSON(text: string): Contact[] {
    try {
        const data = JSON.parse(text)
        const arr = Array.isArray(data) ? data : data.contacts ?? data.data ?? []
        return arr.map((item: Record<string, string>) => ({
            name: item.name ?? item.nome ?? '',
            phone: item.phone ?? item.telefone ?? item.fone ?? '',
            email: item.email ?? '',
            profile_image: item.profile_image ?? item.avatar ?? item.foto ?? '',
        })).filter((c: Contact) => c.name || c.phone)
    } catch { return [] }
}

function Avatar({ contact, size = 40 }: { contact: Contact; size?: number }) {
    const [imgError, setImgError] = useState(false)
    const initials = contact.name
        ? contact.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : contact.phone.slice(-4, -2)

    if (contact.profile_image && !imgError) {
        return (
            <img src={contact.profile_image} alt={contact.name} onError={() => setImgError(true)}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6B9B7C, #3d6b4f)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        }}>
            {initials}
        </div>
    )
}

function EditModal({ contact, onSave, onClose }: {
    contact: Contact; onSave: (updated: Contact) => void; onClose: () => void
}) {
    const [name, setName] = useState(contact.name)
    const [phone, setPhone] = useState(contact.phone)
    const [email, setEmail] = useState(contact.email ?? '')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        if (!name.trim() && !phone.trim()) return
        setSaving(true)
        const { data, error } = await supabase
            .from('contacts').update({ name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim() || null })
            .eq('id', contact.id).select().single()
        setSaving(false)
        if (!error && data) onSave({ ...contact, ...data })
    }

    const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a2332', margin: 0 }}>Editar Contato</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '20px' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[{ label: 'Nome', value: name, onChange: setName }, { label: 'Telefone', value: phone, onChange: setPhone }, { label: 'Email', value: email, onChange: setEmail }].map(({ label, value, onChange }) => (
                        <div key={label}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#5a6a7a', display: 'block', marginBottom: '6px' }}>{label}</label>
                            <input value={value} onChange={e => onChange(e.target.value)} style={inp}
                                onFocus={e => e.target.style.borderColor = '#4a7a5c'}
                                onBlur={e => e.target.style.borderColor = '#e0e6ec'} />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e0e6ec', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5a6a7a' }}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#27AE60', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function ContactsPage() {
    const router = useRouter()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [opening, setOpening] = useState<number | null>(null)
    const [operatorEmail, setOperatorEmail] = useState<string | null>(null)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [editingContact, setEditingContact] = useState<Contact | null>(null)
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
    const [importPreview, setImportPreview] = useState<Contact[]>([])
    const [importError, setImportError] = useState('')
    const [importCount, setImportCount] = useState(0)
    const [showImportPanel, setShowImportPanel] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const loadContacts = useCallback(async () => {
        setLoading(true)
        let query = supabase.from('contacts').select('*').order('name', { ascending: true })
        if (clinicId) query = query.eq('clinic_id', clinicId)
        const { data } = await query
        setContacts(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { loadContacts() }, [loadContacts, clinicId])

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            const email = data.user?.email ?? null
            setOperatorEmail(email)
            if (email) {
                const { data: op } = await supabase
                    .from('operators')
                    .select('clinic_id')
                    .eq('email', email)
                    .single()
                setClinicId(op?.clinic_id ?? null)
            }
        })
    }, [])

    // ── Cria chat como em_atendimento imediatamente ao clicar ─────────────────
    async function openChatWithContact(contact: Contact) {
        if (!contact.phone || opening) return
        setOpening(contact.id ?? -1)

        const phone = contact.phone.replace(/\D/g, '')
        const remotejID = `${phone}@s.whatsapp.net`

        const { data: chatData, error } = await supabase
            .from('chats')
            .upsert({
                remotejID,
                phone,
                name: contact.name || null,
                status: 'aberto',
                kanban_status: 'em_atendimento',
                handoff: true,
                operator_id: operatorEmail,
                assumed_at: new Date().toISOString(),
                unread_count: 0,
                clinic_id: clinicId,
            }, { onConflict: 'remotejID' })
            .select()
            .single()

        setOpening(null)

        if (error || !chatData) {
            alert('Erro ao abrir conversa: ' + error?.message)
            return
        }

        sessionStorage.setItem('open_chat_id', String(chatData.id))
        router.push('/dashboard')
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setImportStatus('parsing'); setImportError('')
        const text = await file.text()
        let parsed: Contact[] = []
        if (file.name.endsWith('.json')) parsed = parseJSON(text)
        else if (file.name.endsWith('.csv')) parsed = parseCSV(text)
        else { setImportError('Formato não suportado.'); setImportStatus('error'); return }
        if (parsed.length === 0) { setImportError('Nenhum contato válido.'); setImportStatus('error'); return }
        setImportPreview(parsed); setImportStatus('preview'); e.target.value = ''
    }

    async function confirmImport() {
        setImportStatus('importing')
        const { error } = await supabase.from('contacts').upsert(
            importPreview.map(c => ({ name: c.name, phone: c.phone.replace(/\D/g, ''), email: c.email || null, profile_image: c.profile_image || null, clinic_id: clinicId })),
            { onConflict: 'phone', ignoreDuplicates: false }
        )
        if (error) { setImportError(error.message); setImportStatus('error'); return }
        setImportCount(importPreview.length); setImportStatus('done')
        await loadContacts()
        setTimeout(() => { setImportStatus('idle'); setImportPreview([]); setShowImportPanel(false) }, 2000)
    }

    async function deleteContact(id: number) {
        if (!confirm('Remover este contato?')) return
        await supabase.from('contacts').delete().eq('id', id)
        setContacts(prev => prev.filter(c => c.id !== id))
    }

    function handleSaved(updated: Contact) {
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
        setEditingContact(null)
    }

    const filtered = contacts
        .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search.replace(/\D/g, '')))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'))

    const grouped: Record<string, Contact[]> = {}
    filtered.forEach(c => {
        const letter = (c.name?.[0] ?? '#').toUpperCase()
        if (!grouped[letter]) grouped[letter] = []
        grouped[letter].push(c)
    })
    const letters = Object.keys(grouped).sort()

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6f9' }}>

            {/* Toolbar */}
            <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e8ecef', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a2332', margin: 0 }}>Contatos</h2>
                    <p style={{ fontSize: '12px', color: '#8a9ab0', margin: '2px 0 0' }}>{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8a9ab0' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input type="text" placeholder="Buscar nome ou número..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ padding: '8px 12px 8px 32px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#f8fafc', width: '240px' }} />
                </div>
                <button onClick={() => { setShowImportPanel(v => !v); setImportStatus('idle'); setImportPreview([]) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#27AE60', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Importar
                </button>
            </div>

            {/* Import Panel */}
            {showImportPanel && (
                <div style={{ background: '#fff', borderBottom: '1px solid #e8ecef', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a2332', margin: 0 }}>Importar Contatos — CSV ou JSON</p>
                        <button onClick={() => setShowImportPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '20px' }}>×</button>
                    </div>
                    {(importStatus === 'idle' || importStatus === 'parsing') && (
                        <div onClick={() => fileRef.current?.click()}
                            style={{ border: '2px dashed #d0d8e0', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#4a7a5c'}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#d0d8e0'}>
                            <input ref={fileRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={handleFile} />
                            {importStatus === 'parsing' ? <p style={{ color: '#8a9ab0', fontSize: '13px', margin: 0 }}>⏳ Processando...</p>
                                : <p style={{ fontSize: '13px', color: '#5a6a7a', margin: 0 }}>📂 Clique para selecionar <span style={{ color: '#b0bcc8' }}>(CSV ou JSON)</span></p>}
                        </div>
                    )}
                    {importStatus === 'error' && (
                        <div style={{ background: '#FDEDEC', borderRadius: '8px', padding: '10px 14px', color: '#c0392b', fontSize: '13px', display: 'flex', gap: '10px' }}>
                            ❌ {importError}
                            <button onClick={() => setImportStatus('idle')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', textDecoration: 'underline', fontSize: '12px' }}>Tentar novamente</button>
                        </div>
                    )}
                    {importStatus === 'done' && <div style={{ background: '#EAFAF1', borderRadius: '8px', padding: '10px 14px', color: '#1e8449', fontSize: '13px' }}>✅ {importCount} contato{importCount !== 1 ? 's' : ''} importado{importCount !== 1 ? 's' : ''} com sucesso!</div>}
                    {importStatus === 'importing' && <p style={{ textAlign: 'center', color: '#8a9ab0', fontSize: '13px', margin: 0 }}>⏳ Importando...</p>}
                    {importStatus === 'preview' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <p style={{ fontSize: '13px', color: '#1a2332', margin: 0 }}><strong>{importPreview.length}</strong> contato{importPreview.length !== 1 ? 's' : ''} encontrado{importPreview.length !== 1 ? 's' : ''}</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => setImportStatus('idle')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e0e6ec', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5a6a7a' }}>Cancelar</button>
                                    <button onClick={confirmImport} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#27AE60', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>
                                </div>
                            </div>
                            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e8ecef', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead><tr style={{ background: '#f8fafc' }}>
                                        {['Nome', 'Telefone', 'Email'].map(h => <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: '#5a6a7a', fontWeight: 600, borderBottom: '1px solid #e8ecef' }}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {importPreview.slice(0, 50).map((c, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f0f2f5' }}>
                                                <td style={{ padding: '6px 12px', color: '#1a2332' }}>{c.name || '—'}</td>
                                                <td style={{ padding: '6px 12px', color: '#5a6a7a', fontFamily: 'monospace' }}>{formatPhone(c.phone)}</td>
                                                <td style={{ padding: '6px 12px', color: '#8a9ab0' }}>{c.email || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#8a9ab0' }}>Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#b0bcc8' }}>
                        <p style={{ fontSize: '15px', margin: '0 0 6px' }}>{search ? 'Nenhum contato encontrado' : 'Nenhum contato ainda'}</p>
                        {!search && <p style={{ fontSize: '13px', margin: 0 }}>Importe um CSV ou JSON para começar</p>}
                    </div>
                ) : (
                    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '8px 24px 24px' }}>
                        {letters.map(letter => (
                            <div key={letter}>
                                <div style={{ padding: '12px 0 6px', fontSize: '12px', fontWeight: 700, color: '#4a7a5c', letterSpacing: '0.05em', borderBottom: '1px solid #e8ecef', marginBottom: '2px' }}>
                                    {letter}
                                </div>
                                {grouped[letter].map(contact => {
                                    const isOpening = opening === contact.id
                                    return (
                                        <div key={contact.id}
                                            onClick={() => openChatWithContact(contact)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 8px', borderRadius: '8px', transition: 'background 0.1s', cursor: isOpening ? 'wait' : 'pointer', opacity: isOpening ? 0.6 : 1 }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7f4')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <Avatar contact={contact} size={40} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '14px', fontWeight: 600, color: '#1a2332', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name || '—'}</p>
                                                <p style={{ fontSize: '12px', color: '#5a6a7a', margin: 0, fontFamily: 'monospace' }}>{formatPhone(contact.phone)}</p>
                                                {contact.email && <p style={{ fontSize: '11px', color: '#8a9ab0', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.email}</p>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => setEditingContact(contact)} title="Editar"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0c8d0', padding: '6px', borderRadius: '6px' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#4a7a5c')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#c0c8d0')}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button onClick={() => contact.id && deleteContact(contact.id)} title="Remover"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0c8d0', padding: '6px', borderRadius: '6px' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#e74c3c')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#c0c8d0')}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {isOpening && <div style={{ width: 16, height: 16, border: '2px solid #e0e6ec', borderTopColor: '#4a7a5c', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editingContact && <EditModal contact={editingContact} onSave={handleSaved} onClose={() => setEditingContact(null)} />}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}