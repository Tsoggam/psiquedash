// src/app/api/messages/save/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const { chat_id, remote_jid, body, direction = 'outgoing', sent_by = 'operador' } = await req.json()

    if (!chat_id || !body) {
        return NextResponse.json({ error: 'chat_id e body obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({ chat_id, remote_jid, body, direction, read: true, sent_by })
        .select()
        .single()

    if (error) {
        console.error('[api/messages/save]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Atualiza last_message no chat
    await supabaseAdmin
        .from('chats')
        .update({ last_message: body, last_message_at: new Date().toISOString() })
        .eq('id', chat_id)

    return NextResponse.json({ message: data })
}