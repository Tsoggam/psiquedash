// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { Chat, Message } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// createBrowserClient salva sessão em cookies — necessário para o middleware ler
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// ===== CHATS =====

export async function getChats(): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as Chat[]
}

export async function updateChatStatus(chatId: number, status: string) {
  const { error } = await supabase
    .from('chats')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', chatId)

  if (error) throw error
}

export async function markChatRead(chatId: number) {
  const { error: e1 } = await supabase
    .from('chats')
    .update({ unread_count: 0 })
    .eq('id', chatId)

  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('chat_id', chatId)
    .eq('direction', 'incoming')
    .eq('read', false)

  if (e2) throw e2
}

// ===== MESSAGES =====

export async function getMessages(chatId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return (data ?? []) as Message[]
}

export async function insertOutgoingMessage(payload: {
  chat_id: number
  remote_jid: string
  body: string
  sent_by?: string
  media_url?: string | null
  media_type?: string | null
  media_name?: string | null
  zapi_message_id?: string | null
  reply_to_id?: number | null
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...payload,
      direction: 'outgoing',
      read: true,
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('chats')
    .update({
      last_message: payload.body,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.chat_id)

  return data as Message
}

// Atualiza o zapi_message_id após envio confirmado
export async function updateMessageZapiId(messageId: number, zapiMessageId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ zapi_message_id: zapiMessageId })
    .eq('id', messageId)
  if (error) console.error('Erro ao salvar zapi_message_id:', error)
}

// Atualiza body de uma mensagem (após edição)
export async function updateMessageBody(messageId: number, body: string) {
  const { data, error } = await supabase
    .from('messages')
    .update({ body })
    .eq('id', messageId)
    .select()
    .single()
  if (error) throw error
  return data as Message
}
// ===== MULTI-TENANT =====

export async function getOperator(email: string) {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('email', email)
    .single()
  if (error) throw error
  return data
}

export async function getClinic(clinicId: string) {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single()
  if (error) throw error
  return data
}

// "5511999999999@s.whatsapp.net" → "5511999999999"
export function parsePhone(remotejID: string): string {
  return remotejID.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '')
}

// Helper: nome de exibição — usa name se existir, senão formata o número
export function displayName(chat: Chat): string {
  if (chat.name) return chat.name
  const phone = chat.phone ?? parsePhone(chat.remotejID)
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 12) {
    const ddi = digits.slice(0, 2)
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const mid = rest.length === 9
      ? `${rest.slice(0, 5)}-${rest.slice(5)}`
      : `${rest.slice(0, 4)}-${rest.slice(4)}`
    return `+${ddi} ${ddd} ${mid}`
  }
  return `+${digits}`
}