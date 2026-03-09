// src/types/index.ts

export type MessageDirection = 'incoming' | 'outgoing'

export type KanbanStatus =
  | 'novo'
  | 'emergencia'
  | 'em_atendimento'
  | 'agendamento_ia'
  | 'finalizado'

// Espelho exato da tabela chats no Supabase
export interface Chat {
  id: number                    // int8 — PK
  remotejID: string             // "5511999999999@s.whatsapp.net"
  status: string                // 'aberto' | 'pendente' | 'fechado' | 'I.A'
  created_at: string
  updated_at: string

  // Colunas adicionadas via migration.sql
  name: string | null
  phone: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  is_online: boolean
  avatar_url: string | null
  handoff: boolean

  // Kanban — migration_kanban.sql
  kanban_status: KanbanStatus
  operator_id: string | null      // e-mail do operador que assumiu
  assumed_at: string | null
  finished_by: string | null      // e-mail de quem finalizou
  finished_at: string | null

  // Campo injetado em runtime via tabela contacts (não existe na tabela chats)
  profile_image?: string | null

  // Agendamento qualificado pela IA — migration_agendamento_ia.sql
  agendamento_dados: {
    nome?: string
    telefone?: string
    horario_desejado?: string
    resumo?: string
  } | null

  // Multi-tenant
  clinic_id: string | null
}

export interface Clinic {
  id: string                  // slug: 'psique', 'clinica-b', etc.
  name: string
  zapi_instance_id: string
  zapi_token: string
  zapi_client_token: string
  n8n_webhook_url: string
  active: boolean
}

export interface Operator {
  email: string
  name: string
  clinic_id: string
  role: 'operator' | 'admin'
  active: boolean
  created_at: string
}

// Espelho da tabela messages
export interface Message {
  id: number
  chat_id: number
  remote_jid: string
  direction: MessageDirection
  body: string                  // coluna é "body", não "text"
  read: boolean
  sent_by: string | null
  created_at: string
  // Mídia anexada (imagem, PDF, doc, etc.)
  media_url?: string | null
  media_type?: string | null
  media_name?: string | null
  deleted_at?: string | null
  zapi_message_id?: string | null
}

// Payload enviado ao webhook n8n para ENVIAR mensagem
export interface N8nSendPayload {
  chatId: number
  remotejID: string
  phone: string
  name: string
  message: string
  timestamp: string
}

export interface InternalMessage {
  id: number
  sender_email: string
  sender_name: string | null
  body: string
  media_url: string | null
  media_type: string | null
  media_name: string | null
  deleted_at: string | null
  edited_at: string | null
  created_at: string
  room_id: string           // 'general' | pvRoomId(a, b)
  mentions: string[]        // emails mencionados com @
}