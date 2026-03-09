import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DIAS_MAP: Record<string, number> = {
    domingo: 0, segunda: 1, terca: 2, quarta: 3,
    quinta: 4, sexta: 5, sabado: 6,
}

export async function POST(request: NextRequest) {
    const body = await request.json()

    // Aceita variações de nome que a IA pode mandar
    const data: string = body.data || body.date || body.Data || body.data_consulta || body.fecha
    const especialidade: string | null = body.especialidade || body.specialty || body.Especialidade || null

    if (!data) {
        return NextResponse.json(
            { error: 'Parâmetro "data" obrigatório (formato: YYYY-MM-DD)' },
            { status: 400 }
        )
    }

    // Valida formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return NextResponse.json(
            { error: `Formato de data inválido: "${data}". Use YYYY-MM-DD (ex: 2026-02-25)` },
            { status: 400 }
        )
    }

    const dataObj = new Date(`${data}T00:00:00`)
    const diaSemana = Object.entries(DIAS_MAP).find(([, v]) => v === dataObj.getDay())?.[0]

    if (!diaSemana) {
        return NextResponse.json({ error: 'Dia da semana inválido' }, { status: 400 })
    }

    // Busca profissionais que atendem nesse dia
    let query = supabase
        .from('profissionais')
        .select('*')
        .eq('ativo', true)
        .contains('dias_atendimento', [diaSemana])

    if (especialidade) {
        query = query.ilike('especialidade', `%${especialidade}%`)
    }

    const { data: profissionais, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!profissionais || profissionais.length === 0) {
        return NextResponse.json({ horarios: [], mensagem: `Nenhum profissional disponível em ${data} (${diaSemana})` })
    }

    // Busca agendamentos já existentes nesse dia
    const { data: ocupados } = await supabase
        .from('agendamentos')
        .select('profissional_id, data_hora, duracao')
        .gte('data_hora', `${data}T00:00:00`)
        .lte('data_hora', `${data}T23:59:59`)
        .in('status', ['pendente', 'confirmado'])

    const horarios: object[] = []

    for (const prof of profissionais) {
        const [hIni, mIni] = prof.horario_inicio.split(':').map(Number)
        const [hFim, mFim] = prof.horario_fim.split(':').map(Number)

        let cursor = hIni * 60 + mIni
        const fim = hFim * 60 + mFim

        while (cursor + prof.duracao_sessao <= fim) {
            const hora = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`
            const dataHora = `${data}T${hora}:00-03:00`

            const ocupado = (ocupados ?? []).some(
                (o) =>
                    o.profissional_id === prof.id &&
                    o.data_hora.slice(0, 16) === dataHora.slice(0, 16)
            )

            if (!ocupado) {
                horarios.push({
                    profissional_id: prof.id,
                    profissional_nome: prof.nome,
                    especialidade: prof.especialidade,
                    data_hora: dataHora,
                    duracao: prof.duracao_sessao,
                })
            }

            cursor += prof.duracao_sessao + (prof.intervalo_sessoes ?? 0)
        }
    }

    return NextResponse.json({ horarios })
}