-- ============================================
-- WHATSAPP DASHBOARD — Supabase Schema
-- Execute no Supabase SQL Editor
-- ============================================

-- Tabela principal de chats/contatos
CREATE TABLE IF NOT EXISTS chats (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  avatar        TEXT,
  status        TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pendente', 'fechado')),
  unread_count  INTEGER NOT NULL DEFAULT 0,
  last_message  TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_online     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  text        TEXT NOT NULL,
  read        BOOLEAN DEFAULT false,
  sent_by     TEXT, -- ID do operador (se outgoing)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC);

-- Realtime: habilitar nas duas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) — ajuste conforme sua autenticação
-- Por ora: acesso público (ajuste para produção!)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Webhook do n8n para receber mensagens:
-- Quando chegar msg do WhatsApp, o n8n deve:
-- 1. Fazer UPSERT em chats (pelo phone)
-- 2. INSERT em messages (direction: 'incoming')
-- 3. UPDATE chats SET unread_count = unread_count + 1, last_message = ...
-- ============================================

-- Exemplo de dados para teste:
INSERT INTO chats (name, phone, status, last_message, unread_count, is_online) VALUES
('João da Silva', '+55 11 99999-0001', 'aberto', 'Oi, preciso de ajuda', 3, true),
('Maria Oliveira', '+55 21 98888-0002', 'pendente', 'Quando chega meu produto?', 1, false),
('Carlos Santos', '+55 31 97777-0003', 'fechado', 'Obrigado pelo atendimento!', 0, false)
ON CONFLICT (phone) DO NOTHING;
