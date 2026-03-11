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

function playNotificationSound(type: NotifType, existingCtx?: AudioContext | null) {
    try {
        const ctx = existingCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        if (type === 'kanban_urgencia') {
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30)
            gain.gain.setValueAtTime(0.4, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.45)
        } else if (type === 'mention') {
            osc.frequency.setValueAtTime(660, ctx.currentTime)
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.3)
        } else {
            osc.frequency.setValueAtTime(520, ctx.currentTime)
            gain.gain.setValueAtTime(0.2, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.25)
        }

        if (!existingCtx) {
            osc.onended = () => ctx.close()
        }
    } catch {
        // AudioContext não disponível
    }
}

export function useNotification() {
    const permissionRef = useRef<NotificationPermission>('default')
    const audioCtxRef = useRef<AudioContext | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return

        permissionRef.current = 'Notification' in window ? Notification.permission : 'denied'

        function handleFirstInteraction() {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume()
            }

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(p => {
                    permissionRef.current = p
                })
            }

            document.removeEventListener('click', handleFirstInteraction)
            document.removeEventListener('keydown', handleFirstInteraction)
        }

        document.addEventListener('click', handleFirstInteraction)
        document.addEventListener('keydown', handleFirstInteraction)

        return () => {
            document.removeEventListener('click', handleFirstInteraction)
            document.removeEventListener('keydown', handleFirstInteraction)
        }
    }, [])

    const notify = useCallback(({ title, body, type, onClick }: NotifOptions) => {
        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume().then(() => {
                playNotificationSound(type, audioCtxRef.current!)
            })
        } else {
            playNotificationSound(type, audioCtxRef.current)
        }

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
            tag: type,
            renotify: true,
        })

        if (onClick) {
            notif.onclick = () => {
                window.focus()
                onClick()
                notif.close()
            }
        }

        setTimeout(() => notif.close(), 6000)
    }, [])

    return { notify }
}