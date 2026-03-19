// src/components/chat/KanbanBoard.tsx
'use client'

import { useState } from 'react'
import { Chat } from '@/types'
import { KanbanStatus } from '@/hooks/useKanban'
import { displayName, parsePhone } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  columns: Record<KanbanStatus, Chat[]>
  activeId: number | null
  operatorEmail: string | null
  search: string
  onSelect: (chat: Chat) => void
  onAssume: (chat: Chat) => void
  onFinalize: (chat: Chat) => void
  onSearch: (s: string) => void
  onMove: (chat: Chat, toStatus: KanbanStatus) => void
}

const COLUMNS: { key: KanbanStatus; label: string; color: string; accent: string }[] = [
  { key: 'novo', label: '🔵 Novos', color: '#EBF5FB', accent: '#2E86C1' },
  { key: 'agendamento_ia', label: '📅 Agendamento (IA)', color: '#F5EEF8', accent: '#8E44AD' },
  { key: 'emergencia', label: '🔴 Urgência', color: '#FDEDEC', accent: '#E74C3C' },
  { key: 'em_atendimento', label: '🟡 Em Atendimento', color: '#FEF9E7', accent: '#D4AC0D' },
  { key: 'finalizado', label: '✅ Finalizados', color: '#EAFAF1', accent: '#27AE60' },
]

function formatTime(dateStr: string | null) {
  if (!dateStr) return ''
  try { return formatDistanceToNow(new Date(dateStr), { locale: ptBR, addSuffix: true }) }
  catch { return '' }
}

function getInitials(chat: Chat) {
  if (chat.name) return chat.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const phone = chat.phone ?? parsePhone(chat.remotejID)
  return phone.slice(-4, -2)
}

// ✅ Avatar com suporte a profile_image
function ChatAvatar({ chat, size = 34 }: { chat: Chat; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const profileImage = (chat as any).profile_image

  if (profileImage && !imgError) {
    return (
      <img
        src={profileImage}
        alt={displayName(chat)}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '8px',
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '8px', flexShrink: 0,
      background: 'linear-gradient(135deg, #6B9B7C, #3d6b4f)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: 700, color: '#fff',
    }}>
      {getInitials(chat)}
    </div>
  )
}

function ChatCard({
  chat, colKey, active, operatorEmail,
  onSelect, onAssume, onFinalize,
  onDragStart, onDragEnd, isDragging,
}: {
  chat: Chat
  colKey: KanbanStatus
  active: boolean
  operatorEmail: string | null
  onSelect: (c: Chat) => void
  onAssume: (c: Chat) => void
  onFinalize: (c: Chat) => void
  onDragStart: (c: Chat) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const name = displayName(chat)
  const phone = chat.phone ?? parsePhone(chat.remotejID)

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(chat) }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(chat)}
      style={{
        background: active ? '#f0f7f4' : '#fff',
        border: `1.5px solid ${active ? '#4a7a5c' : '#e8ecef'}`,
        borderRadius: '10px',
        padding: '10px',
        cursor: 'grab',
        transition: 'all 0.15s',
        boxShadow: active ? '0 2px 8px rgba(74,122,92,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(0.98)' : 'scale(1)',
      }}
    >
      {/* ✅ Avatar + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <ChatAvatar chat={chat} size={34} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a2332', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </p>
          <p style={{ fontSize: '11px', color: '#8a9ab0' }}>+{phone}</p>
        </div>
        {chat.unread_count > 0 && (
          <span style={{
            marginLeft: 'auto', flexShrink: 0,
            background: '#E74C3C', color: '#fff',
            fontSize: '10px', fontWeight: 700,
            borderRadius: '10px', padding: '1px 6px',
          }}>
            {chat.unread_count}
          </span>
        )}
      </div>

      {/* Última mensagem */}
      {chat.last_message && (
        <p style={{
          fontSize: '12px', color: '#5a6a7a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: '8px',
        }}>
          {chat.last_message}
        </p>
      )}

      {/* Operador */}
      {(colKey === 'em_atendimento' || colKey === 'finalizado') && (chat.operator_id || chat.finished_by) && (
        <p style={{ fontSize: '11px', color: '#8a9ab0', marginBottom: '8px' }}>
          {colKey === 'finalizado'
            ? `✓ Finalizado por ${chat.finished_by}`
            : `👤 ${chat.operator_id}`}
        </p>
      )}

      {/* Dados agendamento IA */}
      {colKey === 'agendamento_ia' && chat.agendamento_dados && (
        <div style={{
          background: '#F5EEF8', borderRadius: '7px', padding: '8px 10px',
          marginBottom: '8px', fontSize: '11px', color: '#6C3483',
          display: 'flex', flexDirection: 'column', gap: '3px',
        }}>
          {chat.agendamento_dados.nome && <span>👤 {chat.agendamento_dados.nome}</span>}
          {chat.agendamento_dados.telefone && <span>📱 {chat.agendamento_dados.telefone}</span>}
          {chat.agendamento_dados.horario_desejado && <span>🕐 {chat.agendamento_dados.horario_desejado}</span>}
          {chat.agendamento_dados.resumo && (
            <span style={{ color: '#8E44AD', fontStyle: 'italic' }}>{chat.agendamento_dados.resumo}</span>
          )}
        </div>
      )}

      {/* Tempo */}
      <p style={{ fontSize: '11px', color: '#b0bcc8', marginBottom: '10px' }}>
        {formatTime(chat.last_message_at)}
      </p>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
        {(colKey === 'novo' || colKey === 'emergencia') && (
          <button
            onClick={() => onAssume(chat)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: '7px', border: 'none',
              background: '#27AE60', color: '#fff', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Assumir
          </button>
        )}

        {colKey === 'em_atendimento' && chat.operator_id === operatorEmail && (
          <button
            onClick={() => onFinalize(chat)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: '7px', border: 'none',
              background: '#E74C3C', color: '#fff', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Finalizar
          </button>
        )}

        <button
          onClick={() => onSelect(chat)}
          style={{
            padding: '6px 10px', borderRadius: '7px',
            border: '1px solid #e0e6ec', background: '#fff',
            color: '#5a6a7a', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Abrir
        </button>
      </div>
    </div>
  )
}

export default function KanbanBoard({
  columns, activeId, operatorEmail, search,
  onSelect, onAssume, onFinalize, onSearch, onMove,
}: Props) {
  const [draggingChat, setDraggingChat] = useState<Chat | null>(null)
  const [overCol, setOverCol] = useState<KanbanStatus | null>(null)

  function handleDrop(toStatus: KanbanStatus) {
    if (!draggingChat) return
    if (draggingChat.kanban_status !== toStatus) {
      onMove(draggingChat, toStatus)
    }
    setDraggingChat(null)
    setOverCol(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6f9' }}>

      {/* Toolbar */}
      <div style={{
        padding: '12px 16px', background: '#fff',
        borderBottom: '1px solid #e8ecef',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8a9ab0' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar nome, número ou mensagem..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              border: '1px solid #e0e6ec', borderRadius: '8px',
              fontSize: '13px', outline: 'none', background: '#f8fafc',
            }}
          />
        </div>

        {COLUMNS.map(col => (
          <div key={col.key} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 10px', borderRadius: '8px',
            background: col.color, fontSize: '12px', fontWeight: 600, color: col.accent,
          }}>
            {col.label.split(' ').slice(1).join(' ')}
            <span style={{
              background: col.accent, color: '#fff',
              borderRadius: '10px', padding: '0 6px', fontSize: '11px',
            }}>
              {columns[col.key].length}
            </span>
          </div>
        ))}
      </div>

      {/* Board */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))`,
        gap: '8px', padding: '10px', minWidth: 0,
      }}>
        {COLUMNS.map(col => {
          const isOver = overCol === col.key && draggingChat?.kanban_status !== col.key
          return (
            <div
              key={col.key}
              style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
              onDragOver={e => { e.preventDefault(); setOverCol(col.key) }}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Cabeçalho */}
              <div style={{
                padding: '10px 14px', borderRadius: '10px 10px 0 0',
                background: col.color, borderBottom: `2px solid ${col.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: col.accent }}>
                  {col.label}
                </span>
                <span style={{
                  background: col.accent, color: '#fff',
                  borderRadius: '12px', padding: '1px 8px', fontSize: '11px', fontWeight: 700,
                }}>
                  {columns[col.key].length}
                </span>
              </div>

              {/* Drop zone */}
              <div style={{
                flex: 1, overflowY: 'auto',
                background: isOver ? col.color : '#eaecf0',
                borderRadius: '0 0 10px 10px',
                border: isOver ? `2px dashed ${col.accent}` : '2px solid transparent',
                padding: '10px',
                display: 'flex', flexDirection: 'column', gap: '8px',
                minHeight: '160px',
                transition: 'background 0.15s, border 0.15s',
              }}>
                {isOver && (
                  <div style={{
                    textAlign: 'center', color: col.accent,
                    fontSize: '12px', fontWeight: 600,
                    padding: '12px 0', borderRadius: '8px',
                    background: `${col.accent}18`,
                  }}>
                    ↓ Soltar aqui
                  </div>
                )}

                {columns[col.key].length === 0 && !isOver && (
                  <div style={{ textAlign: 'center', color: '#b0bcc8', fontSize: '12px', padding: '30px 0' }}>
                    Nenhum contato
                  </div>
                )}

                {columns[col.key].map(chat => (
                  <ChatCard
                    key={chat.id}
                    chat={chat}
                    colKey={col.key}
                    active={activeId === chat.id}
                    operatorEmail={operatorEmail}
                    onSelect={onSelect}
                    onAssume={onAssume}
                    onFinalize={onFinalize}
                    onDragStart={setDraggingChat}
                    onDragEnd={() => { setDraggingChat(null); setOverCol(null) }}
                    isDragging={draggingChat?.id === chat.id}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}