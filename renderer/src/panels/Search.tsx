import { useState, useEffect, useRef, useCallback } from 'react'
import { useForgeStore } from '../store'
import { Search, CaseSensitive, Regex, FileCode, ChevronDown, ChevronRight } from 'lucide-react'

interface Hit { file: string; line: number; text: string }
interface FileGroup { file: string; hits: Hit[] }

function groupByFile(results: Hit[]): FileGroup[] {
  const map = new Map<string, Hit[]>()
  for (const h of results) {
    if (!map.has(h.file)) map.set(h.file, [])
    map.get(h.file)!.push(h)
  }
  return Array.from(map.entries()).map(([file, hits]) => ({ file, hits }))
}

function highlightMatch(text: string, query: string, matchCase: boolean) {
  if (!query) return <span>{text}</span>
  try {
    const flags = matchCase ? 'g' : 'gi'
    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    const parts: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index))
      parts.push(
        <mark key={m.index} style={{
          background: 'color-mix(in oklch, var(--pri) 35%, transparent)',
          color: 'var(--txt)',
          borderRadius: 2,
          padding: '0 1px',
        }}>{m[0]}</mark>
      )
      last = re.lastIndex
      if (re.lastIndex === m.index) re.lastIndex++
    }
    if (last < text.length) parts.push(text.slice(last))
    return <>{parts}</>
  } catch {
    return <span>{text}</span>
  }
}

const EXT_COLOR: Record<string, string> = {
  ts: '#4f98a3', tsx: '#4f98a3', js: '#e8af34', jsx: '#e8af34',
  json: '#e89050', md: '#a8d0a0', css: '#d163a7', html: '#e8af34',
  py: '#6daa45', rs: '#e89050', go: '#5591c7', sh: '#a86fdf',
}

export default function SearchPanel() {
  const { activeProject, openFile, setActiveFile, setActivePanel } = useForgeStore()

  const [query, setQuery]           = useState('')
  const [matchCase, setMatchCase]   = useState(false)
  const [useRegex, setUseRegex]     = useState(false)
  const [results, setResults]       = useState<FileGroup[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())
  const debounceRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                     = useRef<HTMLInputElement>(null)

  // Focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const runSearch = useCallback(async (q: string, mc: boolean, rx: boolean) => {
    if (!activeProject || !q.trim()) {
      setResults([])
      setTotal(0)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await window.forge.files.search(activeProject.path, q, { matchCase: mc, regex: rx })
      if (res.ok && res.results) {
        const groups = groupByFile(res.results)
        setResults(groups)
        setTotal(res.results.length)
      } else {
        setError(res.error || 'Search failed')
        setResults([])
        setTotal(0)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query, matchCase, useRegex), 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, matchCase, useRegex, runSearch])

  const openFileAtLine = async (file: string, line: number) => {
    if (!activeProject) return
    const fullPath = `${activeProject.path}/${file}`
    const res = await window.forge.files.read(fullPath)
    if (res.ok && res.content !== undefined) {
      openFile(fullPath, res.content)
      setActiveFile(fullPath)
      setActivePanel('editor')
      // Monaco will open the file — line jump via editor action if available
    }
  }

  const toggleCollapse = (file: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  if (!activeProject) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--faint)' }}>
        <Search size={32} strokeWidth={1} />
        <span style={{ fontSize: 12 }}>Open a project first</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Search Input Row */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: '1px solid var(--brd)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{
            position: 'absolute', left: 9,
            color: loading ? 'var(--pri)' : 'var(--faint)',
            flexShrink: 0,
            transition: 'color 0.2s',
            ...(loading ? { animation: 'searchPulse 1.2s ease-in-out infinite' } : {}),
          }} />

          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search in files…"
            spellCheck={false}
            style={{
              flex: 1,
              paddingLeft: 30, paddingRight: 72,
              paddingTop: 7, paddingBottom: 7,
              background: 'var(--bg)',
              border: '1px solid var(--brd)',
              borderRadius: 'var(--r2)',
              color: 'var(--txt)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--pri)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--brd)' }}
          />

          {/* Toggle: Case sensitive */}
          <button
            onClick={() => setMatchCase(c => !c)}
            title="Match Case (Alt+C)"
            style={{
              position: 'absolute', right: 34,
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r1)',
              color: matchCase ? 'var(--pri)' : 'var(--faint)',
              background: matchCase ? 'color-mix(in oklch, var(--pri) 15%, transparent)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <CaseSensitive size={13} />
          </button>

          {/* Toggle: Regex */}
          <button
            onClick={() => setUseRegex(r => !r)}
            title="Use Regular Expression (Alt+R)"
            style={{
              position: 'absolute', right: 8,
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r1)',
              color: useRegex ? 'var(--pri)' : 'var(--faint)',
              background: useRegex ? 'color-mix(in oklch, var(--pri) 15%, transparent)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <Regex size={13} />
          </button>
        </div>

        {/* Summary row */}
        {query.trim() && !loading && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
            {error
              ? <span style={{ color: 'var(--warn)' }}>⚠ {error}</span>
              : total === 0
                ? 'No results'
                : `${total} result${total === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}${total >= 500 ? ' (capped at 500)' : ''}`
            }
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {!query.trim() && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 20px', gap: 10, color: 'var(--faint)',
          }}>
            <Search size={28} strokeWidth={1} />
            <span style={{ fontSize: 12, textAlign: 'center', color: 'var(--muted)' }}>
              Type to search across all project files
            </span>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>
              Use <kbd style={kbdStyle}>Aa</kbd> for case and <kbd style={kbdStyle}>.*</kbd> for regex
            </span>
          </div>
        )}

        {results.map(group => {
          const isOpen = !collapsed.has(group.file)
          const ext = group.file.split('.').pop() ?? ''
          const color = EXT_COLOR[ext] ?? 'var(--muted)'
          const fileName = group.file.split('/').pop() ?? group.file
          const dir = group.file.includes('/') ? group.file.slice(0, group.file.lastIndexOf('/')) : ''

          return (
            <div key={group.file} style={{ borderBottom: '1px solid var(--div)' }}>
              {/* File header */}
              <button
                onClick={() => toggleCollapse(group.file)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  width: '100%', padding: '6px 12px',
                  background: 'transparent', textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--offset)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--faint)', flexShrink: 0 }}>
                  {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </span>
                <FileCode size={12} style={{ color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>
                  {fileName}
                </span>
                {dir && (
                  <span style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dir}
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                  color: 'var(--pri)', background: 'color-mix(in oklch, var(--pri) 12%, transparent)',
                  padding: '1px 7px', borderRadius: 99, flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {group.hits.length}
                </span>
              </button>

              {/* Hits */}
              {isOpen && group.hits.map((hit, i) => (
                <button
                  key={i}
                  onClick={() => openFileAtLine(hit.file, hit.line)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 0,
                    width: '100%', padding: '3px 12px 3px 30px',
                    background: 'transparent', textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    borderTop: i === 0 ? 'none' : '1px solid var(--div)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--pri) 5%, var(--offset))' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Line number */}
                  <span style={{
                    fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)',
                    width: 36, flexShrink: 0, paddingTop: 2, userSelect: 'none',
                  }}>
                    {hit.line}
                  </span>
                  {/* Match text */}
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    color: 'var(--muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: '1.6',
                  }}>
                    {highlightMatch(hit.text, query, matchCase)}
                  </span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes searchPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--offset)',
  border: '1px solid var(--brd)',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--muted)',
}
