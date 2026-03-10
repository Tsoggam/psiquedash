// src/hooks/useKanban.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase,
  getMessages,
  markChatRead,
  insertOutgoingMessage,
  updateMessageZapiId,
  updateMessageBody,
  displayName,
  parsePhone,
  getOperator,
  getClinic,
} from '@/lib/supabase'
import { Chat, Message, Clinic, Operator } from '@/types'
import { useNotification } from './useNotification'

export type KanbanStatus = 'novo' | 'emergencia' | 'em_atendimento' | 'agendamento_ia' | 'finalizado'

function dedupeMessages(msgs: Message[]): Message[] {
  const seen = new Set<number>()
  return msgs.filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

export function useKanban() {
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [operatorEmail, setOperatorEmail] = useState<string | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [search, setSearch] = useState('')

  const { notify } = useNotification()
  const msgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const seenRealtimeIds = useRef<Set<number>>(new Set())
  const seenKanbanChatIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email ?? null
      setOperatorEmail(email)
      if (email) {
        try {
          const op = await getOperator(email)
          setOperator(op)
          const cl = await getClinic(op.clinic_id)
          setClinic(cl)
        } catch (e) {
          console.error('Erro ao carregar operador/clínica:', e)
        }
      }
    })
  }, [])

  useEffect(() => { if (operator) loadChats() }, [operator])

  // Realtime do board
  useEffect(() => {
    const channel = supabase
      .channel('kanban-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
        // Notificação para chats novos em emergencia ou agendamento_ia
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const chat = payload.new as Chat
          if (!seenKanbanChatIds.current.has(chat.id)) {
            seenKanbanChatIds.current.add(chat.id)
            if (chat.kanban_status === 'emergencia') {
              notify({
                title: '🚨 Novo atendimento urgente',
                body: `${chat.name ?? chat.phone ?? 'Cliente'} entrou na fila de emergência`,
                type: 'kanban_urgencia',
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const prev = payload.old as Partial<Chat>
            if (
              prev.kanban_status !== chat.kanban_status &&
              chat.kanban_status === 'emergencia'
            ) {
              notify({
                title: '🚨 Chat movido para urgência',
                body: `${chat.name ?? chat.phone ?? 'Cliente'} precisa de atenção imediata`,
                type: 'kanban_urgencia',
              })
            }
            if (
              prev.kanban_status !== chat.kanban_status &&
              chat.kanban_status === 'agendamento_ia'
            ) {
              notify({
                title: '📅 Novo agendamento',
                body: `${chat.name ?? chat.phone ?? 'Cliente'} aguarda confirmação de agendamento`,
                type: 'kanban_agendamento',
              })
            }
          }
        }
        loadChats().then(() => {
          // Se o chat ativo recebeu update, garante unread_count = 0
          setActiveChat(current => {
            if (!current) return current
            setChats(prev => prev.map(c =>
              c.id === current.id ? { ...c, unread_count: 0 } : c
            ))
            return current
          })
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Realtime de mensagens do chat ativo
  useEffect(() => {
    if (!activeChat) return
    seenRealtimeIds.current.clear()
    if (msgChannelRef.current) {
      supabase.removeChannel(msgChannelRef.current)
      msgChannelRef.current = null
    }

    const channel = supabase
      .channel(`messages-${activeChat.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          const newMsg = payload.new as Message
          if (seenRealtimeIds.current.has(newMsg.id)) return
          seenRealtimeIds.current.add(newMsg.id)

          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            if (newMsg.direction === 'outgoing') {
              const tempIdx = prev.findIndex(m => m.id < 0 && m.body === newMsg.body)
              if (tempIdx !== -1) {
                const next = [...prev]
                next[tempIdx] = newMsg
                return next
              }
            }
            return [...prev, newMsg]
          })

          // Se incoming com chat aberto: zerar badge imediatamente
          if (newMsg.direction === 'incoming') {
            markChatRead(activeChat.id).catch(() => { })
            setChats(prev => prev.map(c =>
              c.id === activeChat.id ? { ...c, unread_count: 0 } : c
            ))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          const updated = payload.new as Message
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        }
      )
      .subscribe()

    msgChannelRef.current = channel
    return () => { supabase.removeChannel(channel); msgChannelRef.current = null }
  }, [activeChat?.id])

  async function loadChats() {
    try {
      let query = supabase
        .from('chats')
        .select('*')
        .order('last_message_at', { ascending: false })

      // Filtra por clínica do operador
      if (operator?.clinic_id) {
        query = query.eq('clinic_id', operator.clinic_id)
      }

      const { data, error } = await query
      if (error) throw error

      const chatsData = data ?? []

      const phones = chatsData.map(c => c.phone).filter(Boolean)
      let photoMap: Record<string, string> = {}

      if (phones.length > 0) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('phone, profile_image')
          .in('phone', phones)

        photoMap = Object.fromEntries(
          (contactsData ?? [])
            .filter(c => c.profile_image)
            .map(c => [c.phone, c.profile_image])
        )
      }

      const mapped = chatsData.map(c => ({
        ...c,
        profile_image: photoMap[c.phone] ?? null,
      }))

      // Popula o set de ids já conhecidos para não notificar na carga inicial
      mapped.forEach(c => seenKanbanChatIds.current.add(c.id))

      setChats(mapped)
    } catch (e) {
      console.error('Erro ao carregar chats:', e)
    } finally {
      setLoading(false)
    }
  }

  const openChat = useCallback(async (chat: Chat) => {
    setActiveChat(chat)
    setMessages([])
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true })
      setMessages(dedupeMessages(data ?? []))
      await markChatRead(chat.id)
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c))
    } catch (e) {
      console.error('Erro ao abrir chat:', e)
    }
  }, [])

  // ---------- ASSUMIR ATENDIMENTO ----------
  const assumeChat = useCallback(async (chat: Chat): Promise<Chat | null> => {
    if (!operatorEmail) return null

    const baseQuery = supabase
      .from('chats')
      .update({
        kanban_status: 'em_atendimento',
        operator_id: operatorEmail,
        assumed_at: new Date().toISOString(),
        handoff: true,
      })
      .eq('id', chat.id)

    const guardedQuery = chat.kanban_status === 'emergencia'
      ? baseQuery.or(`operator_id.is.null,operator_id.eq.${operatorEmail}`)
      : baseQuery.is('operator_id', null)

    const { data, error } = await guardedQuery.select().single()

    if (error || !data) {
      alert('Este atendimento já foi assumido por outro operador.')
      loadChats()
      return null
    }

    const updated = { ...data, profile_image: chat.profile_image ?? null }
    setChats(prev => prev.map(c => c.id === chat.id ? updated : c))
    return updated
  }, [operatorEmail])

  // ---------- FINALIZAR ATENDIMENTO ----------
  const finalizeChat = useCallback(async (chat: Chat) => {
    if (!operatorEmail) return

    const { data, error } = await supabase
      .from('chats')
      .update({
        kanban_status: 'finalizado',
        status: 'fechado',
        handoff: false,
        finished_by: operatorEmail,
        finished_at: new Date().toISOString(),
      })
      .eq('id', chat.id)
      .eq('operator_id', operatorEmail)
      .select()
      .single()

    if (error || !data) {
      console.error('Erro ao finalizar:', error)
      return
    }

    const updated = { ...data, profile_image: chat.profile_image ?? null }
    setChats(prev => prev.map(c => c.id === chat.id ? updated : c))
    setActiveChat(null)
  }, [operatorEmail])

  // ---------- ENVIAR MENSAGEM ----------
  const sendMessage = useCallback(async (
    text: string,
    file?: { base64: string; mimeType: string; fileName: string; preview?: string },
    replyToMessageId?: string | null
  ) => {
    if (!activeChat || sending) return
    if (!file && !text.trim()) return
    setSending(true)

    const msgBody = file ? (text.trim() || file.fileName) : text.trim()

    // ── Upload para Supabase Storage ──────────────────────────────────────────
    let mediaUrl: string | null = null
    let mediaType: string | null = null
    let mediaName: string | null = null

    if (file) {
      try {
        const ext = file.fileName.split('.').pop() ?? 'bin'
        const path = `${activeChat.id}/${Date.now()}.${ext}`

        // base64 → Blob
        const byteChars = atob(file.base64)
        const byteArr = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        const blob = new Blob([byteArr], { type: file.mimeType })

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(path, blob, { contentType: file.mimeType, upsert: false })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        mediaUrl = publicUrl
        mediaType = file.mimeType
        mediaName = file.fileName
      } catch (e) {
        console.error('Erro no upload do arquivo:', e)
        setSending(false)
        return
      }
    }

    // ── Mensagem temporária (optimistic UI) ───────────────────────────────────
    const tempId = -Date.now()
    // Busca a mensagem original pelo zapi_message_id para obter o id interno
    const replyToInternalId = replyToMessageId
      ? (messages.find(m => (m as any).zapi_message_id === replyToMessageId)?.id ?? null)
      : null

    const tempMsg: Message = {
      id: tempId,
      chat_id: activeChat.id,
      remote_jid: activeChat.remotejID,
      direction: 'outgoing',
      body: msgBody,
      read: false,
      sent_by: operatorEmail,
      created_at: new Date().toISOString(),
      // Para imagens: preview local enquanto aguarda confirmação do realtime
      media_url: file?.preview ?? mediaUrl,
      media_type: mediaType,
      media_name: mediaName,
      reply_to_id: replyToInternalId,
    } as any
    setMessages(prev => [...prev, tempMsg])

    try {
      const saved = await insertOutgoingMessage({
        chat_id: activeChat.id,
        remote_jid: activeChat.remotejID,
        body: msgBody,
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        reply_to_id: replyToInternalId,
      })
      seenRealtimeIds.current.add(saved.id)
      setMessages(prev => dedupeMessages(prev.map(m => m.id === tempId ? saved : m)))

      // ── Envio via Z-API com credenciais da clínica ───────────────────────────
      const zapiRes = await fetch('/api/zapi/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: activeChat.phone ?? parsePhone(activeChat.remotejID),
          mensagem: text.trim() || undefined,
          file: file
            ? { url: mediaUrl, mimeType: file.mimeType, fileName: file.fileName }
            : undefined,
          // Credenciais da clínica — sobrepõem as do .env
          zapiInstanceId: clinic?.zapi_instance_id,
          zapiToken: clinic?.zapi_token,
          zapiClientToken: clinic?.zapi_client_token,
          ...(replyToMessageId ? { replyToMessageId } : {}),
        }),
      })

      // Salva o zapiMessageId retornado pela Z-API para permitir delete/edit
      try {
        const zapiJson = await zapiRes.json()
        const msgId = zapiJson?.zapiResponse?.messageId ?? zapiJson?.messageId ?? null
        if (msgId) {
          await updateMessageZapiId(saved.id, msgId)
          setMessages(prev => prev.map(m =>
            m.id === saved.id ? { ...m, zapi_message_id: msgId } : m
          ))
        }
      } catch { /* não crítico */ }

      if (!activeChat.handoff) {
        const webhookUrl = clinic?.n8n_webhook_url ?? process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChat.id,
            remotejID: activeChat.remotejID,
            phone: activeChat.phone ?? parsePhone(activeChat.remotejID),
            name: displayName(activeChat),
            message: msgBody,
            timestamp: new Date().toISOString(),
          }),
        })
      }

      setChats(prev => prev.map(c =>
        c.id === activeChat.id
          ? { ...c, last_message: msgBody, last_message_at: new Date().toISOString() }
          : c
      ))
    } catch (e) {
      console.error('Erro ao enviar:', e)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }, [activeChat, sending, operatorEmail])

  // ---------- APAGAR MENSAGEM (soft delete) ----------
  const deleteMessage = useCallback(async (messageId: number) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
    ))
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
    if (error) {
      console.error('Erro ao apagar mensagem:', error)
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted_at: null } : m
      ))
    }
  }, [])

  // ---------- APAGAR PRA TODOS (60s) ----------
  const deleteForAll = useCallback(async (msg: Message) => {
    if (!activeChat || !msg.zapi_message_id) return

    // Optimistic
    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, deleted_at: new Date().toISOString() } : m
    ))

    try {
      const res = await fetch('/api/zapi/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeChat.phone ?? parsePhone(activeChat.remotejID),
          zapiMessageId: msg.zapi_message_id,
        }),
      })
      if (!res.ok) throw new Error()

      await supabase.from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msg.id)
    } catch {
      // Rollback
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, deleted_at: null } : m
      ))
    }
  }, [activeChat])

  // ---------- EDITAR MENSAGEM (15min) ----------
  const editMessage = useCallback(async (msg: Message, newBody: string) => {
    if (!activeChat || !msg.zapi_message_id || !newBody.trim()) return

    const prevBody = msg.body

    // Optimistic
    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, body: newBody } : m
    ))

    try {
      const res = await fetch('/api/zapi/edit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeChat.phone ?? parsePhone(activeChat.remotejID),
          zapiMessageId: msg.zapi_message_id,
          message: newBody,
        }),
      })
      if (!res.ok) throw new Error()

      await updateMessageBody(msg.id, newBody)
    } catch {
      // Rollback
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, body: prevBody } : m
      ))
    }
  }, [activeChat])
  const columns: Record<KanbanStatus, Chat[]> = {
    novo: [],
    emergencia: [],
    em_atendimento: [],
    agendamento_ia: [],
    finalizado: [],
  }

  const searchLower = search.toLowerCase()

  chats.forEach(c => {
    const matchSearch = !search ||
      displayName(c).toLowerCase().includes(searchLower) ||
      (c.phone ?? '').includes(search) ||
      (c.last_message ?? '').toLowerCase().includes(searchLower)

    if (!matchSearch) return

    const col = c.kanban_status as KanbanStatus

    if (col === 'em_atendimento' && c.operator_id !== operatorEmail) return

    columns[col]?.push(c)
  })

  // ---------- MOVER CARD ----------
  const moveChat = useCallback(async (chat: Chat, toStatus: KanbanStatus) => {
    const updates: Record<string, unknown> = { kanban_status: toStatus }

    if (toStatus === 'finalizado') {
      updates.status = 'fechado'
      updates.handoff = false
      updates.finished_by = operatorEmail
      updates.finished_at = new Date().toISOString()
    }
    if (toStatus === 'em_atendimento') {
      updates.handoff = true
      updates.operator_id = operatorEmail
      updates.assumed_at = new Date().toISOString()
    }
    if (toStatus === 'novo') {
      updates.handoff = false
      updates.operator_id = null
      updates.assumed_at = null
      updates.finished_by = null
      updates.finished_at = null
    }

    const { data, error } = await supabase
      .from('chats')
      .update(updates)
      .eq('id', chat.id)
      .select()
      .single()

    if (error || !data) { console.error('Erro ao mover card:', error); return }

    const updated = { ...data, profile_image: chat.profile_image ?? null }
    setChats(prev => prev.map(c => c.id === chat.id ? updated : c))
    if (activeChat?.id === chat.id) setActiveChat(updated)
  }, [operatorEmail, activeChat])

  const closeChat = useCallback(() => {
    setActiveChat(null)
    setMessages([])
  }, [])

  return {
    columns,
    messages,
    activeChat,
    loading,
    sending,
    search,
    operatorEmail,
    operator,
    clinic,
    openChat,
    closeChat,
    assumeChat,
    finalizeChat,
    sendMessage,
    deleteMessage,
    deleteForAll,
    editMessage,
    setSearch,
    moveChat,
    displayName,
  }
}