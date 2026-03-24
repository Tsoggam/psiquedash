// src/app/api/admin/operators/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAILS = ['admin@psique.com', 'rosanne@psique.com', 'anapaula@psique.com', 'cleiton@psique.com']

// service_role NUNCA vai pro browser — só existe aqui no servidor
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

async function isAdmin(req: NextRequest): Promise<boolean> {
    const token = req.headers.get('Authorization')?.slice(7)
    if (!token) return false
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    return !error && !!user?.email && ADMIN_EMAILS.includes(user.email)
}

// GET — lista operadores
export async function GET(req: NextRequest) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const users = data.users
        .filter(u => !ADMIN_EMAILS.includes(u.email ?? ''))
        .map(u => ({
            id: u.id,
            email: u.email ?? '',
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
        }))

    return NextResponse.json({ users })
}

// POST — cria operador
export async function POST(req: NextRequest) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'email e password obrigatórios' }, { status: 400 })

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } })
}

// PATCH — reseta senha
export async function PATCH(req: NextRequest) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, password } = await req.json()
    if (!userId || !password) return NextResponse.json({ error: 'userId e password obrigatórios' }, { status: 400 })

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
}

// DELETE — remove operador
export async function DELETE(req: NextRequest) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
}