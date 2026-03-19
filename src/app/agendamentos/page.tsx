'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Agendamento {
    id: number
    profissional_id: number
    paciente_nome: string
    paciente_telefone: string | null
    data_hora: string
    duracao: number
    modalidade: string
    status: string
    origem: string
    observacoes: string | null
    profissional?: { nome: string; especialidade: string }
}

interface ChatMessage {
    id: string
    from: 'operador' | 'paciente'
    text: string
    time: string
}

function formatToZAPI(telefone: string): string {
    const digits = telefone.replace(/\D/g, '')
    let normalized = digits.startsWith('55') ? digits : `55${digits}`
    if (normalized.length === 13) normalized = normalized.slice(0, 4) + normalized.slice(5)
    return normalized
}

async function findChatIdByPhone(telefone: string): Promise<number | null> {
    const zapiPhone = formatToZAPI(telefone)
    try {
        const res = await fetch(`/api/chat/find?telefone=${zapiPhone}`)
        if (!res.ok) return null
        const id = await res.json()
        return id ?? null
    } catch (e) {
        console.error('[findChatIdByPhone]', e)
        return null
    }
}

async function fetchChatHistory(telefone: string): Promise<{ chatId: number | null; messages: ChatMessage[] }> {
    const chatId = await findChatIdByPhone(telefone)
    if (!chatId) return { chatId: null, messages: [] }

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) console.error('[fetchChatHistory]', error)
    if (!data) return { chatId, messages: [] }

    return {
        chatId,
        messages: data.reverse().map((m: any) => ({
            id: String(m.id),
            from: m.direction === 'outgoing' ? 'operador' : 'paciente',
            text: m.body,
            time: new Date(m.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
            }),
        })),
    }
}

async function sendZAPIMessage(telefone: string, mensagem: string): Promise<boolean> {
    try {
        const res = await fetch('/api/zapi/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone: formatToZAPI(telefone), mensagem }),
        })
        return res.ok
    } catch {
        return false
    }
}

export default function AgendamentosPage() {
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('todos')

    const [modalOpen, setModalOpen] = useState(false)
    const [selectedAg, setSelectedAg] = useState<Agendamento | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatLoading, setChatLoading] = useState(false)
    const [activeChatId, setActiveChatId] = useState<number | null>(null)
    const [inputText, setInputText] = useState('')
    const [sending, setSending] = useState(false)
    const [handoff, setHandoff] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    useEffect(() => {
        loadAgendamentos()
        const channel = supabase
            .channel('agendamentos-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
                loadAgendamentos()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [chatMessages])

    async function loadAgendamentos() {
        try {
            const { data, error } = await supabase
                .from('agendamentos')
                .select(`*, profissional:profissional_id (nome, especialidade)`)
                .order('data_hora', { ascending: true })
            if (error) throw error
            setAgendamentos(data as any)
        } catch (e) {
            console.error('Erro ao carregar agendamentos:', e)
        } finally {
            setLoading(false)
        }
    }

    async function aprovar(id: number, e: React.MouseEvent) {
        e.stopPropagation()
        await supabase
            .from('agendamentos')
            .update({ status: 'confirmado', approved_at: new Date().toISOString(), approved_by: 'operador' })
            .eq('id', id)
        loadAgendamentos()
    }

    async function rejeitar(id: number, e: React.MouseEvent) {
        e.stopPropagation()
        await supabase
            .from('agendamentos')
            .update({ status: 'cancelado', cancelado_por: 'clinica', cancelado_em: new Date().toISOString(), motivo_cancelamento: 'Rejeitado pelo operador' })
            .eq('id', id)
        loadAgendamentos()
    }

    function subscribeToChat(chatId: number) {
        // Limpa canal anterior antes de criar novo
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current)
            realtimeChannelRef.current = null
        }

        // CRÍTICO: nome estável (sem Date.now()) + filter server-side
        // - Nome estável: StrictMode em dev monta/desmonta 2x; com Date.now() cria canais
        //   órfãos que não são limpos corretamente
        // - filter no .on(): Supabase só entrega eventos para o cliente se o filtro
        //   estiver declarado aqui — filtrar no callback não é suficiente
        const channel = supabase
            .channel(`chat-messages-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                (payload) => {
                    const m = payload.new as any
                    console.log('[realtime] payload recebido:', m)

                    const newMsg: ChatMessage = {
                        id: String(m.id),
                        from: m.direction === 'outgoing' ? 'operador' : 'paciente',
                        text: m.body,
                        time: new Date(m.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
                        }),
                    }

                    setChatMessages(prev => {
                        // Evita duplicatas (ex: mensagem do operador já adicionada como temp)
                        if (prev.some(x => x.id === newMsg.id)) return prev
                        // Substitui mensagem temporária do operador pelo registro real
                        const tempIdx = prev.findIndex(x => x.id.startsWith('temp-') && x.text === newMsg.text && x.from === 'operador')
                        if (tempIdx !== -1) {
                            const next = [...prev]
                            next[tempIdx] = newMsg
                            return next
                        }
                        return [...prev, newMsg]
                    })
                }
            )
            .subscribe((status, err) => {
                console.log(`[realtime] chat-messages-${chatId} status:`, status)
                if (err) console.error('[realtime] erro:', err)
                // SUBSCRIBED = OK
                // CHANNEL_ERROR = problema de credencial ou RLS
                // CLOSED = canal destruído (StrictMode ou cleanup prematuro)
                // TIMED_OUT = problema de rede/websocket
            })

        realtimeChannelRef.current = channel
    }

    async function openChat(ag: Agendamento) {
        setSelectedAg(ag)
        setModalOpen(true)
        setChatLoading(true)
        setChatMessages([])
        setActiveChatId(null)

        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current)
            realtimeChannelRef.current = null
        }

        if (ag.paciente_telefone) {
            const { chatId, messages } = await fetchChatHistory(ag.paciente_telefone)
            setChatMessages(messages)

            if (chatId) {
                setActiveChatId(chatId)
                subscribeToChat(chatId)

                // Carrega handoff atual do chat
                const { data: chatData } = await supabase
                    .from('chats')
                    .select('handoff')
                    .eq('id', chatId)
                    .single()
                setHandoff(chatData?.handoff ?? false)
            }
        }

        setChatLoading(false)
    }

    function closeModal() {
        setModalOpen(false)
        setSelectedAg(null)
        setChatMessages([])
        setInputText('')
        setActiveChatId(null)
        setHandoff(false)
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current)
            realtimeChannelRef.current = null
        }
    }

    async function handleSend() {
        if (!inputText.trim() || !selectedAg?.paciente_telefone || sending) return

        const text = inputText.trim()
        setInputText('')
        setSending(true)

        const tempMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            from: 'operador',
            text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        }
        setChatMessages(prev => [...prev, tempMsg])

        const zapiPhone = formatToZAPI(selectedAg.paciente_telefone)
        const remotejID = `${zapiPhone}@s.whatsapp.net`

        const [zapiOk] = await Promise.all([
            sendZAPIMessage(selectedAg.paciente_telefone, text),
            activeChatId
                ? fetch('/api/messages/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: activeChatId,
                        remote_jid: remotejID,
                        body: text,
                        direction: 'outgoing',
                        sent_by: 'operador',
                    }),
                }).catch(() => null)
                : Promise.resolve(null),
        ])

        if (!zapiOk) {
            setChatMessages(prev => prev.filter(m => m.id !== tempMsg.id))
            alert('Falha ao enviar mensagem. Tente novamente.')
            setInputText(text)
        }

        setSending(false)
        textareaRef.current?.focus()
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    async function toggleHandoff() {
        if (!activeChatId) return
        const newValue = !handoff
        await supabase.from('chats').update({ handoff: newValue }).eq('id', activeChatId)
        setHandoff(newValue)
    }

    function getInitials(nome: string) {
        return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    }

    function getAvatarColor(nome: string) {
        const colors = ['#6B9B7C', '#5a8a6c', '#4a7a5c', '#7aaa8c', '#3a6a4c']
        return colors[nome.charCodeAt(0) % colors.length]
    }

    const filtered = agendamentos.filter(a => filter === 'todos' || a.status === filter)
    const counts = {
        todos: agendamentos.length,
        pendente: agendamentos.filter(a => a.status === 'pendente').length,
        confirmado: agendamentos.filter(a => a.status === 'confirmado').length,
        cancelado: agendamentos.filter(a => a.status === 'cancelado').length,
    }

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-gray)' }}>
                <p>Carregando agendamentos...</p>
            </div>
        )
    }

    return (
        <>
            <div style={{ padding: '32px', maxWidth: '1400px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Agendamentos</h1>
                <p style={{ color: 'var(--text-gray)', fontSize: '14px', marginBottom: '24px' }}>
                    Gerencie os agendamentos criados pela IA. Clique para abrir a conversa com o paciente.
                </p>

                <div className="filter-tabs" style={{ marginBottom: '24px' }}>
                    {['todos', 'pendente', 'confirmado', 'cancelado'].map(f => (
                        <button
                            key={f}
                            className={`ftab${filter === f ? ' active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
                            <span className="count">{counts[f as keyof typeof counts]}</span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.length === 0 && (
                        <div style={{
                            padding: '60px 20px', textAlign: 'center', color: 'var(--text-gray)',
                            background: 'var(--white)', borderRadius: '14px', border: '1px solid var(--border)'
                        }}>
                            <p style={{ fontSize: '14px' }}>Nenhum agendamento {filter !== 'todos' ? filter : ''}</p>
                        </div>
                    )}

                    {filtered.map(ag => (
                        <div
                            key={ag.id}
                            onClick={() => openChat(ag)}
                            style={{
                                background: 'var(--white)', border: '1px solid var(--border)',
                                borderRadius: '14px', padding: '16px 20px',
                                display: 'flex', alignItems: 'center', gap: '16px',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'
                                    ; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(107,155,124,0.1)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                                    ; (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                            }}
                        >
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                background: getAvatarColor(ag.paciente_nome),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0,
                            }}>
                                {getInitials(ag.paciente_nome)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <strong style={{ fontSize: '15px' }}>{ag.paciente_nome}</strong>
                                    <span className={`status-badge ${ag.status}`}>{ag.status}</span>
                                    {ag.origem === 'whatsapp' && <span style={{ fontSize: '12px' }}>🤖 IA</span>}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-gray)', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                    <span>📅 {new Date(ag.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                                    <span style={{ margin: '0 4px' }}>•</span>
                                    <span>👨‍⚕️ {(ag.profissional as any)?.nome}</span>
                                    <span style={{ margin: '0 4px' }}>•</span>
                                    <span>{ag.modalidade}</span>
                                    <span style={{ margin: '0 4px' }}>•</span>
                                    <span>{ag.duracao}min</span>
                                    {ag.paciente_telefone && (
                                        <>
                                            <span style={{ margin: '0 4px' }}>•</span>
                                            <span>📱 {ag.paciente_telefone}</span>
                                        </>
                                    )}
                                </div>
                                {ag.observacoes && (
                                    <p style={{ fontSize: '12px', color: 'var(--text-gray)', marginTop: '6px' }}>
                                        💬 {ag.observacoes}
                                    </p>
                                )}
                            </div>

                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                fontSize: '12px', color: 'var(--primary)', fontWeight: 600,
                                background: 'var(--primary-light)', padding: '6px 12px',
                                borderRadius: '8px', flexShrink: 0,
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Conversar
                            </div>

                            {ag.status === 'pendente' && (
                                <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                    <button className="icon-btn" onClick={(e) => aprovar(ag.id, e)} title="Aprovar"
                                        style={{ background: 'rgba(39,174,96,0.1)', color: 'var(--success)' }}>✓</button>
                                    <button className="icon-btn" onClick={(e) => rejeitar(ag.id, e)} title="Rejeitar"
                                        style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--danger)' }}>✕</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAL CHAT */}
            {modalOpen && selectedAg && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) closeModal() }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px', backdropFilter: 'blur(4px)',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    <div style={{
                        background: 'var(--white)', borderRadius: '20px',
                        width: '100%', maxWidth: '560px', height: '680px',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.2s ease',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px 20px',
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                            display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
                        }}>
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '15px', flexShrink: 0,
                            }}>
                                {getInitials(selectedAg.paciente_nome)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'white', fontWeight: 700, fontSize: '15px', lineHeight: 1.2 }}>
                                    {selectedAg.paciente_nome}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '2px' }}>
                                    {selectedAg.paciente_telefone ?? 'Sem telefone'} · {(selectedAg.profissional as any)?.nome}
                                </div>
                            </div>
                            <div style={{
                                background: 'rgba(255,255,255,0.2)', borderRadius: '20px',
                                padding: '4px 10px', fontSize: '11px', color: 'white',
                                fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                                {new Date(selectedAg.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}
                                {' às '}
                                {new Date(selectedAg.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                            </div>
                            <button onClick={closeModal} style={{
                                width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)',
                                border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px', flexShrink: 0,
                            }}>✕</button>
                        </div>

                        {/* Aviso modo operador / handoff */}
                        <div style={{
                            background: handoff ? 'rgba(231,76,60,0.08)' : 'rgba(243,156,18,0.1)',
                            borderBottom: `1px solid ${handoff ? 'rgba(231,76,60,0.2)' : 'rgba(243,156,18,0.2)'}`,
                            padding: '7px 20px', fontSize: '12px',
                            color: handoff ? '#e74c3c' : 'var(--warning)',
                            fontWeight: 500, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', flexShrink: 0,
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {handoff ? (
                                    <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                        </svg>
                                        Atendimento humano ativo — IA pausada
                                    </>
                                ) : (
                                    <><span>⚡</span> Modo operador — a IA não será ativada nessa conversa</>
                                )}
                            </span>
                            {activeChatId && (
                                <button
                                    onClick={toggleHandoff}
                                    style={{
                                        padding: '3px 10px', borderRadius: '6px', border: 'none',
                                        cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                        background: handoff ? 'rgba(231,76,60,0.15)' : 'rgba(39,174,96,0.15)',
                                        color: handoff ? '#e74c3c' : '#27ae60',
                                    }}
                                >
                                    {handoff ? 'Devolver IA' : 'Assumir atendimento'}
                                </button>
                            )}
                        </div>

                        {/* Mensagens */}
                        <div style={{
                            flex: 1, overflowY: 'auto', padding: '16px 20px',
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            background: 'var(--bg-light)',
                        }}>
                            {chatLoading && (
                                <div style={{ textAlign: 'center', color: 'var(--text-gray)', fontSize: '13px', padding: '20px' }}>
                                    Carregando histórico...
                                </div>
                            )}

                            {!chatLoading && chatMessages.length === 0 && (
                                <div style={{
                                    flex: 1, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-gray)', gap: '8px', paddingTop: '60px',
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <p style={{ fontSize: '13px' }}>
                                        {activeChatId === null ? 'Paciente ainda não iniciou conversa' : 'Nenhuma mensagem anterior'}
                                    </p>
                                </div>
                            )}

                            {chatMessages.map(msg => (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: msg.from === 'operador' ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        maxWidth: '75%', padding: '10px 14px', borderRadius: '16px',
                                        borderBottomRightRadius: msg.from === 'operador' ? '4px' : '16px',
                                        borderBottomLeftRadius: msg.from === 'paciente' ? '4px' : '16px',
                                        background: msg.from === 'operador'
                                            ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                                            : 'var(--white)',
                                        color: msg.from === 'operador' ? 'white' : 'var(--text-dark)',
                                        fontSize: '14px', lineHeight: '1.5',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', wordBreak: 'break-word',
                                    }}>
                                        <div>{msg.text}</div>
                                        <div style={{
                                            fontSize: '10px', marginTop: '4px', opacity: 0.7, textAlign: 'right',
                                            color: msg.from === 'operador' ? 'rgba(255,255,255,0.9)' : 'var(--text-gray)',
                                        }}>
                                            {msg.time}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        {!selectedAg.paciente_telefone ? (
                            <div style={{
                                padding: '16px 20px', background: 'var(--white)',
                                borderTop: '1px solid var(--border)',
                                textAlign: 'center', color: 'var(--text-gray)', fontSize: '13px',
                            }}>
                                Paciente sem telefone — não é possível enviar mensagem
                            </div>
                        ) : (
                            <div style={{ padding: '12px 16px', background: 'var(--white)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                                <div className="input-wrap">
                                    <textarea
                                        ref={textareaRef}
                                        className="msg-textarea"
                                        placeholder="Digite uma mensagem... (Enter para enviar)"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        style={{ resize: 'none' }}
                                    />
                                    <button className="send-btn" onClick={handleSend} disabled={!inputText.trim() || sending}>
                                        {sending ? (
                                            <div style={{
                                                width: '16px', height: '16px',
                                                border: '2px solid rgba(255,255,255,0.4)',
                                                borderTopColor: 'white', borderRadius: '50%',
                                                animation: 'spin 0.7s linear infinite',
                                            }} />
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <line x1="22" y1="2" x2="11" y2="13" />
                                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            `}</style>
        </>
    )
}