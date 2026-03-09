// src/components/internal-chat/InternalChatWrapper.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import InternalChat from './InternalChat'

export default function InternalChatWrapper() {
    const pathname = usePathname()
    const [email, setEmail] = useState<string | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setEmail(data.user?.email ?? null)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setEmail(session?.user?.email ?? null)
        })
        return () => subscription.unsubscribe()
    }, [])

    // Não renderiza na login page
    if (pathname === '/' || pathname.startsWith('/login')) return null
    if (!email) return null

    return <InternalChat operatorEmail={email} />
}