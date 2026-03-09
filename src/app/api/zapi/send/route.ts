// src/app/api/zapi/send/route.ts
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID!
const DEFAULT_TOKEN = process.env.ZAPI_TOKEN!
const DEFAULT_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN!

function zapiUrl(instanceId: string, token: string, path: string) {
    return `https://api.z-api.io/instances/${instanceId}/token/${token}/${path}`
}

function getZapiEndpoint(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'send-image'
    if (mimeType.startsWith('audio/')) return 'send-audio'
    if (mimeType.startsWith('video/')) return 'send-video'
    return 'send-document' // base — extensão adicionada em getDocumentEndpoint
}

// Z-API exige extensão no path: /send-document/pdf, /send-document/docx, etc.
function getDocumentEndpoint(mimeType: string, fileName: string): string {
    const extFromName = fileName.split('.').pop()?.toLowerCase() ?? ''
    const extMap: Record<string, string> = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'application/zip': 'zip',
    }
    const ext = extMap[mimeType] ?? extFromName ?? 'pdf'
    return `send-document/${ext}`
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    const { telefone, mensagem, file, zapiInstanceId, zapiToken, zapiClientToken, replyToMessageId } = body

    // Usa credenciais da clínica se fornecidas, senão fallback para .env
    const instanceId = zapiInstanceId ?? DEFAULT_INSTANCE_ID
    const token = zapiToken ?? DEFAULT_TOKEN
    const clientToken = zapiClientToken ?? DEFAULT_CLIENT_TOKEN

    if (!telefone) {
        return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })
    }

    const headers = {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
    }

    // ── Envio de arquivo via URL pública (Supabase Storage) ───────────────────
    if (file) {
        const { url, mimeType, fileName } = file
        const endpoint = getZapiEndpoint(mimeType)

        let zapiBody: Record<string, unknown>
        let finalEndpoint = endpoint

        if (endpoint === 'send-image') {
            zapiBody = { phone: telefone, image: url, caption: mensagem || '' }
        } else if (endpoint === 'send-audio') {
            zapiBody = { phone: telefone, audio: url, waveform: true }
        } else if (endpoint === 'send-video') {
            zapiBody = { phone: telefone, video: url, caption: mensagem || '' }
        } else {
            // Documentos: Z-API exige extensão no path — /send-document/pdf, /send-document/docx, etc.
            finalEndpoint = getDocumentEndpoint(mimeType, fileName)
            zapiBody = { phone: telefone, document: url, fileName, caption: mensagem || '' }
        }

        console.log('[ZAPI] Enviando arquivo via URL:', finalEndpoint, fileName, mimeType)

        const res = await fetch(zapiUrl(instanceId, token, finalEndpoint), {
            method: 'POST',
            headers,
            body: JSON.stringify(zapiBody),
        })

        const responseText = await res.text()
        console.log('[ZAPI] Status:', res.status, responseText)

        if (!res.ok) {
            return NextResponse.json({ error: responseText }, { status: 500 })
        }

        try {
            const zapiJson = JSON.parse(responseText)
            return NextResponse.json({ ok: true, zapiResponse: zapiJson })
        } catch {
            return NextResponse.json({ ok: true })
        }
    }

    // ── Envio de texto puro ───────────────────────────────────────────────────
    if (!mensagem) {
        return NextResponse.json({ error: 'mensagem obrigatória' }, { status: 400 })
    }

    console.log('[ZAPI] Enviando texto para:', telefone)

    const res = await fetch(zapiUrl(instanceId, token, 'send-text'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: telefone, message: mensagem, ...(replyToMessageId ? { messageId: replyToMessageId } : {}) }),
    })

    const responseText = await res.text()
    console.log('[ZAPI] Status:', res.status, responseText)

    if (!res.ok) {
        return NextResponse.json({ error: responseText }, { status: 500 })
    }

    // no send/route.ts, após parse do responseText
    console.log('[ZAPI] Response completo:', responseText)

    try {
        const zapiJson = JSON.parse(responseText)
        return NextResponse.json({ ok: true, zapiResponse: zapiJson })
    } catch {
        return NextResponse.json({ ok: true })
    }
}