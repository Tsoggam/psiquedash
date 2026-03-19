// src/components/internal-chat/InternalChat.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInternalChat, displayNameFromEmail, pvRoomId, type OnlineOperator, type Notification, type Room } from '@/hooks/useInternalChat'
import { InternalMessage } from '@/types'

interface Props {
    operatorEmail: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInitials(email: string) {
    const parts = email.split('@')[0].split(/[._-]/)
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

const AVATAR_COLORS = [
    '#6B9B7C', '#5a8a6c', '#4a7a5c', '#7aaa8b',
    '#8B9B7C', '#6B8B9B', '#9B7C6B', '#7C6B9B',
]
function getAvatarColor(email: string) {
    let hash = 0
    for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function isImage(m?: string | null) { return m?.startsWith('image/') ?? false }
function isPdf(m?: string | null, n?: string | null) {
    return m === 'application/pdf' || n?.toLowerCase().endsWith('.pdf')
}
function isDocx(m?: string | null, n?: string | null) {
    return ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        .includes(m ?? '') || !!n?.toLowerCase().match(/\.(doc|docx)$/)
}
function getFileIcon(m?: string | null, n?: string | null) {
    if (isPdf(m, n)) return '📄'
    if (isDocx(m, n)) return '📝'
    const ext = n?.split('.').pop()?.toLowerCase()
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
    if (['zip', 'rar', '7z'].includes(ext ?? '')) return '🗜️'
    return '📎'
}

/** Renderiza texto com @menções destacadas */
function renderBody(text: string, isMine: boolean): React.ReactNode[] {
    return text.split(/(@\S+)/g).map((part, i) =>
        part.startsWith('@')
            ? <mark key={i} style={{
                background: isMine ? 'rgba(255,255,255,0.28)' : 'rgba(107,155,124,0.18)',
                color: isMine ? 'white' : 'var(--primary-dark)',
                borderRadius: 4, padding: '0 3px', fontWeight: 700,
            }}>{part}</mark>
            : part
    )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    useEffect(() => {
        const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', fn)
        return () => document.removeEventListener('keydown', fn)
    }, [onClose])
    return (
        <div className="ic-lightbox" onClick={onClose}>
            <button className="ic-lightbox-close" onClick={onClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
            <a href={src} target="_blank" rel="noopener noreferrer" className="ic-lightbox-download" onClick={e => e.stopPropagation()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar
            </a>
            <img src={src} alt={alt} className="ic-lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
    )
}

// ─── Notification Toast ───────────────────────────────────────────────────────

function NotificationToast({ notif, onDismiss, onOpen }: {
    notif: Notification
    onDismiss: (id: string) => void
    onOpen: (roomId: string) => void
}) {
    return (
        <div className="ic-notif-toast" onClick={() => { onOpen(notif.roomId); onDismiss(notif.id) }}>
            <div className="ic-notif-avatar" style={{ background: getAvatarColor(notif.fromEmail) }}>
                {getInitials(notif.fromEmail)}
            </div>
            <div className="ic-notif-body">
                <p className="ic-notif-title">
                    {notif.type === 'mention'
                        ? <><strong>{notif.fromName}</strong> te marcou no Geral</>
                        : <><strong>{notif.fromName}</strong> te enviou uma mensagem</>}
                </p>
                <p className="ic-notif-preview">{notif.preview}</p>
            </div>
            <button className="ic-notif-close" onClick={e => { e.stopPropagation(); onDismiss(notif.id) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
    msg: InternalMessage & { room_id?: string; mentions?: string[] }
    isMine: boolean
    roomId: string
    onDelete: (id: number, roomId: string) => void
    onEdit: (id: number, body: string, roomId: string) => void
    onOpenLightbox: (src: string, alt: string) => void
}

function MessageBubble({ msg, isMine, roomId, onDelete, onEdit, onOpenLightbox }: BubbleProps) {
    const [showMenu, setShowMenu] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(msg.body)
    const editRef = useRef<HTMLTextAreaElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!showMenu) return
        const fn = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
        }
        document.addEventListener('mousedown', fn)
        return () => document.removeEventListener('mousedown', fn)
    }, [showMenu])

    useEffect(() => { if (editing) editRef.current?.focus() }, [editing])

    function handleEditSubmit() {
        if (editValue.trim() && editValue.trim() !== msg.body) onEdit(msg.id, editValue.trim(), roomId)
        setEditing(false)
        setShowMenu(false)
    }

    if (msg.deleted_at) {
        return (
            <div className="ic-row" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <span className="ic-deleted">🗑 Mensagem apagada</span>
            </div>
        )
    }

    const hasTextBody = msg.body !== msg.media_name

    return (
        <div className="ic-row" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
            {!isMine && (
                <div className="ic-avatar" style={{ background: getAvatarColor(msg.sender_email) }} title={msg.sender_email}>
                    {getInitials(msg.sender_email)}
                </div>
            )}

            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isMine ? 'flex-end' : 'flex-start',
                maxWidth: '68%', width: '68%', minWidth: 0, position: 'relative',
            }}>
                {!isMine && (
                    <span className="ic-sender-name" style={{ color: getAvatarColor(msg.sender_email) }}>
                        {displayNameFromEmail(msg.sender_email)}
                    </span>
                )}

                <div
                    className={`ic-bubble ${isMine ? 'ic-bubble--mine' : 'ic-bubble--theirs'} ${!editing ? 'ic-bubble--hoverable' : ''}`}
                    style={{ width: 'fit-content', maxWidth: '100%', boxSizing: 'border-box' }}
                >
                    {/* Setinha de ações — estilo ChatWindow */}
                    {isMine && !editing && (
                        <div className="ic-arrow-wrap">
                            <button
                                className={`ic-arrow-btn ic-arrow-btn--out ${showMenu ? 'ic-arrow-btn--active' : ''}`}
                                onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
                                title="Opções"
                            >
                                <svg width="10" height="10" viewBox="0 0 10 6" fill="none">
                                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>

                            {showMenu && (
                                <div ref={menuRef} className="ic-msg-menu">
                                    <button className="ic-msg-menu-btn" onClick={() => { setEditing(true); setShowMenu(false) }}>
                                        <span className="ic-msg-menu-icon"></span> Editar
                                    </button>
                                    <button className="ic-msg-menu-btn ic-msg-menu-btn--danger" onClick={() => { onDelete(msg.id, roomId); setShowMenu(false) }}>
                                        <span className="ic-msg-menu-icon"></span> Apagar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mídia */}
                    {msg.media_url && isImage(msg.media_type) && (
                        <div style={{ marginBottom: hasTextBody ? 6 : 0 }}>
                            <img
                                src={msg.media_url} alt={msg.media_name ?? 'imagem'}
                                className="ic-media-img"
                                onClick={() => onOpenLightbox(msg.media_url!, msg.media_name ?? 'imagem')}
                            />
                        </div>
                    )}

                    {msg.media_url && !isImage(msg.media_type) && (
                        <div style={{ marginBottom: hasTextBody ? 6 : 0 }}>
                            {isPdf(msg.media_type, msg.media_name) || isDocx(msg.media_type, msg.media_name) ? (
                                <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '9px 12px', borderRadius: 10,
                                        background: isMine ? 'rgba(255,255,255,0.15)' : 'var(--bg-light)',
                                        border: `1px solid ${isMine ? 'rgba(255,255,255,0.25)' : 'var(--border)'}`,
                                        textDecoration: 'none', boxSizing: 'border-box' as const,
                                    }}>
                                    <span style={{ fontSize: 18, flexShrink: 0 }}>{getFileIcon(msg.media_type, msg.media_name)}</span>
                                    <span style={{ flex: 1, minWidth: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: isMine ? 'white' : 'var(--text-dark)' }}>
                                        {msg.media_name ?? 'documento'}
                                    </span>
                                </a>
                            ) : (
                                <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                                        color: isMine ? 'white' : 'var(--text-dark)', textDecoration: 'none',
                                        background: isMine ? 'rgba(255,255,255,0.12)' : 'var(--bg-light)',
                                        padding: '7px 10px', borderRadius: 8,
                                        border: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                                    }}>
                                    <span style={{ flexShrink: 0 }}>{getFileIcon(msg.media_type, msg.media_name)}</span>
                                    <span style={{ minWidth: 0, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                        {msg.media_name ?? 'arquivo'}
                                    </span>
                                </a>
                            )}
                        </div>
                    )}

                    {/* Texto */}
                    {hasTextBody && (
                        editing ? (
                            <div className="ic-edit-wrap">
                                <textarea
                                    ref={editRef} value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit() }
                                        if (e.key === 'Escape') { setEditing(false); setEditValue(msg.body) }
                                    }}
                                    className="ic-edit-textarea" rows={2}
                                />
                                <div className="ic-edit-actions">
                                    <button onClick={() => { setEditing(false); setEditValue(msg.body) }} className="ic-edit-btn">Cancelar</button>
                                    <button onClick={handleEditSubmit} className="ic-edit-btn ic-edit-btn--primary">Salvar</button>
                                </div>
                            </div>
                        ) : (
                            <p className={`ic-text ${isMine ? 'ic-text--mine' : ''}`}>
                                {renderBody(msg.body, isMine)}
                            </p>
                        )
                    )}

                    <div className="ic-footer">
                        {msg.edited_at && <span className="ic-edited">editado</span>}
                        <span className="ic-time">{formatTime(msg.created_at)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Sidebar de salas ─────────────────────────────────────────────────────────

function RoomSidebar({ rooms, activeRoom, onSwitch, onlineOperators, operatorEmail, onOpenDM }: {
    rooms: Room[]
    activeRoom: string
    onSwitch: (id: string) => void
    onlineOperators: OnlineOperator[]
    operatorEmail: string
    onOpenDM: (email: string) => void
}) {
    return (
        <div className="ic-sidebar">
            <div className="ic-sidebar-section-label">Canais</div>
            {rooms.filter(r => r.type === 'general').map(r => (
                <button
                    key={r.id}
                    className={`ic-room-item ${activeRoom === r.id ? 'ic-room-item--active' : ''}`}
                    onClick={() => onSwitch(r.id)}
                >
                    <span className="ic-room-icon">#</span>
                    <span className="ic-room-label">{r.label}</span>
                    {r.unread > 0 && <span className="ic-room-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
                </button>
            ))}

            <div className="ic-sidebar-section-label" style={{ marginTop: 12 }}>Mensagens diretas</div>
            {rooms.filter(r => r.type === 'dm').map(r => (
                <button
                    key={r.id}
                    className={`ic-room-item ${activeRoom === r.id ? 'ic-room-item--active' : ''}`}
                    onClick={() => onSwitch(r.id)}
                >
                    <div className="ic-room-dm-avatar" style={{ background: getAvatarColor(r.otherEmail ?? '') }}>
                        {getInitials(r.otherEmail ?? '')}
                    </div>
                    <span className="ic-room-label">{r.label}</span>
                    {r.unread > 0 && <span className="ic-room-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
                </button>
            ))}

            {onlineOperators.length > 0 && (
                <>
                    <div className="ic-sidebar-section-label" style={{ marginTop: 12 }}>Online agora</div>
                    {onlineOperators.map(op => (
                        <button
                            key={op.email}
                            className="ic-room-item ic-room-item--online"
                            onClick={() => onOpenDM(op.email)}
                            title={`Conversa privada com ${op.name}`}
                        >
                            <div className="ic-online-dot-wrap">
                                <div className="ic-room-dm-avatar" style={{ background: getAvatarColor(op.email) }}>
                                    {getInitials(op.email)}
                                </div>
                                <span className="ic-online-dot" />
                            </div>
                            <span className="ic-room-label">{op.name}</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4, flexShrink: 0 }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </button>
                    ))}
                </>
            )}
        </div>
    )
}

// ─── @ Mention Picker ─────────────────────────────────────────────────────────

function MentionPicker({ query, operators, onSelect }: {
    query: string
    operators: OnlineOperator[]
    onSelect: (email: string) => void
}) {
    const filtered = operators.filter(op =>
        op.name.toLowerCase().includes(query.toLowerCase()) ||
        op.email.toLowerCase().includes(query.toLowerCase())
    )
    if (filtered.length === 0) return null
    return (
        <div className="ic-mention-picker">
            {filtered.map(op => (
                <button key={op.email} className="ic-mention-item" onMouseDown={e => { e.preventDefault(); onSelect(op.email) }}>
                    <div className="ic-mention-avatar" style={{ background: getAvatarColor(op.email) }}>
                        {getInitials(op.email)}
                    </div>
                    <div>
                        <div className="ic-mention-name">{op.name}</div>
                        <div className="ic-mention-email">{op.email.split('@')[0]}</div>
                    </div>
                    <span className="ic-online-dot" style={{ marginLeft: 'auto' }} />
                </button>
            ))}
        </div>
    )
}

// ─── Principal ────────────────────────────────────────────────────────────────

export default function InternalChat({ operatorEmail }: Props) {
    const {
        isOpen, openChat, closeChat,
        activeRoom, switchRoom, openDM, rooms,
        messages, loading, sending, totalUnread,
        onlineOperators,
        notifications, dismissNotification,
        sendMessage, deleteMessage, editMessage,
    } = useInternalChat(operatorEmail)

    const [text, setText] = useState('')
    const [dragging, setDragging] = useState(false)
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
    const [mentionQuery, setMentionQuery] = useState<string | null>(null)
    const [pendingMentions, setPendingMentions] = useState<string[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }, [isOpen, messages.length])

    // Detecta @ no textarea para abrir mention picker
    function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const val = e.target.value
        setText(val)

        const cursor = e.target.selectionStart ?? val.length
        const textBeforeCursor = val.slice(0, cursor)
        const atMatch = textBeforeCursor.match(/@(\w*)$/)
        if (atMatch) {
            setMentionQuery(atMatch[1])
        } else {
            setMentionQuery(null)
        }
    }

    function insertMention(email: string) {
        const name = displayNameFromEmail(email)
        const cursor = textareaRef.current?.selectionStart ?? text.length
        const textBefore = text.slice(0, cursor)
        const textAfter = text.slice(cursor)
        const replaced = textBefore.replace(/@\w*$/, `@${name} `)
        setText(replaced + textAfter)
        setPendingMentions(prev => Array.from(new Set([...prev, email])))
        setMentionQuery(null)
        setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleSend = useCallback(async () => {
        if (!text.trim() || sending) return
        const t = text.trim()
        setText('')
        setPendingMentions([])
        setMentionQuery(null)
        await sendMessage(t, undefined, pendingMentions)
    }, [text, sending, sendMessage, pendingMentions])

    function handleKeyDown(e: React.KeyboardEvent) {
        if (mentionQuery !== null && e.key === 'Escape') { setMentionQuery(null); return }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    const handleFile = useCallback(async (file: File) => {
        const reader = new FileReader()
        reader.onload = async (ev) => {
            const base64 = (ev.target?.result as string).split(',')[1]
            await sendMessage(text.trim(), { base64, mimeType: file.type, fileName: file.name }, pendingMentions)
            setText('')
            setPendingMentions([])
        }
        reader.readAsDataURL(file)
    }, [sendMessage, text, pendingMentions])

    // Determina título da sala ativa
    const activeRoomData = rooms.find(r => r.id === activeRoom)
    const roomTitle = activeRoomData?.type === 'general' ? '# Geral' : activeRoomData?.label ?? activeRoom

    function renderMessages() {
        const items: React.ReactNode[] = []
        let lastDate = ''
        messages.forEach((msg, i) => {
            const label = formatDate(msg.created_at)
            if (label !== lastDate) {
                lastDate = label
                items.push(<div key={`d-${i}`} className="ic-date-divider"><span>{label}</span></div>)
            }
            items.push(
                <MessageBubble
                    key={msg.id}
                    msg={msg as any}
                    isMine={msg.sender_email === operatorEmail}
                    roomId={activeRoom}
                    onDelete={deleteMessage}
                    onEdit={editMessage}
                    onOpenLightbox={(src, alt) => setLightbox({ src, alt })}
                />
            )
        })
        return items
    }

    return (
        <>
            {/* Lightbox */}
            {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

            {/* Notification Toasts */}
            <div className="ic-notif-stack">
                {notifications.map(n => (
                    <NotificationToast
                        key={n.id} notif={n}
                        onDismiss={dismissNotification}
                        onOpen={(roomId) => {
                            switchRoom(roomId)
                            openChat()
                        }}
                    />
                ))}
            </div>

            {/* FAB */}
            <button className="ic-fab" onClick={isOpen ? closeChat : openChat} title="Chat interno da equipe">
                {isOpen ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" />
                        <path d="M15 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h2a2 2 0 0 0 2-2V6z" />
                    </svg>
                )}
                {totalUnread > 0 && !isOpen && (
                    <span className="ic-fab-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
                )}
            </button>

            {/* Panel */}
            {isOpen && (
                <>
                    <div className="ic-backdrop" onClick={closeChat} />
                    <div
                        className="ic-panel"
                        onDragOver={e => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => {
                            e.preventDefault(); setDragging(false)
                            const file = e.dataTransfer.files?.[0]
                            if (file) handleFile(file)
                        }}
                    >
                        {/* Sidebar */}
                        <RoomSidebar
                            rooms={rooms}
                            activeRoom={activeRoom}
                            onSwitch={switchRoom}
                            onlineOperators={onlineOperators}
                            operatorEmail={operatorEmail ?? ''}
                            onOpenDM={openDM}
                        />

                        {/* Chat area */}
                        <div className="ic-chat-area">
                            {/* Header */}
                            <div className="ic-panel-header">
                                <div className="ic-panel-title">
                                    <div className="ic-panel-icon">
                                        {activeRoomData?.type === 'general' ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" />
                                                <path d="M15 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h2a2 2 0 0 0 2-2V6z" />
                                            </svg>
                                        ) : (
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: getAvatarColor(activeRoomData?.otherEmail ?? ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>
                                                {getInitials(activeRoomData?.otherEmail ?? '')}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="ic-panel-name">{roomTitle}</div>
                                        <div className="ic-panel-sub">
                                            {activeRoomData?.type === 'general'
                                                ? `${onlineOperators.length + 1} online`
                                                : activeRoomData?.otherEmail}
                                        </div>
                                    </div>
                                </div>
                                <button className="icon-btn" onClick={closeChat} title="Fechar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="ic-messages">
                                {loading ? (
                                    <div className="ic-state-empty">
                                        <span className="ic-loading-spinner" /><span>Carregando...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="ic-state-empty">
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586" />
                                            <path d="M15 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h2a2 2 0 0 0 2-2V6z" />
                                        </svg>
                                        <span>Nenhuma mensagem ainda.</span>
                                        <span style={{ fontSize: 11, opacity: 0.6 }}>
                                            {activeRoomData?.type === 'general' ? 'Seja o primeiro. 🍀' : 'Inicie a conversa.'}
                                        </span>
                                    </div>
                                ) : renderMessages()}
                                <div ref={bottomRef} />
                            </div>

                            {dragging && (
                                <div className="ic-drag-overlay"><span>Solte o arquivo aqui</span></div>
                            )}

                            {/* Input */}
                            <div className="ic-input-area">
                                {mentionQuery !== null && activeRoom === 'general' && (
                                    <MentionPicker
                                        query={mentionQuery}
                                        operators={onlineOperators}
                                        onSelect={insertMention}
                                    />
                                )}
                                <div className="input-wrap ic-input-wrap">
                                    <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Enviar arquivo">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                    </button>
                                    <input ref={fileInputRef} type="file"
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                        style={{ display: 'none' }}
                                        onChange={e => {
                                            const file = e.target.files?.[0]
                                            if (file) handleFile(file)
                                            e.target.value = ''
                                        }}
                                    />
                                    <textarea
                                        ref={textareaRef}
                                        className="msg-textarea"
                                        value={text}
                                        onChange={handleTextChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder={activeRoom === 'general' ? 'Mensagem para a equipe... (@ para mencionar)' : `Mensagem privada...`}
                                        rows={1}
                                    />
                                    <button className="send-btn" onClick={handleSend} disabled={sending || !text.trim()} title="Enviar (Enter)">
                                        {sending ? (
                                            <span className="ic-send-spinner" />
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                                <line x1="22" y1="2" x2="11" y2="13" />
                                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <style>{`
        /* ── FAB ──────────────────────────────────────────────────── */
        .ic-fab {
          position: fixed; bottom: 70px; left: 10px;
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border: none; cursor: pointer; color: white;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(107,155,124,0.45);
          z-index: 1000; transition: transform 0.2s, box-shadow 0.2s;
        }
        .ic-fab:hover { transform: scale(1.07); box-shadow: 0 6px 22px rgba(107,155,124,0.55); }
        .ic-fab-badge {
          position: absolute; top: -3px; left: -3px;
          min-width: 18px; height: 18px; background: var(--danger);
          border-radius: 9px; font-size: 10px; font-weight: 700; color: #fff;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid var(--bg-light);
        }

        /* ── Backdrop + Panel ─────────────────────────────────────── */
        .ic-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35);
          backdrop-filter: blur(2px); z-index: 1001; animation: ic-fadein 0.2s ease;
        }
        .ic-panel {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: min(960px, 92vw); height: min(680px, 88vh);
          background: var(--white); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.2);
          z-index: 1002; display: flex; overflow: hidden;
          animation: ic-slidein 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes ic-slidein {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        /* ── Sidebar ──────────────────────────────────────────────── */
        .ic-sidebar {
          width: 200px; min-width: 200px; flex-shrink: 0;
          background: var(--bg-lighter); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 14px 8px;
          overflow-y: auto; gap: 2px;
        }
        .ic-sidebar::-webkit-scrollbar { width: 3px; }
        .ic-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .ic-sidebar-section-label {
          font-size: 10px; font-weight: 700; color: var(--text-gray);
          text-transform: uppercase; letter-spacing: 0.08em;
          padding: 0 8px; margin-bottom: 4px; margin-top: 2px;
        }
        .ic-room-item {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 8px; border-radius: 8px; border: none;
          background: transparent; cursor: pointer; width: 100%;
          text-align: left; transition: background 0.12s; font-family: inherit;
          color: var(--text-gray); font-size: 13px;
        }
        .ic-room-item:hover { background: rgba(107,155,124,0.1); color: var(--text-dark); }
        .ic-room-item--active { background: rgba(107,155,124,0.15); color: var(--primary-dark); font-weight: 600; }
        .ic-room-item--online { color: var(--text-dark); }
        .ic-room-icon { font-size: 15px; font-weight: 700; color: var(--text-gray); width: 18px; text-align: center; flex-shrink: 0; }
        .ic-room-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ic-room-badge {
          flex-shrink: 0; background: var(--danger); color: #fff;
          border-radius: 8px; font-size: 10px; font-weight: 700;
          padding: 1px 5px; min-width: 16px; text-align: center;
        }
        .ic-room-dm-avatar {
          width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 8px; font-weight: 700; color: white;
        }
        .ic-online-dot-wrap { position: relative; flex-shrink: 0; }
        .ic-online-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #27ae60;
          border: 2px solid var(--bg-lighter); flex-shrink: 0;
        }
        .ic-online-dot-wrap .ic-online-dot {
          position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px;
        }

        /* ── Chat area ────────────────────────────────────────────── */
        .ic-chat-area {
          flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative;
        }
        .ic-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid var(--border);
          background: var(--white); flex-shrink: 0;
        }
        .ic-panel-title { display: flex; align-items: center; gap: 12px; }
        .ic-panel-icon {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          display: flex; align-items: center; justify-content: center;
          color: white; box-shadow: 0 3px 8px rgba(107,155,124,0.3); flex-shrink: 0;
          overflow: hidden;
        }
        .ic-panel-name { font-size: 14px; font-weight: 700; color: var(--text-dark); line-height: 1.2; }
        .ic-panel-sub { font-size: 11px; color: var(--text-gray); margin-top: 1px; }

        /* ── Messages ─────────────────────────────────────────────── */
        .ic-messages {
          flex: 1; overflow-y: auto; padding: 16px 20px;
          display: flex; flex-direction: column; align-items: flex-start;
          scroll-behavior: smooth;
        }
        .ic-messages::-webkit-scrollbar { width: 4px; }
        .ic-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .ic-state-empty {
          flex: 1; display: flex; flex-direction: column; align-self: center;
          align-items: center; justify-content: center;
          gap: 10px; color: var(--text-gray); font-size: 13px; height: 100%; width: 100%;
        }
        .ic-date-divider { text-align: center; margin: 14px 0 8px; width: 100%; }
        .ic-date-divider span {
          background: var(--white); border: 1px solid var(--border);
          color: var(--text-gray); font-size: 11px; font-weight: 600;
          padding: 4px 14px; border-radius: 20px; box-shadow: 0 1px 4px var(--shadow);
        }
        .ic-row {
          display: flex; align-items: flex-end; gap: 8px;
          margin-bottom: 4px; width: 100%;
        }
        .ic-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: white; flex-shrink: 0; margin-bottom: 2px;
        }
        .ic-sender-name { font-size: 11px; font-weight: 600; margin-bottom: 3px; padding-left: 2px; }
        .ic-bubble {
          padding: 10px 14px; border-radius: 18px;
          position: relative; word-break: break-word;
          box-shadow: 0 1px 3px var(--shadow);
        }
        .ic-bubble--theirs { background: var(--bg-lighter); border-bottom-left-radius: 4px; }
        .ic-bubble--mine {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-bottom-right-radius: 4px;
        }
        .ic-text { margin: 0; font-size: 14px; color: var(--text-dark); line-height: 1.5; white-space: pre-wrap; }
        .ic-text--mine { color: white; }
        .ic-footer { display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 4px; }
        .ic-edited { font-size: 10px; color: var(--text-gray); font-style: italic; }
        .ic-bubble--mine .ic-edited { color: rgba(255,255,255,0.65); }
        .ic-time { font-size: 11px; color: var(--text-gray); opacity: 0.85; }
        .ic-bubble--mine .ic-time { color: rgba(255,255,255,0.75); opacity: 1; }
        .ic-deleted {
          font-size: 13px; color: var(--text-gray); font-style: italic;
          background: var(--bg-lighter); border: 1px solid var(--border);
          padding: 5px 14px; border-radius: 14px;
        }
        .ic-media-img {
          max-width: 240px; max-height: 200px; border-radius: 10px;
          object-fit: cover; display: block; cursor: zoom-in; transition: opacity 0.15s;
        }
        .ic-media-img:hover { opacity: 0.88; }

        /* ── Arrow button (estilo ChatWindow) ─────────────────────── */
        .ic-arrow-wrap {
          position: absolute; top: 0; right: 0; z-index: 10;
          display: flex; flex-direction: column; align-items: flex-end;
          pointer-events: none;
        }
        .ic-arrow-btn {
          width: 28px; height: 22px; border: none;
          border-radius: 0 18px 0 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; pointer-events: all;
          transition: opacity 0.15s, background 0.15s;
        }
        .ic-arrow-btn--out {
          background: linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.22) 100%);
          color: rgba(255,255,255,0.9);
        }
        .ic-arrow-btn--active,
        .ic-arrow-btn:hover { opacity: 1 !important; }
        .ic-arrow-btn--out:hover,
        .ic-arrow-btn--out.ic-arrow-btn--active { background: rgba(0,0,0,0.3); color: white; }
        .ic-bubble--hoverable:hover .ic-arrow-btn { opacity: 1; }

        /* ── Message menu ─────────────────────────────────────────── */
        .ic-msg-menu {
          position: absolute; top: 26px; right: 0; z-index: 200;
          background: var(--white); border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden; min-width: 140px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08);
          animation: ic-menu-pop 0.12s cubic-bezier(0.34,1.56,0.64,1);
          pointer-events: all;
        }
        @keyframes ic-menu-pop {
          from { opacity: 0; transform: scale(0.88) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .ic-msg-menu-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px 14px; background: transparent; border: none;
          color: var(--text-dark); font-size: 13px; font-family: inherit;
          cursor: pointer; text-align: left; white-space: nowrap; transition: background 0.1s;
        }
        .ic-msg-menu-btn:hover { background: var(--bg-lighter); }
        .ic-msg-menu-btn + .ic-msg-menu-btn { border-top: 1px solid var(--border); }
        .ic-msg-menu-btn--danger { color: var(--danger); }
        .ic-msg-menu-btn--danger:hover { background: rgba(231,76,60,0.07); }
        .ic-msg-menu-icon { font-size: 14px; opacity: 0.7; width: 18px; text-align: center; flex-shrink: 0; }

        /* ── Edit inline ──────────────────────────────────────────── */
        .ic-edit-wrap { display: flex; flex-direction: column; gap: 6px; }
        .ic-edit-textarea {
          background: rgba(0,0,0,0.06); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-dark);
          font-size: 13px; font-family: inherit; padding: 6px 8px;
          resize: none; outline: none; width: 100%;
        }
        .ic-bubble--mine .ic-edit-textarea { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white; }
        .ic-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .ic-edit-btn {
          padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border);
          font-size: 12px; font-family: inherit; cursor: pointer;
          background: var(--bg-lighter); color: var(--text-dark); transition: background 0.15s;
        }
        .ic-edit-btn:hover { background: var(--border); }
        .ic-edit-btn--primary { background: var(--primary); border-color: var(--primary); color: white; }
        .ic-edit-btn--primary:hover { background: var(--primary-dark); }

        /* ── Input area ───────────────────────────────────────────── */
        .ic-input-area { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--white); flex-shrink: 0; position: relative; }
        .ic-input-wrap { border-radius: 14px !important; padding: 8px 12px !important; }

        /* ── @ Mention picker ─────────────────────────────────────── */
        .ic-mention-picker {
          position: absolute; bottom: calc(100% - 4px); left: 16px; right: 16px;
          background: var(--white); border: 1px solid var(--border);
          border-radius: 12px; box-shadow: 0 -8px 24px rgba(0,0,0,0.12);
          overflow: hidden; max-height: 200px; overflow-y: auto; z-index: 50;
          animation: ic-menu-pop 0.12s ease;
        }
        .ic-mention-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 9px 14px; background: transparent; border: none;
          cursor: pointer; font-family: inherit; transition: background 0.1s;
        }
        .ic-mention-item:hover { background: var(--bg-lighter); }
        .ic-mention-item + .ic-mention-item { border-top: 1px solid var(--border); }
        .ic-mention-avatar {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: white;
        }
        .ic-mention-name { font-size: 13px; font-weight: 600; color: var(--text-dark); }
        .ic-mention-email { font-size: 11px; color: var(--text-gray); }

        /* ── Notification toasts ──────────────────────────────────── */
        .ic-notif-stack {
          position: fixed; bottom: 130px; left: 16px;
          display: flex; flex-direction: column; gap: 8px;
          z-index: 2000; pointer-events: none;
        }
        .ic-notif-toast {
          display: flex; align-items: flex-start; gap: 10px;
          background: var(--white); border: 1px solid var(--border);
          border-left: 3px solid var(--primary); border-radius: 12px;
          padding: 10px 12px; width: 280px; cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          animation: ic-toast-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
          pointer-events: all; transition: opacity 0.2s;
        }
        .ic-notif-toast:hover { opacity: 0.92; }
        @keyframes ic-toast-in {
          from { opacity: 0; transform: translateX(-20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        .ic-notif-avatar {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: white;
        }
        .ic-notif-body { flex: 1; min-width: 0; }
        .ic-notif-title { font-size: 12px; color: var(--text-dark); margin: 0 0 2px; line-height: 1.4; }
        .ic-notif-preview { font-size: 11px; color: var(--text-gray); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ic-notif-close {
          flex-shrink: 0; background: none; border: none; cursor: pointer;
          color: var(--text-gray); padding: 2px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          transition: color 0.15s;
        }
        .ic-notif-close:hover { color: var(--text-dark); }

        /* ── Drag overlay ─────────────────────────────────────────── */
        .ic-drag-overlay {
          position: absolute; inset: 0;
          background: var(--primary-light); border: 2px dashed var(--primary);
          border-radius: 0 20px 20px 0; display: flex; align-items: center; justify-content: center;
          z-index: 5; pointer-events: none;
        }
        .ic-drag-overlay span { font-size: 14px; font-weight: 600; color: var(--primary); }

        /* ── Spinners / Lightbox / Doc ────────────────────────────── */
        .ic-loading-spinner {
          width: 22px; height: 22px; border: 2px solid var(--border);
          border-top-color: var(--primary); border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .ic-send-spinner {
          width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .ic-lightbox {
          position: fixed; inset: 0; background: rgba(0,0,0,0.88);
          display: flex; align-items: center; justify-content: center;
          z-index: 3000; cursor: zoom-out; animation: ic-fadein 0.18s ease;
        }
        .ic-lightbox-img {
          max-width: 90vw; max-height: 85vh; border-radius: 10px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5); cursor: default; object-fit: contain;
        }
        .ic-lightbox-close {
          position: absolute; top: 18px; right: 18px; width: 38px; height: 38px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%; color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: background 0.15s;
        }
        .ic-lightbox-close:hover { background: rgba(255,255,255,0.2); }
        .ic-lightbox-download {
          position: absolute; top: 18px; right: 68px;
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px; color: white; font-size: 12px; font-weight: 600;
          padding: 0 14px; height: 38px; text-decoration: none;
          transition: background 0.15s; font-family: inherit;
        }
        .ic-lightbox-download:hover { background: rgba(255,255,255,0.2); }

        @keyframes ic-fadein { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
        </>
    )
}