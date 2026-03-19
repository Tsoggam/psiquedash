import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    const body = await request.json()

    // Checa se slot ainda está disponível
    const { data: conflito } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('profissional_id', body.profissional_id)
        .eq('data_hora', body.data_hora)
        .in('status', ['pendente', 'confirmado'])
        .maybeSingle()

    if (conflito) {
        return NextResponse.json({ error: 'Horário já ocupado' }, { status: 409 })
    }

    const { data, error } = await supabase
        .from('agendamentos')
        .insert({
            profissional_id: body.profissional_id,
            paciente_nome: body.paciente_nome,
            paciente_telefone: body.paciente_telefone ?? null,
            data_hora: body.data_hora,
            duracao: body.duracao ?? 50,
            modalidade: body.modalidade ?? 'online',
            status: 'pendente',
            origem: 'whatsapp',
            observacoes: body.observacoes ?? null,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ agendamento: data })
}