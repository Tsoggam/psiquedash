// src/hooks/useNotification.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'

export type NotifType = 'mention' | 'dm' | 'kanban_urgencia' | 'kanban_agendamento'

interface NotifOptions {
    title: string
    body: string
    type: NotifType
    onClick?: () => void
}

// Tom de notificação gerado via AudioContext — zero dependência externa
function playNotificationSound(type: NotifType) {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        // Frequências e padrões diferentes por tipo
        if (type === 'kanban_urgencia') {
            // Alerta urgente: dois bips curtos e agudos
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30)
            gain.gain.setValueAtTime(0.4, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.45)
        } else if (type === 'mention') {
            // Menção: bip médio suave
            osc.frequency.setValueAtTime(660, ctx.currentTime)
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.3)
        } else {
            // DM / agendamento: bip simples suave
            osc.frequency.setValueAtTime(520, ctx.currentTime)
            gain.gain.setValueAtTime(0.2, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.25)
        }

        // Fecha o contexto após o som
        osc.onended = () => ctx.close()
    } catch {
        // AudioContext não disponível — silêncio
    }
}

export function useNotification() {
    const permissionRef = useRef<NotificationPermission>('default')

    // Pede permissão uma vez na montagem
    useEffect(() => {
        if (!('Notification' in window)) return
        permissionRef.current = Notification.permission
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(p => {
                permissionRef.current = p
            })
        }
    }, [])

    const notify = useCallback(({ title, body, type, onClick }: NotifOptions) => {
        // Sempre toca o som, independente de permissão
        playNotificationSound(type)

        // Notificação nativa só se tab não estiver em foco
        if (document.visibilityState === 'visible') return
        if (!('Notification' in window)) return
        if (permissionRef.current !== 'granted') return

        const icons: Record<NotifType, string> = {
            mention: '💬',
            dm: '✉️',
            kanban_urgencia: '🚨',
            kanban_agendamento: '📅',
        }

        const notif = new Notification(`${icons[type]} ${title}`, {
            body,
            icon: '/favicon.ico',
            tag: type, // agrupa por tipo para não spammar
            renotify: true,
        })

        if (onClick) {
            notif.onclick = () => {
                window.focus()
                onClick()
                notif.close()
            }
        }

        // Auto-fecha após 6s
        setTimeout(() => notif.close(), 6000)
    }, [])

    return { notify }
}