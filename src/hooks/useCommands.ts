// src/hooks/useCommands.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { COMMANDS, Command } from '@/lib/commands'

export type { Command }

interface UseCommandsReturn {
    commands: Command[]
    loading: boolean
    addCommand: (command: string, body: string, createdBy: string | null) => Promise<void>
    removeCommand: (command: string) => Promise<void>
    updateCommand: (command: string, newBody: string) => Promise<void>
    refresh: () => Promise<void>
}

export function useCommands(): UseCommandsReturn {
    const [commands, setCommands] = useState<Command[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('command, body')
                .order('command', { ascending: true })

            if (error) throw error

            // Tabela vazia na primeira execução → seed automático do arquivo estático
            if (!data || data.length === 0) {
                const rows = COMMANDS.map(c => ({ command: c.command, body: c.body }))

                // Insere em lotes de 50 para não estourar limite do Supabase
                for (let i = 0; i < rows.length; i += 50) {
                    await supabase
                        .from('commands')
                        .upsert(rows.slice(i, i + 50), { onConflict: 'command' })
                }

                setCommands([...COMMANDS].sort((a, b) => a.command.localeCompare(b.command)))
            } else {
                setCommands(data as Command[])
            }
        } catch (e) {
            console.error('useCommands: erro ao carregar, usando fallback estático', e)
            setCommands([...COMMANDS].sort((a, b) => a.command.localeCompare(b.command)))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const addCommand = useCallback(async (
        command: string,
        body: string,
        createdBy: string | null
    ) => {
        // Normaliza: força barra no início, sem espaços, lowercase
        const normalized = '/' + command.replace(/^\/+/, '').trim().toLowerCase()

        const { error } = await supabase
            .from('commands')
            .insert({ command: normalized, body: body.trim(), created_by: createdBy })

        if (error) {
            if (error.code === '23505') throw new Error('Comando já existe: ' + normalized)
            throw error
        }

        await load()
    }, [load])

    const removeCommand = useCallback(async (command: string) => {
        const { error } = await supabase
            .from('commands')
            .delete()
            .eq('command', command)

        if (error) throw error
        setCommands(prev => prev.filter(c => c.command !== command))
    }, [])

    const updateCommand = useCallback(async (command: string, newBody: string) => {
        const { error } = await supabase
            .from('commands')
            .update({ body: newBody.trim() })
            .eq('command', command)

        if (error) throw error
        setCommands(prev => prev.map(c => c.command === command ? { ...c, body: newBody.trim() } : c))
    }, [])

    return { commands, loading, addCommand, removeCommand, updateCommand, refresh: load }
}