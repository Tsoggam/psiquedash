// src/app/dashboard/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import KanbanBoard from '@/components/chat/KanbanBoard'
import ChatWindow from '@/components/chat/ChatWindow'
import { useKanban } from '@/hooks/useKanban'
import { Chat } from '@/types'

type LayoutMode = 'split' | 'chat-only' | 'board-only'

export default function DashboardPage() {
  const {
    columns, messages, activeChat, loading, sending,
    search, operatorEmail,
    openChat, closeChat, assumeChat, finalizeChat, sendMessage,
    setSearch, moveChat, deleteMessage,
  } = useKanban()

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('board-only')
  const pendingChatId = useRef<string | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem('open_chat_id')
    sessionStorage.removeItem('open_chat_id')
    if (id) pendingChatId.current = id
  }, [])

  useEffect(() => {
    if (loading || !pendingChatId.current) return
    const id = pendingChatId.current
    pendingChatId.current = null
    const allChats = [
      ...columns.novo, ...columns.emergencia,
      ...columns.em_atendimento, ...columns.agendamento_ia, ...columns.finalizado,
    ]
    const chat = allChats.find(c => String(c.id) === id)
    if (chat) { openChat(chat); setLayoutMode('split') }
  }, [loading, columns])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--text-gray)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '14px' }}>Carregando atendimentos...</p>
      </div>
    )
  }

  const handleSelectChat = (chat: Chat) => {
    openChat(chat)
    setLayoutMode('split')
  }

  const handleAssume = async (chat: Chat) => {
    const updated = await assumeChat(chat)
    if (!updated) return
    await openChat(updated)
    setLayoutMode('split')
  }

  const handleClose = () => {
    closeChat()
    setLayoutMode('board-only')
  }

  function handleBack() {
    setLayoutMode(prev => prev === 'split' ? 'chat-only' : 'split')
  }

  const showBoard = layoutMode === 'split' || layoutMode === 'board-only'
  const showChat = layoutMode === 'split' || layoutMode === 'chat-only'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {showBoard && (
        <div style={{ width: activeChat ? '55%' : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.2s' }}>
          <KanbanBoard
            columns={columns}
            activeId={activeChat?.id ?? null}
            operatorEmail={operatorEmail}
            search={search}
            onSelect={handleSelectChat}
            onAssume={handleAssume}
            onFinalize={finalizeChat}
            onSearch={setSearch}
            onMove={moveChat}
          />
        </div>
      )}

      {showChat && activeChat && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <ChatWindow
            chat={activeChat}
            messages={messages}
            sending={sending}
            onSend={sendMessage}
            onDeleteMessage={(id) => deleteMessage(id)}
            onStatusChange={() => { }}
            onHandoffToggle={() => { }}
            onBack={handleBack}
            onClose={handleClose}
            onAssume={() => handleAssume(activeChat)}
            onFinalize={() => finalizeChat(activeChat)}
            operatorEmail={operatorEmail}
          />
        </main>
      )}
    </div>
  )
}