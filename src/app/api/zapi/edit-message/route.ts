// src/app/api/zapi/edit-message/route.ts
import { NextRequest, NextResponse } from 'next/server'

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID!
const TOKEN = process.env.ZAPI_TOKEN!
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN!

export async function POST(request: NextRequest) {
    const { phone, zapiMessageId, message } = await request.json()

    if (!phone || !zapiMessageId || !message) {
        return NextResponse.json({ error: 'phone, zapiMessageId e message obrigatórios' }, { status: 400 })
    }

    const res = await fetch(
        `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/edit-message`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN },
            body: JSON.stringify({ phone, messageId: zapiMessageId, message }),
        }
    )

    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: text }, { status: 500 })
    return NextResponse.json({ ok: true })
}