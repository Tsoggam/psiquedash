# WhatsApp Dashboard

Dashboard de atendimento WhatsApp integrado com n8n + Supabase.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (banco + Realtime para mensagens ao vivo)
- **n8n** (webhook para enviar mensagens pelo WhatsApp)
- **Vercel** (deploy)

---

## Setup rápido

### 1. Supabase

Execute o arquivo `supabase-schema.sql` no SQL Editor do seu projeto Supabase.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-send
```

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

### 4. Deploy no Vercel

```bash
# Instale a CLI do Vercel
npm i -g vercel

# Deploy
vercel --prod
```

Adicione as mesmas env vars no dashboard do Vercel (Settings > Environment Variables).

---

## Arquitetura n8n ↔ Dashboard

### Receber mensagem (WhatsApp → Dashboard)
O n8n recebe a mensagem do WhatsApp e deve:
1. `UPSERT` em `chats` pelo `phone`
2. `INSERT` em `messages` com `direction: 'incoming'`
3. `UPDATE chats SET unread_count = unread_count + 1`

O Supabase Realtime vai notificar o dashboard automaticamente.

### Enviar mensagem (Dashboard → WhatsApp)
O dashboard chama seu webhook n8n com:
```json
{
  "contactId": "uuid",
  "contactName": "João Silva",
  "contactPhone": "+55 11 99999-0001",
  "message": "Texto da mensagem",
  "timestamp": "2024-01-01T12:00:00Z",
  "direction": "outgoing"
}
```

O n8n pega esse payload e envia pelo WhatsApp (via Evolution API, Z-API, etc.).

---

## Estrutura de arquivos

```
src/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Dashboard principal
│   └── globals.css     # Design system completo
├── components/
│   └── chat/
│       ├── ChatList.tsx    # Sidebar com lista de contatos
│       └── ChatWindow.tsx  # Janela de mensagens
├── hooks/
│   └── useChats.ts     # Toda a lógica de estado + Supabase
├── lib/
│   └── supabase.ts     # Queries Supabase
└── types/
    └── index.ts        # TypeScript types
```
