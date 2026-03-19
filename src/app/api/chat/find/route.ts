import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const telefone = searchParams.get('telefone')
    if (!telefone) return NextResponse.json(null)

    const { data, error } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('phone', telefone)
        .limit(1)
        .maybeSingle()

    if (error) console.error('[api/chat/find]', error)
    return NextResponse.json(data?.id ?? null)
}