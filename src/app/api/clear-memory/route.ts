// src/app/api/clear-memory/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.N8N_DATABASE_URL,
    ssl: process.env.N8N_DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
    const { telefone } = await req.json()
    if (!telefone) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })

    const sessionId = `${telefone}-calendar`

    try {
        await pool.query(
            'DELETE FROM n8n_chat_histories WHERE session_id = $1',
            [sessionId]
        )
        return NextResponse.json({ ok: true, sessionId })
    } catch (e: any) {
        console.error('Erro ao limpar memória IA:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}