// src/app/admin/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCommands } from '@/hooks/useCommands'

const ADMIN_EMAILS = ['admin@psique.com', 'rosanne@psique.com', 'anapaula@psique.com', 'cleiton@psique.com']

interface OperatorStat {
    email: string; name: string; encerrados: number; assumidos: number
    tempoMedioMin: number | null; mensagens: number
}
interface DailyCount { date: string; label: string; count: number }
interface StatusCounts { novo: number; emergencia: number; em_atendimento: number; agendamento_ia: number; finalizado: number;[key: string]: number }

interface Operator { id: string; email: string; created_at: string; last_sign_in_at: string | null }
interface ActivityLog {
    id: number; operator_id: string; action: string
    chat_id: number | null; contact: string | null
    metadata: Record<string, any> | null; created_at: string
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function gerarSenha(len = 8): string {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
    novo: { label: 'Novos', color: '#2E86C1', bg: '#EBF5FB', emoji: '🔵' },
    emergencia: { label: 'Emergências', color: '#E74C3C', bg: '#FDEDEC', emoji: '🔴' },
    em_atendimento: { label: 'Em Atendimento', color: '#D4AC0D', bg: '#FEF9E7', emoji: '🟡' },
    agendamento_ia: { label: 'Agendamento IA', color: '#8E44AD', bg: '#F5EEF8', emoji: '📅' },
    finalizado: { label: 'Finalizados', color: '#27AE60', bg: '#EAFAF1', emoji: '✅' },
}

function formatDuration(min: number | null) {
    if (min === null) return '—'
    return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h ${min % 60}min`
}
function formatDateLabel(iso: string) { const [, m, d] = iso.split('-'); return `${d}/${m}` }

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: active ? '#1a2332' : 'transparent',
            color: active ? '#fff' : '#8a9ab0',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        }}>{children}</button>
    )
}

// ─── Commands Tab ─────────────────────────────────────────────────────────────
function CommandsTab({ operatorEmail }: { operatorEmail: string }) {
    const { commands, loading, addCommand, removeCommand, updateCommand } = useCommands()
    const [search, setSearch] = useState('')
    const [newCmd, setNewCmd] = useState('')
    const [newBody, setNewBody] = useState('')
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)
    // edição
    const [editing, setEditing] = useState<string | null>(null)
    const [editBody, setEditBody] = useState('')
    const [saving, setSaving] = useState(false)

    const filtered = commands.filter(c =>
        !search || c.command.toLowerCase().includes(search.toLowerCase()) || c.body.toLowerCase().includes(search.toLowerCase())
    )

    async function handleAdd() {
        setError(null)
        if (!newCmd.trim() || !newBody.trim()) { setError('Preencha o comando e o texto.'); return }
        setAdding(true)
        try {
            await addCommand(newCmd.trim(), newBody.trim(), operatorEmail)
            setNewCmd(''); setNewBody('')
        } catch (e: any) {
            setError(e?.message ?? 'Erro ao adicionar.')
        } finally { setAdding(false) }
    }

    async function handleDelete(command: string) {
        setDeleting(command)
        try { await removeCommand(command) }
        catch { setError('Erro ao remover comando.') }
        finally { setDeleting(null); setConfirmDelete(null) }
    }

    function startEdit(command: string, body: string) {
        setEditing(command)
        setEditBody(body)
        setExpanded(command)
        setConfirmDelete(null)
    }

    function cancelEdit() {
        setEditing(null)
        setEditBody('')
    }

    async function handleSaveEdit(command: string) {
        if (!editBody.trim()) return
        setSaving(true)
        try {
            await updateCommand(command, editBody)
            setEditing(null)
            setEditBody('')
        } catch {
            setError('Erro ao salvar comando.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            {/* Add form */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', padding: '24px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332', marginBottom: '16px' }}>✚ Adicionar Comando</h2>
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>COMANDO (ex: /saudacao)</label>
                    <input
                        value={newCmd} onChange={e => setNewCmd(e.target.value)}
                        placeholder="/meucomando"
                        style={{ width: '280px', padding: '9px 12px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '13px', fontFamily: 'Monaco, Menlo, monospace', outline: 'none', background: '#f8fafc', color: '#1a2332', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>TEXTO DA MENSAGEM</label>
                    <textarea
                        value={newBody}
                        onChange={e => { setNewBody(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px' }}
                        placeholder={"Olá! Como posso ajudar? ☘️"}
                        rows={3}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '13px', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.5', background: '#f8fafc', color: '#1a2332' }}
                    />
                </div>
                {error && <p style={{ fontSize: '12px', color: '#E74C3C', marginBottom: '10px', fontWeight: 500 }}>⚠️ {error}</p>}
                <button onClick={handleAdd} disabled={adding} style={{
                    padding: '9px 20px', borderRadius: '8px', border: 'none',
                    background: adding ? '#a0b8a8' : '#3d6b4f', color: '#fff',
                    fontSize: '13px', fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '7px',
                }}>
                    {adding
                        ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Salvando...</>
                        : '✚ Adicionar Comando'}
                </button>
            </div>

            {/* List */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ecef', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332' }}>Comandos Ativos</h2>
                    <span style={{ background: '#f0f4f8', color: '#5a6a7a', fontSize: '11px', fontWeight: 700, borderRadius: '10px', padding: '2px 8px' }}>{commands.length}</span>
                    <div style={{ position: 'relative', marginLeft: 'auto', width: '240px' }}>
                        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#8a9ab0' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            style={{ width: '100%', padding: '7px 12px 7px 30px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#f8fafc', color: '#1a2332', caretColor: '#1a2332', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {loading
                    ? <div style={{ padding: '40px', textAlign: 'center', color: '#b0bcc8', fontSize: '13px' }}>Carregando...</div>
                    : filtered.length === 0
                        ? <div style={{ padding: '40px', textAlign: 'center', color: '#b0bcc8', fontSize: '13px' }}>{search ? 'Nenhum resultado.' : 'Nenhum comando cadastrado.'}</div>
                        : (
                            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {filtered.map((cmd, i) => {
                                    const isExpanded = expanded === cmd.command
                                    const isConfirming = confirmDelete === cmd.command
                                    const isDeleting = deleting === cmd.command
                                    const isEditing = editing === cmd.command

                                    return (
                                        <div key={cmd.command} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f0f4f8' : 'none', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px' }}>
                                                <button onClick={() => setExpanded(isExpanded ? null : cmd.command)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#8a9ab0', flexShrink: 0 }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </button>
                                                <code style={{ fontSize: '13px', fontWeight: 700, color: '#3d6b4f', fontFamily: 'Monaco, Menlo, monospace', background: 'rgba(61,107,79,0.08)', padding: '2px 8px', borderRadius: '5px', flexShrink: 0 }}>
                                                    {cmd.command}
                                                </code>
                                                {!isExpanded && (
                                                    <span style={{ fontSize: '12px', color: '#8a9ab0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                        {cmd.body.replace(/\n+/g, ' ').slice(0, 80)}{cmd.body.length > 80 ? '…' : ''}
                                                    </span>
                                                )}
                                                <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {/* Botão Editar */}
                                                    {!isConfirming && !isEditing && (
                                                        <button
                                                            onClick={() => startEdit(cmd.command, cmd.body)}
                                                            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #d6eaf8', background: '#ebf5fb', color: '#2E86C1', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            Editar
                                                        </button>
                                                    )}
                                                    {/* Botão Remover */}
                                                    {!isEditing && (
                                                        !isConfirming
                                                            ? <button onClick={() => setConfirmDelete(cmd.command)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fde8e8', background: '#fff5f5', color: '#E74C3C', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Remover</button>
                                                            : <>
                                                                <span style={{ fontSize: '12px', color: '#E74C3C', fontWeight: 600 }}>Confirmar?</span>
                                                                <button onClick={() => handleDelete(cmd.command)} disabled={isDeleting} style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#E74C3C', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                                    {isDeleting ? '...' : 'Sim'}
                                                                </button>
                                                                <button onClick={() => setConfirmDelete(null)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e0e6ec', background: '#fff', color: '#5a6a7a', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Não</button>
                                                            </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded: modo edição ou visualização */}
                                            {isExpanded && (
                                                <div style={{ padding: '0 20px 16px 48px' }}>
                                                    {isEditing ? (
                                                        <div>
                                                            <textarea
                                                                value={editBody}
                                                                onChange={e => {
                                                                    setEditBody(e.target.value)
                                                                    e.target.style.height = 'auto'
                                                                    e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px'
                                                                }}
                                                                rows={4}
                                                                style={{
                                                                    width: '100%', padding: '10px 12px', border: '1.5px solid #2E86C1',
                                                                    borderRadius: '8px', fontSize: '13px', resize: 'none', outline: 'none',
                                                                    boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.5',
                                                                    background: '#f8fafc', color: '#1a2332', caretColor: '#1a2332',
                                                                }}
                                                            />
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                                <button
                                                                    onClick={() => handleSaveEdit(cmd.command)}
                                                                    disabled={saving || !editBody.trim()}
                                                                    style={{
                                                                        padding: '7px 16px', borderRadius: '7px', border: 'none',
                                                                        background: saving ? '#a0b8a8' : '#3d6b4f', color: '#fff',
                                                                        fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                                    }}
                                                                >
                                                                    {saving
                                                                        ? <><span style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Salvando...</>
                                                                        : '✓ Salvar'}
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e0e6ec', background: '#fff', color: '#5a6a7a', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <pre style={{ margin: 0, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e8ecef', borderRadius: '8px', fontSize: '12px', color: '#1a2332', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6', fontFamily: 'inherit' }}>
                                                            {cmd.body}
                                                        </pre>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                }
            </div>
        </div>
    )
}

// ─── Operators Tab ────────────────────────────────────────────────────────────
function OperatorsTab() {
    const [operators, setOperators] = useState<Operator[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Novo operador
    const [newEmail, setNewEmail] = useState('')
    const [newPassword, setNewPassword] = useState(gerarSenha())
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)

    // Reset senha
    const [resetUserId, setResetUserId] = useState<string | null>(null)
    const [resetPassword, setResetPassword] = useState('')
    const [resetting, setResetting] = useState(false)
    const [resetDone, setResetDone] = useState<string | null>(null)

    // Delete
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function authHeader() {
        const { data: { session } } = await supabase.auth.getSession()
        return { Authorization: `Bearer ${session?.access_token}` }
    }

    const loadOperators = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const res = await fetch('/api/admin/operators', { headers: await authHeader() })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setOperators(json.users)
        } catch (e: any) {
            setError(e.message)
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { loadOperators() }, [loadOperators])

    async function handleCreate() {
        setCreateError(null); setCreatedInfo(null)
        if (!newEmail.trim()) { setCreateError('Informe o email.'); return }
        if (!newEmail.includes('@')) { setCreateError('Email inválido.'); return }
        setCreating(true)
        try {
            const res = await fetch('/api/admin/operators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await authHeader() },
                body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setCreatedInfo({ email: newEmail.trim(), password: newPassword })
            setNewEmail('')
            setNewPassword(gerarSenha())
            await loadOperators()
        } catch (e: any) {
            setCreateError(e.message)
        } finally { setCreating(false) }
    }

    async function handleReset() {
        if (!resetUserId || !resetPassword.trim()) return
        setResetting(true)
        try {
            const res = await fetch('/api/admin/operators', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...await authHeader() },
                body: JSON.stringify({ userId: resetUserId, password: resetPassword }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setResetDone(resetPassword)
            setResetUserId(null); setResetPassword('')
        } catch (e: any) {
            setError(e.message)
        } finally { setResetting(false) }
    }

    async function handleDelete(userId: string) {
        setDeletingId(userId)
        try {
            const res = await fetch('/api/admin/operators', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...await authHeader() },
                body: JSON.stringify({ userId }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setConfirmDeleteId(null)
            await loadOperators()
        } catch (e: any) {
            setError(e.message)
        } finally { setDeletingId(null) }
    }

    function formatDate(iso: string | null) {
        if (!iso) return '—'
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    const inputStyle: React.CSSProperties = {
        padding: '9px 12px', border: '1px solid #e0e6ec', borderRadius: '8px',
        fontSize: '13px', outline: 'none', background: '#f8fafc', color: '#1a2332', boxSizing: 'border-box',
    }

    return (
        <div>
            {/* Criar operador */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', padding: '24px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332', marginBottom: '20px' }}>✚ Novo Operador</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 220px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>EMAIL</label>
                        <input
                            value={newEmail} onChange={e => setNewEmail(e.target.value)}
                            placeholder="nome@psique.com"
                            style={{ ...inputStyle, width: '100%' }}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>SENHA INICIAL</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                style={{ ...inputStyle, flex: 1, fontFamily: 'Monaco, Menlo, monospace' }}
                            />
                            <button onClick={() => setNewPassword(gerarSenha())} title="Gerar nova senha" style={{ padding: '9px 10px', border: '1px solid #e0e6ec', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', color: '#8a9ab0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                            </button>
                        </div>
                    </div>
                    <button onClick={handleCreate} disabled={creating} style={{
                        padding: '9px 20px', borderRadius: '8px', border: 'none', height: '38px',
                        background: creating ? '#a0b8a8' : '#3d6b4f', color: '#fff',
                        fontSize: '13px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
                    }}>
                        {creating
                            ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Criando...</>
                            : '✚ Criar'}
                    </button>
                </div>

                {createError && <p style={{ fontSize: '12px', color: '#E74C3C', marginTop: '12px', fontWeight: 500 }}>⚠️ {createError}</p>}

                {createdInfo && (
                    <div style={{ marginTop: '14px', padding: '14px 16px', background: '#EAFAF1', border: '1px solid #a9dfbf', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px' }}>✅</span>
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e8449' }}>Operador criado com sucesso!</p>
                            <p style={{ fontSize: '12px', color: '#5a6a7a', marginTop: '2px' }}>
                                <b>{createdInfo.email}</b> · senha: <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'Monaco, Menlo, monospace' }}>{createdInfo.password}</code>
                            </p>
                        </div>
                        <button onClick={() => setCreatedInfo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '16px' }}>✕</button>
                    </div>
                )}
            </div>

            {/* Toast reset */}
            {resetDone && (
                <div style={{ marginBottom: '16px', padding: '14px 16px', background: '#EBF5FB', border: '1px solid #a9cce3', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>🔑</span>
                    <p style={{ fontSize: '13px', color: '#1a5276' }}>
                        Senha redefinida: <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'Monaco, Menlo, monospace' }}>{resetDone}</code>
                    </p>
                    <button onClick={() => setResetDone(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '16px' }}>✕</button>
                </div>
            )}

            {/* Lista */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ecef', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332' }}>Operadores</h2>
                    <span style={{ background: '#f0f4f8', color: '#5a6a7a', fontSize: '11px', fontWeight: 700, borderRadius: '10px', padding: '2px 8px' }}>{operators.length}</span>
                    <button onClick={loadOperators} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Atualizar
                    </button>
                </div>

                {error && <p style={{ padding: '16px 24px', fontSize: '13px', color: '#E74C3C' }}>⚠️ {error}</p>}

                {loading
                    ? <div style={{ padding: '40px', textAlign: 'center', color: '#b0bcc8', fontSize: '13px' }}>Carregando...</div>
                    : operators.length === 0
                        ? <div style={{ padding: '40px', textAlign: 'center', color: '#b0bcc8', fontSize: '13px' }}>Nenhum operador cadastrado.</div>
                        : operators.map((op, i) => {
                            const isResetting = resetUserId === op.id
                            const isConfirmDel = confirmDeleteId === op.id
                            const isDeletingThis = deletingId === op.id

                            return (
                                <div key={op.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f4f8', padding: '16px 24px', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                        {/* Avatar inicial */}
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f0ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#3d6b4f', flexShrink: 0 }}>
                                            {op.email[0].toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a2332' }}>{op.email}</p>
                                            <p style={{ fontSize: '11px', color: '#b0bcc8', marginTop: '2px' }}>
                                                Criado {formatDate(op.created_at)} · Último acesso {formatDate(op.last_sign_in_at)}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button onClick={() => { setResetUserId(op.id); setResetPassword(gerarSenha()) }} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #d6eaf8', background: '#ebf5fb', color: '#2E86C1', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                Redefinir senha
                                            </button>
                                            {!isConfirmDel
                                                ? <button onClick={() => setConfirmDeleteId(op.id)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #fde8e8', background: '#fff5f5', color: '#E74C3C', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                    Remover
                                                </button>
                                                : <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '12px', color: '#E74C3C', fontWeight: 600 }}>Confirmar?</span>
                                                    <button onClick={() => handleDelete(op.id)} disabled={isDeletingThis} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: '#E74C3C', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                        {isDeletingThis ? '...' : 'Sim'}
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #e0e6ec', background: '#fff', color: '#5a6a7a', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                                        Não
                                                    </button>
                                                </div>
                                            }
                                        </div>
                                    </div>

                                    {/* Inline reset */}
                                    {isResetting && (
                                        <div style={{ marginTop: '12px', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e0e6ec', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <p style={{ fontSize: '12px', color: '#5a6a7a', fontWeight: 600, flexShrink: 0 }}>Nova senha para <b>{op.email}</b>:</p>
                                            <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '200px' }}>
                                                <input
                                                    value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                                                    style={{ ...inputStyle, flex: 1, fontFamily: 'Monaco, Menlo, monospace', fontSize: '12px' }}
                                                />
                                                <button onClick={() => setResetPassword(gerarSenha())} style={{ padding: '8px 10px', border: '1px solid #e0e6ec', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', color: '#8a9ab0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                                                </button>
                                            </div>
                                            <button onClick={handleReset} disabled={resetting} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: resetting ? '#a0b8a8' : '#2E86C1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                                {resetting ? '...' : 'Salvar'}
                                            </button>
                                            <button onClick={() => setResetUserId(null)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e6ec', background: '#fff', color: '#5a6a7a', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                }
            </div>
        </div>
    )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    assumiu: { label: 'Assumiu', color: '#2E86C1', bg: '#EBF5FB', icon: '' },
    encerrou: { label: 'Encerrou', color: '#27AE60', bg: '#EAFAF1', icon: '' },
    mensagem: { label: 'Mensagem', color: '#8E44AD', bg: '#F5EEF8', icon: '' },
    login: { label: 'Login', color: '#D4AC0D', bg: '#FEF9E7', icon: '' },
}

function ActivityTab() {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [filterOp, setFilterOp] = useState('todos')
    const [filterAction, setFilterAction] = useState('todos')
    const [filterDays, setFilterDays] = useState(7)
    const [operators, setOperators] = useState<string[]>([])

    const loadLogs = useCallback(async () => {
        setLoading(true)
        const since = new Date()
        since.setDate(since.getDate() - filterDays)
        const { data } = await supabase
            .from('operator_logs')
            .select('*')
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(500)
        if (data) {
            setLogs(data)
            const ops = Array.from(new Set(data.map((l: ActivityLog) => l.operator_id)))
            setOperators(ops)
        }
        setLoading(false)
    }, [filterDays])

    useEffect(() => { loadLogs() }, [loadLogs])

    const filtered = logs.filter(l =>
        (filterOp === 'todos' || l.operator_id === filterOp) &&
        (filterAction === 'todos' || l.action === filterAction)
    )

    const selStyle: React.CSSProperties = {
        padding: '8px 14px', border: '1px solid #d4e6da', borderRadius: '9px',
        fontSize: '12px', outline: 'none', background: '#f0f7f2', color: '#2d5a3d',
        cursor: 'pointer', fontWeight: 700, appearance: 'none' as any,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%233d6b4f' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        paddingRight: '30px',
    }

    return (
        <div>
            {/* Header com título */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a2332' }}>Log de Atividade</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#3d6b4f', fontWeight: 700, background: '#e8f2eb', padding: '4px 12px', borderRadius: '20px', border: '1px solid #c8e0cc' }}>
                        {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                    </span>
                    <button onClick={loadLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #d4e6da', background: '#f0f7f2', color: '#3d6b4f', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', letterSpacing: '0.5px', marginRight: '2px' }}>FILTRAR POR</span>
                <select value={filterDays} onChange={e => setFilterDays(Number(e.target.value))} style={selStyle}>
                    <option value={1}>Hoje</option>
                    <option value={7}>Últimos 7 dias</option>
                    <option value={14}>Últimos 14 dias</option>
                    <option value={30}>Últimos 30 dias</option>
                </select>
                <select value={filterOp} onChange={e => setFilterOp(e.target.value)} style={selStyle}>
                    <option value="todos">Todos operadores</option>
                    {operators.map(op => <option key={op} value={op}>{op.split('@')[0]}</option>)}
                </select>
                <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selStyle}>
                    <option value="todos">Todas ações</option>
                    {Object.entries(ACTION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                {(filterOp !== 'todos' || filterAction !== 'todos') && (
                    <button onClick={() => { setFilterOp('todos'); setFilterAction('todos') }} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #fde8e8', background: '#fff5f5', color: '#E74C3C', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        ✕ Limpar
                    </button>
                )}
            </div>

            {/* Timeline */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', overflow: 'hidden' }}>
                {loading
                    ? (
                        <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: 28, height: 28, border: '3px solid #e0e6ec', borderTopColor: '#4a7a5c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ fontSize: '13px', color: '#b0bcc8' }}>Carregando registros...</span>
                        </div>
                    )
                    : filtered.length === 0
                        ? (
                            <div style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: '#5a6a7a' }}>Nenhum registro encontrado</p>
                                <p style={{ fontSize: '12px', color: '#b0bcc8', textAlign: 'center', maxWidth: '280px' }}>
                                    Os logs aparecem aqui conforme os operadores realizam ações no sistema.
                                </p>
                            </div>
                        )
                        : (
                            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                                {/* Header da tabela */}
                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '14px', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e8ecef', alignItems: 'center' }}>
                                    <div />
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', letterSpacing: '0.5px' }}>OPERADOR · AÇÃO · CONTATO</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#8a9ab0', letterSpacing: '0.5px' }}>HORÁRIO</span>
                                </div>
                                {filtered.map((log, i) => {
                                    const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, color: '#8a9ab0', bg: '#f8fafc', icon: '•' }
                                    return (
                                        <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '14px', alignItems: 'flex-start', padding: '13px 20px', borderTop: '1px solid #f0f4f8', background: i % 2 === 0 ? '#fff' : '#fafbfd', transition: 'background 0.1s' }}>
                                            {/* Ícone */}
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.bg, border: `1px solid ${cfg.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>
                                                {cfg.icon}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a2332' }}>{log.operator_id.split('@')[0]}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: '10px', border: `1px solid ${cfg.color}20` }}>{cfg.label}</span>
                                                    {log.contact && <span style={{ fontSize: '12px', color: '#5a6a7a', fontWeight: 500 }}>· {log.contact}</span>}
                                                    {log.chat_id && <span style={{ fontSize: '11px', color: '#b0bcc8', background: '#f0f4f8', padding: '1px 6px', borderRadius: '6px' }}>#{log.chat_id}</span>}
                                                </div>
                                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                    <p style={{ fontSize: '11px', color: '#8a9ab0', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' as any }}>
                                                        {Object.entries(log.metadata).map(([k, v]) => (
                                                            <span key={k} style={{ background: '#f8fafc', border: '1px solid #e8ecef', padding: '1px 7px', borderRadius: '5px' }}>{k}: <b>{String(v)}</b></span>
                                                        ))}
                                                    </p>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#b0bcc8', whiteSpace: 'nowrap', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(log.created_at)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                }
            </div>
        </div>
    )
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab() {
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [totalChats, setTotalChats] = useState(0)
    const [statusCounts, setStatusCounts] = useState<StatusCounts>({ novo: 0, emergencia: 0, em_atendimento: 0, agendamento_ia: 0, finalizado: 0 })
    const [operatorStats, setOperatorStats] = useState<OperatorStat[]>([])
    const [dailyVolume, setDailyVolume] = useState<DailyCount[]>([])
    const [periodDays, setPeriodDays] = useState(30)
    const [exportingCsv, setExportingCsv] = useState(false)

    const loadStats = useCallback(async () => {
        setLoading(true)
        const since = new Date()
        since.setDate(since.getDate() - periodDays)
        const { data: chats } = await supabase.from('chats').select('id, kanban_status, operator_id, finished_by, finished_at, assumed_at, created_at').gte('created_at', since.toISOString())
        if (!chats) { setLoading(false); return }
        setTotalChats(chats.length)

        const counts: StatusCounts = { novo: 0, emergencia: 0, em_atendimento: 0, agendamento_ia: 0, finalizado: 0 }
        chats.forEach(c => { if (c.kanban_status in counts) counts[c.kanban_status]++ })
        setStatusCounts(counts)

        const daily: Record<string, number> = {}
        const now = new Date()
        for (let i = periodDays - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); daily[d.toISOString().slice(0, 10)] = 0 }
        chats.forEach(c => { const day = (c.created_at ?? '').slice(0, 10); if (day in daily) daily[day]++ })
        setDailyVolume(Object.entries(daily).map(([date, count]) => ({ date, label: formatDateLabel(date), count })))

        const { data: msgs } = await supabase.from('messages').select('sent_by').eq('direction', 'outgoing').not('sent_by', 'is', null)
        const msgByOp: Record<string, number> = {}
        msgs?.forEach(m => { if (m.sent_by) msgByOp[m.sent_by] = (msgByOp[m.sent_by] || 0) + 1 })

        const opMap: Record<string, { encerrados: number; assumidos: number; durations: number[] }> = {}
        const ensureOp = (e: string) => { if (!opMap[e]) opMap[e] = { encerrados: 0, assumidos: 0, durations: [] } }
        chats.forEach(c => {
            if (c.operator_id) { ensureOp(c.operator_id); opMap[c.operator_id].assumidos++ }
            if (c.finished_by) {
                ensureOp(c.finished_by); opMap[c.finished_by].encerrados++
                if (c.assumed_at && c.finished_at) {
                    const diff = (new Date(c.finished_at).getTime() - new Date(c.assumed_at).getTime()) / 60000
                    if (diff > 0 && diff < 480) opMap[c.finished_by].durations.push(diff)
                }
            }
        })

        const stats: OperatorStat[] = Object.entries(opMap).map(([email, d]) => ({
            email, name: email.split('@')[0], encerrados: d.encerrados, assumidos: d.assumidos,
            tempoMedioMin: d.durations.length > 0 ? Math.round(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : null,
            mensagens: msgByOp[email] || 0,
        }))
        stats.sort((a, b) => b.encerrados - a.encerrados)
        setOperatorStats(stats)
        setLastUpdated(new Date())
        setLoading(false)
    }, [periodDays])

    async function exportCSV() {
        setExportingCsv(true)
        try {
            const since = new Date()
            since.setDate(since.getDate() - periodDays)

            const { data: chats } = await supabase
                .from('chats')
                .select('id, kanban_status, operator_id, finished_by, finished_at, assumed_at, created_at')
                .gte('created_at', since.toISOString())

            const { data: msgs } = await supabase
                .from('messages')
                .select('sent_by, created_at, direction')
                .eq('direction', 'outgoing')
                .not('sent_by', 'is', null)
                .gte('created_at', since.toISOString())

            const msgByOp: Record<string, number> = {}
            msgs?.forEach(m => { if (m.sent_by) msgByOp[m.sent_by] = (msgByOp[m.sent_by] || 0) + 1 })

            // Sheet 1 — resumo por operador
            const opMap: Record<string, { encerrados: number; assumidos: number; durations: number[] }> = {}
            const ensureOp = (e: string) => { if (!opMap[e]) opMap[e] = { encerrados: 0, assumidos: 0, durations: [] } }
            chats?.forEach(c => {
                if (c.operator_id) { ensureOp(c.operator_id); opMap[c.operator_id].assumidos++ }
                if (c.finished_by) {
                    ensureOp(c.finished_by); opMap[c.finished_by].encerrados++
                    if (c.assumed_at && c.finished_at) {
                        const diff = (new Date(c.finished_at).getTime() - new Date(c.assumed_at).getTime()) / 60000
                        if (diff > 0 && diff < 480) opMap[c.finished_by].durations.push(diff)
                    }
                }
            })

            const statsRows = Object.entries(opMap).map(([email, d]) => {
                const tempoMedio = d.durations.length > 0 ? Math.round(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : null
                const taxa = d.assumidos > 0 ? Math.round((d.encerrados / d.assumidos) * 100) : 0
                return [email, d.assumidos, d.encerrados, `${taxa}%`, tempoMedio !== null ? `${tempoMedio}min` : '—', msgByOp[email] || 0]
            })

            // Sheet 2 — volume diário
            const daily: Record<string, number> = {}
            for (let i = periodDays - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); daily[d.toISOString().slice(0, 10)] = 0 }
            chats?.forEach(c => { const day = (c.created_at ?? '').slice(0, 10); if (day in daily) daily[day]++ })

            // Monta CSV com separador de seções
            const rows: string[] = []
            rows.push(`Relatório Psique — Últimos ${periodDays} dias — ${new Date().toLocaleDateString('pt-BR')}`)
            rows.push('')
            rows.push('RESUMO POR OPERADOR')
            rows.push('Operador,Assumidos,Encerrados,Taxa Conclusão,Tempo Médio,Msgs Enviadas')
            statsRows.forEach(r => rows.push(r.map(v => `"${v}"`).join(',')))
            rows.push('')
            rows.push('VOLUME DIÁRIO DE NOVOS CHATS')
            rows.push('Data,Chats')
            Object.entries(daily).forEach(([date, count]) => rows.push(`"${date}","${count}"`))

            const csv = rows.join('\n')
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM pra Excel PT-BR
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `psique-relatorio-${periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } finally {
            setExportingCsv(false)
        }
    }

    useEffect(() => { loadStats() }, [loadStats])

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div style={{ width: 32, height: 32, border: '3px solid #e0e6ec', borderTopColor: '#4a7a5c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>

    const maxE = Math.max(...operatorStats.map(o => o.encerrados), 1)
    const maxD = Math.max(...dailyVolume.map(d => d.count), 1)
    const totE = operatorStats.reduce((s, o) => s + o.encerrados, 0)
    const totM = operatorStats.reduce((s, o) => s + o.mensagens, 0)

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))} style={{ padding: '7px 12px', border: '1px solid #e0e6ec', borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#fff', color: '#1a2332', fontWeight: 600, cursor: 'pointer' }}>
                    <option value={7}>Últimos 7 dias</option>
                    <option value={14}>Últimos 14 dias</option>
                    <option value={30}>Últimos 30 dias</option>
                    <option value={90}>Últimos 90 dias</option>
                    <option value={365}>Último ano</option>
                </select>
                <button onClick={exportCSV} disabled={exportingCsv || loading} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '9px', border: '1px solid #a9dfbf', background: exportingCsv ? '#f0f9f4' : '#EAFAF1', color: '#1e8449', fontSize: '13px', fontWeight: 600, cursor: exportingCsv || loading ? 'not-allowed' : 'pointer' }}>
                    {exportingCsv
                        ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(30,132,73,0.3)', borderTopColor: '#1e8449', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Exportando...</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Exportar CSV</>
                    }
                </button>
                <button onClick={loadStats} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '9px', border: '1px solid #e0e6ec', background: '#fff', color: '#5a6a7a', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                    Atualizar {lastUpdated ? `· ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8ecef' }}>
                    <p style={{ fontSize: '11px', color: '#8a9ab0', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>TOTAL CHATS</p>
                    <p style={{ fontSize: '34px', fontWeight: 800, color: '#1a2332', lineHeight: 1 }}>{totalChats}</p>
                </div>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <div key={key} style={{ background: cfg.bg, borderRadius: '12px', padding: '20px', border: `1px solid ${cfg.color}25` }}>
                        <p style={{ fontSize: '11px', color: cfg.color, fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>{cfg.emoji} {cfg.label.toUpperCase()}</p>
                        <p style={{ fontSize: '34px', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{statusCounts[key] || 0}</p>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e8ecef' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332' }}>Casos Encerrados por Operador</h2>
                        <span style={{ fontSize: '11px', color: '#8a9ab0', fontWeight: 600 }}>TOTAL: {totE}</span>
                    </div>
                    {operatorStats.length === 0
                        ? <p style={{ color: '#b0bcc8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Nenhum atendimento finalizado</p>
                        : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {operatorStats.map(op => (
                                <div key={op.email}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a2332' }}>{op.name}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#27AE60' }}>{op.encerrados} enc.</span>
                                    </div>
                                    <div style={{ height: 10, background: '#f0f4f8', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(op.encerrados / maxE) * 100}%`, background: 'linear-gradient(90deg, #3d6b4f, #27AE60)', borderRadius: 5 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    }
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e8ecef' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332', marginBottom: '20px' }}>Novos Contatos — Últimos {periodDays} Dias</h2>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '130px', paddingBottom: '24px', position: 'relative' }}>
                        {dailyVolume.map(d => (
                            <div key={d.date} title={`${d.label}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                                {d.count > 0 && <span style={{ fontSize: '9px', color: '#5a6a7a', fontWeight: 700 }}>{d.count}</span>}
                                <div style={{ width: '100%', height: d.count > 0 ? `${Math.max((d.count / maxD) * 100, 8)}%` : '3px', background: d.count > 0 ? 'linear-gradient(180deg, #5dade2, #2E86C1)' : '#e8ecef', borderRadius: '3px 3px 0 0' }} />
                                <span style={{ fontSize: '8px', color: '#b0bcc8', position: 'absolute', bottom: 0, transform: 'rotate(-45deg)', transformOrigin: 'top left' }}>{d.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mensagens */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e8ecef', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332' }}>Mensagens Enviadas por Operador</h2>
                    <span style={{ fontSize: '11px', color: '#8a9ab0', fontWeight: 600 }}>TOTAL: {totM}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {operatorStats.map(op => {
                        const pct = totM > 0 ? Math.round((op.mensagens / totM) * 100) : 0
                        return (
                            <div key={op.email} style={{ flex: '1 1 160px', background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e8ecef' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a2332', marginBottom: '4px' }}>{op.name}</p>
                                <p style={{ fontSize: '28px', fontWeight: 800, color: '#8E44AD', marginBottom: '8px' }}>{op.mensagens}</p>
                                <div style={{ height: 6, background: '#e8ecef', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: '#8E44AD', borderRadius: 3 }} />
                                </div>
                                <p style={{ fontSize: '11px', color: '#8a9ab0', marginTop: '4px' }}>{pct}% do total</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Tabela */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8ecef', overflow: 'hidden', marginBottom: '32px' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ecef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1a2332' }}>Detalhamento por Operador</h2>
                    <p style={{ fontSize: '11px', color: '#b0bcc8' }}>* Tempo médio ignora sessões &gt; 8h</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['Operador', 'Assumidos', 'Encerrados', 'Taxa Conclusão', 'Tempo Médio', 'Msgs Enviadas'].map(h => (
                                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {operatorStats.length === 0
                                ? <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#b0bcc8', fontSize: '13px' }}>Nenhum dado ainda</td></tr>
                                : operatorStats.map((op, i) => {
                                    const taxa = op.assumidos > 0 ? Math.round((op.encerrados / op.assumidos) * 100) : 0
                                    const tc = taxa >= 70 ? '#27AE60' : taxa >= 40 ? '#D4AC0D' : '#E74C3C'
                                    return (
                                        <tr key={op.email} style={{ borderTop: '1px solid #f0f4f8', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                            <td style={{ padding: '16px 20px' }}>
                                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a2332' }}>{op.name}</p>
                                                <p style={{ fontSize: '11px', color: '#8a9ab0' }}>{op.email}</p>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ fontSize: '16px', fontWeight: 700, color: '#2E86C1' }}>{op.assumidos}</span></td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ fontSize: '16px', fontWeight: 700, color: '#27AE60' }}>{op.encerrados}</span></td>
                                            <td style={{ padding: '16px 20px', minWidth: '140px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${taxa}%`, background: tc, borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 700, color: tc, minWidth: '34px' }}>{taxa}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ fontSize: '13px', fontWeight: 600, color: op.tempoMedioMin !== null ? '#1a2332' : '#b0bcc8' }}>{formatDuration(op.tempoMedioMin)}</span></td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ fontSize: '16px', fontWeight: 700, color: '#8E44AD' }}>{op.mensagens}</span></td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)
    const [operatorEmail, setOperatorEmail] = useState('')
    const [activeTab, setActiveTab] = useState<'stats' | 'commands' | 'operators' | 'activity'>('stats')

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || !ADMIN_EMAILS.includes(user.email!)) { router.replace('/'); return }
            setOperatorEmail(user.email!)
            setAuthorized(true)
            setChecking(false)
        })
    }, [router])

    if (checking) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e0e6ec', borderTopColor: '#4a7a5c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
    )
    if (!authorized) return null

    return (
        <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100vh', background: '#f4f6f9' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a2332', marginBottom: '4px' }}>Painel Administrativo</h1>
                <p style={{ fontSize: '13px', color: '#8a9ab0' }}>Psique</p>
            </div>

            <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: '#e8ecef', borderRadius: '10px', marginBottom: '24px' }}>
                <TabBtn active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>RELATÓRIOS</TabBtn>
                <TabBtn active={activeTab === 'commands'} onClick={() => setActiveTab('commands')}>COMANDOS</TabBtn>
                <TabBtn active={activeTab === 'operators'} onClick={() => setActiveTab('operators')}>OPERADORES</TabBtn>
                <TabBtn active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>ATIVIDADE</TabBtn>
            </div>

            {activeTab === 'stats' && <StatsTab />}
            {activeTab === 'commands' && <CommandsTab operatorEmail={operatorEmail} />}
            {activeTab === 'operators' && <OperatorsTab />}
            {activeTab === 'activity' && <ActivityTab />}

            <p style={{ textAlign: 'center', color: '#d0d8e4', fontSize: '11px', paddingBottom: '8px' }}>Psique · admin@psique.com</p>
        </div>
    )
}