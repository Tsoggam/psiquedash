import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const body = await req.json()

    // Z-API envia isso no payload de mensagem recebida
    const phone = body.phone?.replace(/\D/g, '')
    const text = body.text?.message
    const isFromMe = body.fromMe

    // Ignora mensagens enviadas por você e não-texto
    if (isFromMe || !text || !phone) {
        return NextResponse.json({ ok: true })
    }

    // Formata para o padrão do seu banco (12 dígitos, sem 9 extra)
    let normalized = phone.startsWith('55') ? phone : `55${phone}`
    if (normalized.length === 13) normalized = normalized.slice(0, 4) + normalized.slice(5)

    // Busca o chat_id pelo telefone
    const { data: chat } = await supabase
        .from('chats')
        .select('id')
        .eq('phone', normalized)
        .maybeSingle()

    if (!chat) return NextResponse.json({ ok: true }) // paciente sem chat ainda

    // Salva a mensagem incoming
    await supabase.from('messages').insert({
        chat_id: chat.id,
        remote_jid: `${normalized}@s.whatsapp.net`,
        body: text,
        direction: 'incoming',
        read: false,
        sent_by: null,
    })

    // Atualiza last_message no chat
    await supabase.from('chats').update({
        last_message: text,
        last_message_at: new Date().toISOString(),
    }).eq('id', chat.id)

    return NextResponse.json({ ok: true })
}