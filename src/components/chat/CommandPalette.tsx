// src/components/chat/CommandPalette.tsx
import { useEffect, useRef } from 'react'
import { Command } from '@/lib/commands'

interface Props {
    matches: Command[]
    query: string
    selectedIndex: number
    onSelect: (cmd: Command) => void
    onHover: (index: number) => void
}

export default function CommandPalette({ matches, query, selectedIndex, onSelect, onHover }: Props) {
    const listRef = useRef<HTMLDivElement>(null)
    const selectedRef = useRef<HTMLButtonElement>(null)

    // Scroll selected item into view
    useEffect(() => {
        selectedRef.current?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    if (matches.length === 0) return null

    function highlightMatch(text: string, query: string) {
        if (!query) return <span>{text}</span>
        const lower = text.toLowerCase()
        const qLower = query.toLowerCase()
        const idx = lower.indexOf(qLower)
        if (idx === -1) return <span>{text}</span>
        return (
            <>
                <span>{text.slice(0, idx)}</span>
                <span className="cp-highlight">{text.slice(idx, idx + query.length)}</span>
                <span>{text.slice(idx + query.length)}</span>
            </>
        )
    }

    // Strip leading slash from query for highlight matching inside command name
    const queryClean = query.replace(/^\//, '')

    return (
        <div className="cp-wrap" ref={listRef}>
            <div className="cp-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span>{matches.length} comando{matches.length !== 1 ? 's' : ''}</span>
                <span className="cp-hint">↑↓ navegar · Enter selecionar · Esc fechar</span>
            </div>

            <div className="cp-list">
                {matches.map((cmd, i) => (
                    <button
                        key={cmd.command}
                        ref={i === selectedIndex ? selectedRef : null}
                        className={`cp-item ${i === selectedIndex ? 'cp-item-active' : ''}`}
                        onMouseEnter={() => onHover(i)}
                        onMouseDown={(e) => {
                            e.preventDefault() // prevent textarea blur
                            onSelect(cmd)
                        }}
                    >
                        <span className="cp-cmd">
                            {highlightMatch(cmd.command, '/' + queryClean)}
                        </span>
                        <span className="cp-preview">
                            {cmd.body.replace(/\n+/g, ' ').slice(0, 72)}
                            {cmd.body.length > 72 ? '…' : ''}
                        </span>
                    </button>
                ))}
            </div>

            <style>{`
        .cp-wrap {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          overflow: hidden;
          z-index: 200;
          display: flex;
          flex-direction: column;
          max-height: 320px;
        }

        .cp-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--bg-lighter);
          border-bottom: 1px solid var(--border);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-gray);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }

        .cp-hint {
          margin-left: auto;
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          opacity: 0.7;
        }

        .cp-list {
          overflow-y: auto;
          flex: 1;
        }

        .cp-list::-webkit-scrollbar {
          width: 4px;
        }

        .cp-list::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }

        .cp-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.1s;
          font-family: inherit;
        }

        .cp-item:last-child {
          border-bottom: none;
        }

        .cp-item:hover,
        .cp-item-active {
          background: var(--primary-light);
        }

        .cp-item-active .cp-cmd {
          color: var(--primary);
        }

        .cp-cmd {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-dark);
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          letter-spacing: -0.01em;
        }

        .cp-preview {
          font-size: 12px;
          color: var(--text-gray);
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cp-highlight {
          background: rgba(107, 155, 124, 0.25);
          color: var(--primary-dark);
          border-radius: 2px;
          font-weight: 800;
        }
      `}</style>
        </div>
    )
}