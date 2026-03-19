// src/hooks/useInternalChat.ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { InternalMessage } from '@/types'
import { useNotification } from './useNotification'

const MESSAGES_LIMIT = 80

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Gera room_id determinístico para PV entre dois emails */
export function pvRoomId(a: string, b: string): string {
    return [a, b].sort().join('__')
}

/** Extrai o nome de exibição de um email */
export function displayNameFromEmail(email: string): string {
    return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnlineOperator {
    email: string
    name: string
    onlineSince: string
}

export interface Notification {
    id: string
    type: 'mention' | 'dm'
    fromEmail: string
    fromName: string
    roomId: string
    preview: string
    at: string
}

export interface Room {
    id: string          // 'general' | pvRoomId(a, b)
    type: 'general' | 'dm'
    label: string       // 'Geral' | nome do outro operador
    otherEmail?: string // só para DMs
    unread: number
    lastMessage?: string
    lastAt?: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInternalChat(operatorEmail: string | null) {
    // ── State ──────────────────────────────────────────────────────────────────
    const { notify } = useNotification()
    const [isOpen, setIsOpen] = useState(false)
    const [activeRoom, setActiveRoom] = useState<string>('general')

    const [messagesByRoom, setMessagesByRoom] = useState<Record<string, InternalMessage[]>>({})
    const [loadingRoom, setLoadingRoom] = useState<Record<string, boolean>>({})

    const [rooms, setRooms] = useState<Room[]>([
        { id: 'general', type: 'general', label: 'Geral', unread: 0 },
    ])

    const [onlineOperators, setOnlineOperators] = useState<OnlineOperator[]>([])
    const [notifications, setNotifications] = useState<Notification[]>([])

    const [sending, setSending] = useState(false)

    const seenIds = useRef<Set<number>>(new Set())
    const isOpenRef = useRef(false)
    const activeRoomRef = useRef('general')

    useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
    useEffect(() => { activeRoomRef.current = activeRoom }, [activeRoom])

    // ── Presença (Supabase Realtime Presence) ──────────────────────────────────
    useEffect(() => {
        if (!operatorEmail) return

        const presenceChannel = supabase.channel('operator-presence', {
            config: { presence: { key: operatorEmail } },
        })

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState<{ email: string; name: string; onlineSince: string }>()
                const online: OnlineOperator[] = Object.values(state).flat().map(p => ({
                    email: p.email,
                    name: p.name,
                    onlineSince: p.onlineSince,
                }))
                setOnlineOperators(online.filter(o => o.email !== operatorEmail))
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        email: operatorEmail,
                        name: displayNameFromEmail(operatorEmail),
                        onlineSince: new Date().toISOString(),
                    })
                }
            })

        return () => { supabase.removeChannel(presenceChannel) }
    }, [operatorEmail])

    // ── Carregar mensagens de uma sala ─────────────────────────────────────────
    const loadRoom = useCallback(async (roomId: string) => {
        if (messagesByRoom[roomId] !== undefined) return // já carregado
        setLoadingRoom(prev => ({ ...prev, [roomId]: true }))

        const { data, error } = await supabase
            .from('internal_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(MESSAGES_LIMIT)

        if (!error && data) {
            const ordered = [...data].reverse()
            ordered.forEach(m => seenIds.current.add(m.id))
            setMessagesByRoom(prev => ({ ...prev, [roomId]: ordered }))
        }
        setLoadingRoom(prev => ({ ...prev, [roomId]: false }))
    }, [messagesByRoom])

    // Carrega geral na montagem
    useEffect(() => {
        loadRoom('general')
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Realtime: INSERT + UPDATE ──────────────────────────────────────────────
    useEffect(() => {
        if (!operatorEmail) return

        const channel = supabase
            .channel('internal-chat-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'internal_messages' },
                (payload) => {
                    const msg = payload.new as InternalMessage
                    if (seenIds.current.has(msg.id)) return
                    seenIds.current.add(msg.id)

                    const roomId = (msg as any).room_id ?? 'general'
                    const mentions: string[] = (msg as any).mentions ?? []
                    const isMine = msg.sender_email === operatorEmail
                    const isCurrentRoom = isOpenRef.current && activeRoomRef.current === roomId

                    // Adiciona à sala se já estiver carregada
                    setMessagesByRoom(prev => {
                        if (prev[roomId] === undefined) return prev
                        return { ...prev, [roomId]: [...prev[roomId], msg] }
                    })

                    // Atualiza rooms: unread + lastMessage
                    setRooms(prev => prev.map(r => {
                        if (r.id !== roomId) return r
                        const unreadIncrement = (!isMine && !isCurrentRoom) ? 1 : 0
                        return {
                            ...r,
                            unread: r.unread + unreadIncrement,
                            lastMessage: msg.body,
                            lastAt: msg.created_at,
                        }
                    }))

                    // Notificação: menção no geral
                    if (!isMine && mentions.includes(operatorEmail)) {
                        notify({
                            title: `${displayNameFromEmail(msg.sender_email)} te mencionou`,
                            body: msg.body.slice(0, 80),
                            type: 'mention',
                        })
                        const notif: Notification = {
                            id: `mention-${msg.id}`,
                            type: 'mention',
                            fromEmail: msg.sender_email,
                            fromName: displayNameFromEmail(msg.sender_email),
                            roomId,
                            preview: msg.body.slice(0, 80),
                            at: msg.created_at,
                        }
                        pushNotification(notif)
                    }

                    // Notificação: DM recebida
                    if (!isMine && roomId !== 'general') {
                        const isDmForMe = roomId === pvRoomId(operatorEmail, msg.sender_email)
                        if (isDmForMe && !isCurrentRoom) {
                            notify({
                                title: `Mensagem de ${displayNameFromEmail(msg.sender_email)}`,
                                body: msg.body.slice(0, 60),
                                type: 'dm',
                            })
                            const notif: Notification = {
                                id: `dm-${msg.id}`,
                                type: 'dm',
                                fromEmail: msg.sender_email,
                                fromName: displayNameFromEmail(msg.sender_email),
                                roomId,
                                preview: msg.body.slice(0, 60),
                                at: msg.created_at,
                            }
                            pushNotification(notif)

                            // Abre a sala de DM se não estiver na lista de rooms
                            setRooms(prev => {
                                const exists = prev.find(r => r.id === roomId)
                                if (exists) return prev
                                return [...prev, {
                                    id: roomId,
                                    type: 'dm',
                                    label: displayNameFromEmail(msg.sender_email),
                                    otherEmail: msg.sender_email,
                                    unread: 1,
                                    lastMessage: msg.body,
                                    lastAt: msg.created_at,
                                }]
                            })
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'internal_messages' },
                (payload) => {
                    const updated = payload.new as InternalMessage
                    const roomId = (updated as any).room_id ?? 'general'
                    setMessagesByRoom(prev => {
                        if (!prev[roomId]) return prev
                        return { ...prev, [roomId]: prev[roomId].map(m => m.id === updated.id ? updated : m) }
                    })
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [operatorEmail])

    // ── Notificações temporárias (auto-dismiss 5s) ─────────────────────────────
    function pushNotification(notif: Notification) {
        setNotifications(prev => [...prev, notif])
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id))
        }, 5000)
    }

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }, [])

    // ── Abrir/fechar/trocar sala ───────────────────────────────────────────────
    const openChat = useCallback(() => {
        setIsOpen(true)
        setRooms(prev => prev.map(r => r.id === activeRoomRef.current ? { ...r, unread: 0 } : r))
    }, [])

    const closeChat = useCallback(() => setIsOpen(false), [])

    const switchRoom = useCallback(async (roomId: string) => {
        setActiveRoom(roomId)
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unread: 0 } : r))
        await loadRoom(roomId)
    }, [loadRoom])

    /** Abre ou cria uma sala de DM com outro operador */
    const openDM = useCallback(async (otherEmail: string) => {
        if (!operatorEmail) return
        const roomId = pvRoomId(operatorEmail, otherEmail)
        setRooms(prev => {
            const exists = prev.find(r => r.id === roomId)
            if (exists) return prev
            return [...prev, {
                id: roomId,
                type: 'dm',
                label: displayNameFromEmail(otherEmail),
                otherEmail,
                unread: 0,
            }]
        })
        await switchRoom(roomId)
        setIsOpen(true)
    }, [operatorEmail, switchRoom])

    // ── Enviar mensagem ────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (
        text: string,
        file?: { base64: string; mimeType: string; fileName: string },
        mentions?: string[],
        roomId?: string,
    ) => {
        if (!operatorEmail || sending) return
        if (!file && !text.trim()) return
        setSending(true)

        const targetRoom = roomId ?? activeRoomRef.current

        let mediaUrl: string | null = null
        let mediaType: string | null = null
        let mediaName: string | null = null

        if (file) {
            try {
                const ext = file.fileName.split('.').pop() ?? 'bin'
                const path = `internal/${Date.now()}.${ext}`
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
                console.error('Erro no upload:', e)
                setSending(false)
                return
            }
        }

        const body = text.trim() || (file?.fileName ?? '')
        const tempId = -Date.now()
        const tempMsg: InternalMessage = {
            id: tempId,
            sender_email: operatorEmail,
            sender_name: null,
            body,
            media_url: mediaUrl,
            media_type: mediaType,
            media_name: mediaName,
            deleted_at: null,
            edited_at: null,
            created_at: new Date().toISOString(),
            room_id: targetRoom,
            mentions: mentions ?? [],
        }

        setMessagesByRoom(prev => ({
            ...prev,
            [targetRoom]: [...(prev[targetRoom] ?? []), tempMsg],
        }))

        try {
            const { data, error } = await supabase
                .from('internal_messages')
                .insert({
                    sender_email: operatorEmail,
                    body,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    media_name: mediaName,
                    room_id: targetRoom,
                    mentions: mentions ?? [],
                })
                .select()
                .single()

            if (error) throw error
            seenIds.current.add(data.id)
            setMessagesByRoom(prev => ({
                ...prev,
                [targetRoom]: (prev[targetRoom] ?? []).map(m => m.id === tempId ? data : m),
            }))
        } catch (e) {
            console.error('Erro ao salvar mensagem:', e)
            setMessagesByRoom(prev => ({
                ...prev,
                [targetRoom]: (prev[targetRoom] ?? []).filter(m => m.id !== tempId),
            }))
        } finally {
            setSending(false)
        }
    }, [operatorEmail, sending])

    const deleteMessage = useCallback(async (id: number, roomId: string) => {
        const now = new Date().toISOString()
        const { error } = await supabase
            .from('internal_messages')
            .update({ deleted_at: now })
            .eq('id', id)
        if (!error) {
            setMessagesByRoom(prev => ({
                ...prev,
                [roomId]: (prev[roomId] ?? []).map(m => m.id === id ? { ...m, deleted_at: now } : m),
            }))
        }
    }, [])

    const editMessage = useCallback(async (id: number, newBody: string, roomId: string) => {
        if (!newBody.trim()) return
        const now = new Date().toISOString()
        const { error } = await supabase
            .from('internal_messages')
            .update({ body: newBody.trim(), edited_at: now })
            .eq('id', id)
        if (!error) {
            setMessagesByRoom(prev => ({
                ...prev,
                [roomId]: (prev[roomId] ?? []).map(m =>
                    m.id === id ? { ...m, body: newBody.trim(), edited_at: now } : m
                ),
            }))
        }
    }, [])

    // ── Derived ────────────────────────────────────────────────────────────────
    const totalUnread = rooms.reduce((acc, r) => acc + r.unread, 0)
    const activeMessages = messagesByRoom[activeRoom] ?? []
    const isLoadingActive = loadingRoom[activeRoom] ?? false

    return {
        // Chat state
        isOpen, openChat, closeChat,
        activeRoom, switchRoom, openDM, rooms,
        messages: activeMessages,
        loading: isLoadingActive,
        sending,
        totalUnread,
        // Presença
        onlineOperators,
        // Notificações
        notifications,
        dismissNotification,
        // Actions
        sendMessage,
        deleteMessage,
        editMessage,
    }
}