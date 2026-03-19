// src/app/dashboard/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import KanbanBoard from '@/components/chat/KanbanBoard'
import ChatWindow from '@/components/chat/ChatWindow'
import { useKanban } from '@/hooks/useKanban'
import { Chat } from '@/types'

const CHAT_WIDTH = 520

export default function DashboardPage() {
  const {
    columns, messages, activeChat, loading, sending,
    search, operatorEmail,
    openChat, closeChat, assumeChat, finalizeChat, sendMessage,
    setSearch, moveChat, deleteMessage,
  } = useKanban()

  const [chatFullscreen, setChatFullscreen] = useState(false)
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
    if (chat) openChat(chat)
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
    setChatFullscreen(false)
  }

  const handleAssume = async (chat: Chat) => {
    const updated = await assumeChat(chat)
    if (!updated) return
    await openChat(updated)
    setChatFullscreen(false)
  }

  const handleClose = () => {
    closeChat()
    setChatFullscreen(false)
  }

  function handleBack() {
    setChatFullscreen(true)
  }

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>

      {/* Kanban — sempre 100%, nunca encolhe */}
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
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

      {/* Chat — sobrepõe à direita. Fullscreen quando chatFullscreen=true */}
      {activeChat && (
        <main style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: chatFullscreen ? '100%' : CHAT_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: chatFullscreen ? 'none' : '1px solid var(--border)',
          background: 'var(--bg-light)',
          boxShadow: chatFullscreen ? 'none' : '-4px 0 24px rgba(0,0,0,0.18)',
          zIndex: 50,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}>
          <ChatWindow
            chat={activeChat}
            messages={messages}
            sending={sending}
            onSend={sendMessage}
            onDeleteMessage={(id) => deleteMessage(id)}
            onStatusChange={() => { }}
            onHandoffToggle={() => { }}
            onBack={chatFullscreen ? () => setChatFullscreen(false) : handleBack}
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