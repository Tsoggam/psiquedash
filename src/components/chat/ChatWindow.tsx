// src/components/chat/ChatWindow.tsx
'use client'

import { useEffect, useRef, useState, KeyboardEvent, useCallback } from 'react'
import { Chat, Message } from '@/types'
import { displayName, parsePhone } from '@/lib/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KanbanStatus } from '@/hooks/useKanban'
import { useCommands, Command } from '@/hooks/useCommands'
import CommandPalette from './CommandPalette'

interface Props {
  chat: Chat
  messages: Message[]
  sending: boolean
  operatorEmail: string | null
  onSend: (text: string, file?: { base64: string; mimeType: string; fileName: string }, replyToMessageId?: string | null) => void
  onDeleteMessage?: (messageId: number) => void
  onStatusChange: (status: string) => void
  onHandoffToggle: () => void
  onAssume: () => void
  onFinalize: () => void
  onBack?: () => void
  onClose?: () => void
}

// ─── Emoji data (subset + categorias) ───────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    label: '😀 Rostos',
    emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '🥴', '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🥳', '🥺', '🤠', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓'],
  },
  {
    label: '👋 Gestos',
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '👀', '👁', '👅', '👄'],
  },
  {
    label: '❤️ Corações',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☯️', '🕉️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️'],
  },
  {
    label: '🎉 Comemorações',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🎗️', '🎟️', '🎫', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎷', '🥁', '🎸', '🎹', '🎺', '🎻', '🪕', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
  },
  {
    label: '🌿 Natureza',
    emojis: ['🌱', '🌿', '🍀', '🍁', '🍂', '🍃', '🌺', '🌸', '🌼', '🌻', '🌹', '🥀', '🌷', '🌾', '☘️', '🍄', '🌰', '🦔', '🐾', '🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌛', '🌜', '🌝', '🌞', '⭐', '🌟', '💫', '✨', '☀️', '🌤️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌀'],
  },
  {
    label: '✅ Símbolos',
    emojis: ['✅', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔲', '🔳', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⚠️', '🚫', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '📶', '🔱'],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMsgDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd 'de' MMMM", { locale: ptBR })
}

function formatMsgTime(dateStr: string) {
  return format(new Date(dateStr), 'HH:mm')
}

const KANBAN_LABELS: Record<KanbanStatus, { label: string; color: string; bg: string }> = {
  novo: { label: 'Novo', color: '#2E86C1', bg: '#EBF5FB' },
  emergencia: { label: 'Urgência', color: '#E74C3C', bg: '#FDEDEC' },
  em_atendimento: { label: 'Em Atendimento', color: '#D4AC0D', bg: '#FEF9E7' },
  agendamento_ia: { label: 'Agendamento IA', color: '#8E44AD', bg: '#F5EEF8' },
  finalizado: { label: 'Finalizado', color: '#27AE60', bg: '#EAFAF1' },
}

// ── Sem auto-fill para single match — só lista na palette ──────────────────
function matchCommands(query: string, available: Command[]): Command[] {
  if (!query || query === '/') return available.slice(0, 20)
  const q = query.toLowerCase().replace(/^\//, '')
  return available.filter(c => c.command.toLowerCase().replace(/^\//, '').includes(q))
}

function renderBody(text: string): React.ReactNode[] {
  return text.split('\n').flatMap((line, lineIdx, lines) => {
    const parts = line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g).map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) return <strong key={`${lineIdx}-${i}`}>{part.slice(1, -1)}</strong>
      if (part.startsWith('_') && part.endsWith('_')) return <em key={`${lineIdx}-${i}`}>{part.slice(1, -1)}</em>
      if (part.startsWith('~') && part.endsWith('~')) return <s key={`${lineIdx}-${i}`}>{part.slice(1, -1)}</s>
      return part
    })
    return lineIdx < lines.length - 1 ? [...parts, <br key={`br-${lineIdx}`} />] : parts
  })
}
// ─── Helpers de mídia ────────────────────────────────────────────────────────
function isPdf(mimeType?: string | null, fileName?: string | null) {
  return mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')
}
function isDocx(mimeType?: string | null, fileName?: string | null) {
  return ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    .includes(mimeType ?? '') || !!fileName?.toLowerCase().match(/\.(doc|docx)$/)
}
function getFileIcon(mimeType?: string | null, fileName?: string | null) {
  if (isPdf(mimeType, fileName)) return '📄'
  if (isDocx(mimeType, fileName)) return '📝'
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
  if (['zip', 'rar', '7z'].includes(ext ?? '')) return '🗜️'
  if (['txt', 'csv'].includes(ext ?? '')) return '📃'
  return '📎'
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, cursor: 'zoom-out', animation: 'fadein 0.18s ease',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 18, width: 38, height: 38,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '50%', color: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <a href={src} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: 18, right: 68,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 20, color: 'white', fontSize: 12, fontWeight: 600,
        padding: '0 14px', height: 38, textDecoration: 'none',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Baixar
      </a>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()} style={{
        maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', objectFit: 'contain', cursor: 'default',
      }} />
    </div>
  )
}

// ─── DocPreview ───────────────────────────────────────────────────────────────
function DocPreview({ url, fileName, mimeType, onClose }: {
  url: string; fileName: string; mimeType?: string | null; onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const fn = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  const src = isPdf(mimeType, fileName) ? url
    : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 900, height: '90vh', background: 'var(--white)',
        borderRadius: 16, border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-lighter)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span>{getFileIcon(mimeType, fileName)}</span>
            <span style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-dark)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{fileName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
              color: 'var(--primary)', textDecoration: 'none',
              background: 'rgba(107,155,124,0.1)', border: '1px solid var(--border)',
              padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Baixar
            </a>
            <button className="icon-btn" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              color: 'var(--text-gray)', fontSize: 13,
            }}>
              <div style={{
                width: 22, height: 22, border: '2px solid var(--border)',
                borderTopColor: 'var(--primary)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Carregando documento...
            </div>
          )}
          <iframe src={src} title={fileName} onLoad={() => setLoading(false)}
            style={{ width: '100%', height: '100%', border: 'none', opacity: loading ? 0 : 1, transition: 'opacity 0.2s' }}
          />
        </div>
      </div>
    </div>
  )
}


// ─── Allowed file types ──────────────────────────────────────────────────────
const ALLOWED_TYPES = [
  // Imagens
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Documentos
  'application/pdf',
  'application/msword',                                                              // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',        // .docx
  'application/vnd.ms-excel',                                                       // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',              // .xlsx
  'application/vnd.ms-powerpoint',                                                  // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',      // .pptx
  'text/plain',                                                                      // .txt
  'text/csv',                                                                        // .csv
  'application/zip',                                                                 // .zip
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Avatar helpers ──────────────────────────────────────────────────────────
function getAvatarInitials(chat: Chat): string {
  if (chat.name) return chat.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const phone = chat.phone ?? parsePhone(chat.remotejID)
  return phone.slice(-4, -2)
}

// ─── AudioPlayer ─────────────────────────────────────────────────────────────
function AudioPlayer({ src, outgoing }: { src: string; outgoing: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
    setPlaying(!playing)
  }

  function onTimeUpdate() {
    const a = audioRef.current!
    setCurrentTime(a.currentTime)
    setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0)
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration ?? 0)
  }

  function onEnded() { setPlaying(false); setProgress(0); setCurrentTime(0) }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    a.currentTime = pct * a.duration
  }

  function fmt(s: number) {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const track = outgoing ? 'rgba(255,255,255,0.35)' : 'rgba(107,155,124,0.25)'
  const fill = outgoing ? 'rgba(255,255,255,0.9)' : '#4a7a5c'
  const btnBg = outgoing ? 'rgba(255,255,255,0.2)' : 'rgba(107,155,124,0.15)'
  const textColor = outgoing ? 'rgba(255,255,255,0.75)' : '#6b7a7a'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', marginBottom: 4, minWidth: 210, maxWidth: 260 }}>
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata} onEnded={onEnded} />

      {/* Play/Pause */}
      <button onClick={toggle} style={{
        width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: btnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={fill}>
            <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={fill}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Barra + tempo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div onClick={seek} style={{
          height: 4, borderRadius: 2, background: track, cursor: 'pointer', position: 'relative',
        }}>
          <div style={{ height: '100%', width: `${progress}%`, background: fill, borderRadius: 2, transition: 'width 0.1s linear' }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${progress}%`,
            transform: 'translate(-50%, -50%)',
            width: 10, height: 10, borderRadius: '50%', background: fill,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: textColor }}>
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ChatWindow({
  chat, messages, sending, operatorEmail,
  onSend, onDeleteMessage, onAssume, onFinalize, onBack, onClose,
}: Props) {
  const { commands: dbCommands } = useCommands()
  const [input, setInput] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteMatches, setPaletteMatches] = useState<Command[]>([])
  const [paletteIndex, setPaletteIndex] = useState(0)

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiCat, setEmojiCat] = useState(0)
  const emojiRef = useRef<HTMLDivElement>(null)

  // Lightbox + doc preview
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [docPreview, setDocPreview] = useState<{ url: string; fileName: string; mimeType?: string | null } | null>(null)
  // Menu de mensagem (hover) — guarda o id da mensagem com menu aberto
  const [msgMenu, setMsgMenu] = useState<number | null>(null)
  const [msgMenuPos, setMsgMenuPos] = useState<'left' | 'right'>('right')

  // Seleção múltipla
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Responder mensagem
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // Refs de mensagens para scroll
  const msgRefs = useRef<Record<number, HTMLDivElement | null>>({})

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function copySelectedMessages() {
    const text = messages
      .filter(m => selectedIds.has(m.id))
      .map(m => m.body ?? '')
      .join('\n')
    navigator.clipboard.writeText(text)
    exitSelectMode()
  }

  function deleteSelectedMessages() {
    selectedIds.forEach(id => onDeleteMessage?.(id))
    exitSelectMode()
  }

  function scrollToMessage(id: number) {
    const el = msgRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.background = 'rgba(107,155,124,0.18)'
      setTimeout(() => { el.style.background = '' }, 1200)
    }
  }

  // File attachment
  const [pendingFile, setPendingFile] = useState<{ base64: string; mimeType: string; fileName: string; preview?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Gravação de áudio
  const [recording, setRecording] = useState(false)
  const [recordingSecs, setRecordingSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    if (isFinalized) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus'
          : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          setPendingFile({ base64, mimeType: mimeType.split(';')[0], fileName: `audio_${Date.now()}.${ext}` })
        }
        reader.readAsDataURL(blob)
      }
      mr.start(100)
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingSecs(0)
      recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000)
    } catch {
      alert('Permissão de microfone negada.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecording(false)
    setRecordingSecs(0)
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null // cancela o handler
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current = null
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    audioChunksRef.current = []
    setRecording(false)
    setRecordingSecs(0)
  }

  function formatSecs(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const kanbanStatus = (chat.kanban_status ?? 'novo') as KanbanStatus
  const statusInfo = KANBAN_LABELS[kanbanStatus]
  const isOwner = chat.operator_id === operatorEmail
  const canAssume = kanbanStatus === 'novo' || kanbanStatus === 'emergencia'
  const canFinalize = kanbanStatus === 'em_atendimento' && isOwner
  const isFinalized = kanbanStatus === 'finalizado'

  // Avatar: usa profile_image se disponível
  const avatarUrl: string | undefined = (chat as any).profile_image ?? undefined
  const [avatarError, setAvatarError] = useState(false)
  useEffect(() => { setAvatarError(false) }, [avatarUrl])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [emojiOpen])

  // ── Palette logic — SEM auto-fill no single match ──────────────────────────
  useEffect(() => {
    if (!input.startsWith('/')) {
      setPaletteOpen(false)
      return
    }
    const matches = matchCommands(input, dbCommands)
    setPaletteMatches(matches)
    setPaletteIndex(0)
    // ✅ REMOVIDO: auto-fill para single match
    // Agora sempre mostra a palette, deixa o usuário escolher
    setPaletteOpen(matches.length > 0)
  }, [input, dbCommands])

  const selectCommand = useCallback((cmd: Command) => {
    setInput(cmd.body)
    setPaletteOpen(false)
    setTimeout(() => {
      textareaRef.current?.focus()
      if (textareaRef.current) autoResize(textareaRef.current)
    }, 0)
  }, [])

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (paletteOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex(i => Math.min(i + 1, paletteMatches.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); if (paletteMatches[paletteIndex]) selectCommand(paletteMatches[paletteIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setPaletteOpen(false); return }
    }
    // ✅ Enter envia mensagem (mesmo comportamento do botão enviar)
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ✅ handleSend unificado — usado pelo Enter e pelo botão
  function handleSend() {
    const hasText = input.trim().length > 0
    const hasFile = !!pendingFile
    if ((!hasText && !hasFile) || sending) return

    const replyMsgId = replyTo ? (replyTo as any).zapi_message_id ?? null : null

    onSend(input.trim(), pendingFile ?? undefined, replyMsgId)
    setInput('')
    setPendingFile(null)
    setReplyTo(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ✅ File attachment handler
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Tipo de arquivo não suportado. Use imagens, PDF ou documentos Office.')
      return
    }
    if (file.size > 16 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 16MB.')
      return
    }
    const base64 = await fileToBase64(file)
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    setPendingFile({ base64, mimeType: file.type, fileName: file.name, preview })
    // Reset input so same file can be picked again
    e.target.value = ''
  }

  // ✅ Emoji insert — mantém cursor position
  function insertEmoji(emoji: string) {
    const ta = textareaRef.current
    if (!ta) {
      setInput(prev => prev + emoji)
      return
    }
    const start = ta.selectionStart ?? input.length
    const end = ta.selectionEnd ?? input.length
    const newValue = input.slice(0, start) + emoji + input.slice(end)
    setInput(newValue)
    // Restore cursor after emoji
    setTimeout(() => {
      ta.focus()
      const pos = start + emoji.length
      ta.setSelectionRange(pos, pos)
      autoResize(ta)
    }, 0)
  }

  let lastDate = ''
  const grouped = messages.map(m => {
    const label = formatMsgDate(m.created_at)
    const showDivider = label !== lastDate
    if (showDivider) lastDate = label
    return { showDivider, dateLabel: label, msg: m }
  })

  const name = displayName(chat)
  const phone = chat.phone ?? parsePhone(chat.remotejID)
  const commandQuery = input.startsWith('/') ? input.replace(/^\//, '') : ''

  return (
    <div
      style={{ display: 'contents' }}
      onDragOver={e => { e.preventDefault(); if (!isFinalized) setDragging(true) }}
      onDragLeave={e => {
        // só desativa se saiu do container inteiro (não de um filho)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (isFinalized) return
        const file = e.dataTransfer.files?.[0]
        if (!file) return
        if (!ALLOWED_TYPES.includes(file.type)) {
          alert('Tipo de arquivo não suportado.')
          return
        }
        if (file.size > 16 * 1024 * 1024) {
          alert('Arquivo muito grande. Máximo 16MB.')
          return
        }
        fileToBase64(file).then(base64 => {
          const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          setPendingFile({ base64, mimeType: file.type, fileName: file.name, preview })
        })
      }}
    >
      {/* Drag overlay */}
      {dragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(107,155,124,0.12)',
          border: '3px dashed var(--primary)',
          borderRadius: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--white)', borderRadius: 16,
            padding: '24px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>Solte para anexar</span>
          </div>
        </div>
      )}

      {/* Lightbox de imagem */}
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {/* Preview de documento */}
      {docPreview && (
        <DocPreview
          url={docPreview.url}
          fileName={docPreview.fileName}
          mimeType={docPreview.mimeType}
          onClose={() => setDocPreview(null)}
        />
      )}

      {/* Header */}
      <div className="chat-header">
        {onBack && (
          <button className="icon-btn back-btn" onClick={onBack} style={{ display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* ✅ Avatar com suporte a profile_image */}
        <div className="avatar"
          onClick={() => avatarUrl && !avatarError && setLightbox({ src: avatarUrl, alt: name })}
          style={{ cursor: avatarUrl && !avatarError ? 'pointer' : 'default' }}
        >
          <div
            className="avatar-img"
            style={{
              background: avatarUrl && !avatarError ? 'transparent' : 'linear-gradient(135deg, #6B9B7C, #3d6b4f)',
              fontSize: '15px',
              overflow: 'hidden',
            }}
          >
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                onError={() => setAvatarError(true)}
              />
            ) : (
              chat.name
                ? chat.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                : phone.slice(-4, -2)
            )}
          </div>
          <div className={`status-dot ${chat.is_online ? 'online' : 'offline'}`} />
        </div>

        <div className="chat-header-info">
          <h3>{name}</h3>
          <p>
            {phone.length > 6 ? `+${phone}` : phone}
            {' • '}
            {chat.is_online ? 'Online agora' : 'Offline'}
          </p>
        </div>

        <div className="chat-header-actions">
          <span style={{
            padding: '4px 10px', borderRadius: '20px',
            background: statusInfo.bg, color: statusInfo.color,
            fontSize: '11px', fontWeight: 700,
          }}>
            {statusInfo.label}
          </span>

          {canAssume && (
            <button onClick={onAssume} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              background: 'rgba(39,174,96,0.12)', color: '#27ae60',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              Assumir
            </button>
          )}

          {canFinalize && (
            <button onClick={onFinalize} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              background: 'rgba(231,76,60,0.12)', color: '#e74c3c',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Finalizar
            </button>
          )}

          <button className="icon-btn" title="Informações do contato">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </button>

          {onClose && (
            <button className="icon-btn" title="Fechar" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Banners */}
      {kanbanStatus === 'emergencia' && (
        <div style={{ background: 'rgba(231,76,60,0.08)', borderBottom: '1px solid rgba(231,76,60,0.2)', padding: '7px 20px', fontSize: '12px', color: '#e74c3c', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          🚨 Urgência — requer atendimento humano imediato
        </div>
      )}
      {kanbanStatus === 'em_atendimento' && (
        <div style={{ background: 'rgba(212,172,13,0.08)', borderBottom: '1px solid rgba(212,172,13,0.2)', padding: '7px 20px', fontSize: '12px', color: '#b7950b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          👤 Em atendimento por <strong style={{ marginLeft: 4 }}>{chat.operator_id}</strong>
        </div>
      )}
      {kanbanStatus === 'agendamento_ia' && (
        <div style={{ background: 'rgba(142,68,173,0.08)', borderBottom: '1px solid rgba(142,68,173,0.2)', padding: '7px 20px', fontSize: '12px', color: '#8E44AD', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          📅 Agendamento qualificado pela IA
        </div>
      )}
      {isFinalized && (
        <div style={{ background: 'rgba(39,174,96,0.08)', borderBottom: '1px solid rgba(39,174,96,0.2)', padding: '7px 20px', fontSize: '12px', color: '#1e8449', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {chat.finished_by === 'ia-auto'
            ? '🤖 Finalizado automaticamente pela IA'
            : <>✅ Finalizado por <strong style={{ marginLeft: 4 }}>{chat.finished_by}</strong></>
          }
        </div>
      )}

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 && !sending && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-gray)' }}>
              <p style={{ fontSize: '14px' }}>Nenhuma mensagem ainda</p>
            </div>
          </div>
        )}

        {/* Barra de seleção múltipla */}
        {selectMode && (
          <div className="select-bar">
            <span className="select-bar-count">
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button
              className="select-bar-btn select-bar-btn--copy"
              onClick={copySelectedMessages}
              disabled={selectedIds.size === 0}
            >
              Copiar
            </button>
            {onDeleteMessage && (
              <button
                className="select-bar-btn select-bar-btn--delete"
                onClick={deleteSelectedMessages}
                disabled={selectedIds.size === 0}
              >
                Apagar
              </button>
            )}
            <button
              className="select-bar-btn select-bar-btn--cancel"
              onClick={exitSelectMode}
            >
              Cancelar
            </button>
          </div>
        )}

        {grouped.map(({ showDivider, dateLabel, msg }) => (
          <div key={msg.id} style={{ display: 'contents' }}>
            {showDivider && <div className="msg-date-divider"><span>{dateLabel}</span></div>}
            <div
              ref={el => { msgRefs.current[msg.id] = el }}
              className={`message ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}`}
              onClick={() => selectMode && toggleSelect(msg.id)}
              style={{
                position: 'relative',
                cursor: selectMode ? 'pointer' : undefined,
                background: selectedIds.has(msg.id) ? 'rgba(107,155,124,0.15)' : undefined,
                borderRadius: selectedIds.has(msg.id) ? 8 : undefined,
                transition: 'background 0.15s',
              }}
            >
              {/* Checkbox de seleção */}
              {selectMode && (
                <div style={{
                  position: 'absolute', left: msg.direction === 'incoming' ? -28 : undefined,
                  right: msg.direction === 'outgoing' ? -28 : undefined,
                  top: '50%', transform: 'translateY(-50%)',
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${selectedIds.has(msg.id) ? '#4a7a5c' : '#c0ccd8'}`,
                  background: selectedIds.has(msg.id) ? '#4a7a5c' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedIds.has(msg.id) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )}

              <div className={`msg-bubble ${!selectMode && !(msg as any).deleted_at ? 'msg-bubble--hoverable' : ''}`}>
                {/* Setinha de ações — dentro da bolha, canto superior */}
                {!selectMode && !(msg as any).deleted_at && (
                  <div className={`msg-arrow-wrap ${msg.direction === 'outgoing' ? 'msg-arrow-wrap--out' : 'msg-arrow-wrap--in'}`}>
                    <button
                      onClick={e => { e.stopPropagation(); setMsgMenu(msgMenu === msg.id ? null : msg.id) }}
                      className={`msg-arrow-btn ${msgMenu === msg.id ? 'msg-arrow-btn--active' : ''} ${msg.direction === 'outgoing' ? 'msg-arrow-btn--out' : 'msg-arrow-btn--in'}`}
                      title="Opções"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 6" fill="none">
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {/* Menu de ações */}
                    {msgMenu === msg.id && (
                      <div
                        className={`msg-action-menu ${msg.direction === 'outgoing' ? 'msg-action-menu--out' : 'msg-action-menu--in'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {[
                          { icon: '↩', label: 'Responder', action: () => { setReplyTo(msg); setMsgMenu(null) } },
                          { icon: '⎘', label: 'Copiar', action: () => { navigator.clipboard.writeText(msg.body ?? ''); setMsgMenu(null) } },
                          { icon: '☑', label: 'Selecionar', action: () => { setSelectMode(true); toggleSelect(msg.id); setMsgMenu(null) } },
                          ...(onDeleteMessage ? [{ icon: '🗑', label: 'Apagar', action: () => { onDeleteMessage(msg.id); setMsgMenu(null) }, danger: true }] : []),
                        ].map(item => (
                          <button key={item.label}
                            onClick={item.action}
                            className={(item as any).danger ? 'danger' : ''}
                          >
                            <span className="msg-action-icon">{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Mensagem deletada */}
                {(msg as any).deleted_at ? (
                  <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: 13 }}>
                    🗑 Mensagem apagada
                  </span>
                ) : (
                  <>
                    {/* Quote de resposta */}
                    {(msg as any).reply_to_id && (() => {
                      const quotedMsg = messages.find(m => m.id === (msg as any).reply_to_id)
                      if (!quotedMsg) return null
                      const isOut = msg.direction === 'outgoing'
                      return (
                        <div
                          onClick={() => scrollToMessage(quotedMsg.id)}
                          style={{
                            background: isOut ? 'rgba(0,0,0,0.15)' : 'rgba(107,155,124,0.12)',
                            borderRadius: 6, padding: '5px 8px', marginBottom: 6,
                            borderLeft: `3px solid ${isOut ? 'rgba(255,255,255,0.4)' : 'var(--primary)'}`,
                            fontSize: 11, cursor: 'pointer', maxWidth: 220, overflow: 'hidden',
                          }}
                        >
                          <p style={{ fontWeight: 600, marginBottom: 2, color: isOut ? 'rgba(255,255,255,0.85)' : 'var(--primary)' }}>
                            {quotedMsg.direction === 'outgoing' ? 'Você' : 'Paciente'}
                          </p>
                          <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOut ? 'rgba(255,255,255,0.7)' : 'var(--text-gray)' }}>
                            {quotedMsg.media_type?.startsWith('audio/') ? '🎵 Áudio'
                              : quotedMsg.media_type?.startsWith('image/') ? '🖼 Imagem'
                                : quotedMsg.body ?? '📎 Mídia'}
                          </p>
                        </div>
                      )
                    })()}

                    {/* Imagem — clicável para lightbox */}
                    {msg.media_url && msg.media_type?.startsWith('image/') && (
                      <img
                        src={msg.media_url}
                        alt={msg.media_name ?? 'imagem'}
                        onClick={() => setLightbox({ src: msg.media_url!, alt: msg.media_name ?? 'imagem' })}
                        style={{
                          display: 'block', maxWidth: '220px', borderRadius: '8px',
                          marginBottom: '4px', cursor: 'zoom-in', transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      />
                    )}

                    {/* Áudio — player custom */}
                    {msg.media_url && msg.media_type?.startsWith('audio/') && (
                      <AudioPlayer src={msg.media_url} outgoing={msg.direction === 'outgoing'} />
                    )}

                    {/* PDF / DOCX — clicável para preview inline */}
                    {msg.media_url && !msg.media_type?.startsWith('image/') && !msg.media_type?.startsWith('audio/') && (
                      isPdf(msg.media_type, msg.media_name) || isDocx(msg.media_type, msg.media_name)
                        ? (
                          <button
                            onClick={() => setDocPreview({ url: msg.media_url!, fileName: msg.media_name ?? 'documento', mimeType: msg.media_type })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              width: '100%', padding: '8px 10px', marginBottom: '4px',
                              background: 'rgba(255,255,255,0.15)', borderRadius: '8px',
                              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              color: 'inherit', fontSize: '12px', textAlign: 'left',
                            }}
                          >
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>{getFileIcon(msg.media_type, msg.media_name)}</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {msg.media_name ?? msg.body}
                            </span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.6 }}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        ) : (
                          <a
                            href={msg.media_url} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '8px 10px', marginBottom: '4px',
                              background: 'rgba(255,255,255,0.15)', borderRadius: '8px',
                              color: 'inherit', textDecoration: 'none', fontSize: '12px',
                            }}
                          >
                            <span style={{ fontSize: '20px', flexShrink: 0 }}>{getFileIcon(msg.media_type, msg.media_name)}</span>
                            <span style={{ minWidth: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {msg.media_name ?? msg.body}
                            </span>
                          </a>
                        )
                    )}

                    {/* Texto / caption */}
                    {(!msg.media_url || (msg.body && msg.body !== msg.media_name)) && (
                      <span>{renderBody(msg.body)}</span>
                    )}
                  </>
                )}

                <div className="msg-time">
                  {formatMsgTime(msg.created_at)}
                  {msg.direction === 'outgoing' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={msg.read ? 'white' : 'rgba(255,255,255,0.6)'} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="typing-indicator">
            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area" style={{ opacity: isFinalized ? 0.5 : 1 }}>

        {/* Preview de resposta */}
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', margin: '0 0 4px',
            background: 'rgba(107,155,124,0.08)', borderRadius: 10,
            borderLeft: '3px solid var(--primary)', borderTop: '1px solid rgba(107,155,124,0.2)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>
                {replyTo.direction === 'outgoing' ? 'Você' : 'Paciente'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyTo.body ?? '📎 Mídia'}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: 18, padding: '2px 4px' }}>
              ×
            </button>
          </div>
        )}

        {/* Preview do arquivo pendente (inclui áudio gravado) */}
        {pendingFile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px', margin: '0 0 4px',
            background: 'rgba(107,155,124,0.08)', borderRadius: '10px',
            border: '1px solid rgba(107,155,124,0.2)',
          }}>
            {pendingFile.mimeType.startsWith('audio/') ? (
              <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8f0ea', borderRadius: '6px', fontSize: '18px' }}>
                🎤
              </div>
            ) : pendingFile.preview ? (
              <img src={pendingFile.preview} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '6px' }} />
            ) : (
              <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8f0ea', borderRadius: '6px', fontSize: '18px' }}>
                📎
              </div>
            )}
            <span style={{ flex: 1, fontSize: '12px', color: '#4a7a5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pendingFile.mimeType.startsWith('audio/') ? 'Áudio gravado — pronto para enviar' : pendingFile.fileName}
            </span>
            <button
              onClick={() => setPendingFile(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a9ab0', fontSize: '16px', padding: '2px 4px' }}
            >
              ×
            </button>
          </div>
        )}

        <div className="input-wrap" style={{ position: 'relative' }}>

          {/* Command Palette */}
          {paletteOpen && (
            <CommandPalette
              matches={paletteMatches}
              query={commandQuery}
              selectedIndex={paletteIndex}
              onSelect={selectCommand}
              onHover={setPaletteIndex}
            />
          )}

          {/* ✅ Emoji Picker */}
          {emojiOpen && (
            <div
              ref={emojiRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                background: '#fff',
                border: '1px solid #e0e6ec',
                borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              {/* Tabs de categoria */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e8ecef', overflowX: 'auto' }}>
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={i}
                    onClick={() => setEmojiCat(i)}
                    style={{
                      flex: '0 0 auto',
                      padding: '8px 12px',
                      background: emojiCat === i ? '#f0f7f4' : 'transparent',
                      border: 'none',
                      borderBottom: emojiCat === i ? '2px solid #4a7a5c' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: emojiCat === i ? '#4a7a5c' : '#8a9ab0',
                    }}
                  >
                    {cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              {/* Grid de emojis */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '2px',
                padding: '10px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                {EMOJI_CATEGORIES[emojiCat].emojis.map(emoji => (
                  <button
                    key={emoji}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertEmoji(emoji)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '20px', padding: '4px', borderRadius: '6px',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f7f4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ✅ Botão attach — abre file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={isFinalized}
          />

          {/* UI de gravação ativa */}
          {recording ? (
            <>
              {/* Cancelar */}
              <button
                onClick={cancelRecording}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', color: '#8a9ab0', display: 'flex', alignItems: 'center' }}
                title="Cancelar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Timer + waveform animado */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E74C3C', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#E74C3C', minWidth: 38 }}>{formatSecs(recordingSecs)}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 24, overflow: 'hidden' }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} style={{
                      display: 'inline-block', width: 3, borderRadius: 2,
                      background: '#4a7a5c', opacity: 0.7,
                      height: `${20 + Math.sin(Date.now() / 200 + i) * 12}%`,
                      animation: `waveBar ${0.4 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
                    }} />
                  ))}
                </div>
              </div>

              {/* Confirmar envio */}
              <button
                onClick={stopRecording}
                style={{ width: 38, height: 38, borderRadius: '50%', background: '#4a7a5c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Confirmar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                className="attach-btn"
                disabled={isFinalized}
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <textarea
                ref={textareaRef}
                className="msg-textarea"
                placeholder={isFinalized ? 'Atendimento finalizado' : 'Mensagem ou / para comandos...'}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                onKeyDown={handleKey}
                rows={1}
                disabled={sending || isFinalized}
              />

              <div className="input-actions">
                {/* ✅ Botão emoji — toggle picker */}
                <button
                  className="attach-btn"
                  disabled={isFinalized}
                  onClick={() => setEmojiOpen(o => !o)}
                  title="Emojis"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 13s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>

                {/* Microfone (quando input vazio e sem arquivo) ou Enviar */}
                {!input.trim() && !pendingFile ? (
                  <button
                    className="attach-btn"
                    disabled={isFinalized}
                    onClick={startRecording}
                    title="Gravar áudio"
                    style={{ color: '#4a7a5c' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="9" y1="22" x2="15" y2="22" />
                    </svg>
                  </button>
                ) : (
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={sending || (!input.trim() && !pendingFile) || isFinalized}
                    title="Enviar mensagem"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}