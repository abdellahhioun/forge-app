import { useEffect, useState } from 'react'
import { useForgeStore } from '../store'
import { GitBranch, Files, Layers, Cpu } from 'lucide-react'
import type { ProjectContext } from '../../../shared/types'

export default function DashboardPanel() {
  const { activeProject } = useForgeStore()
  const [ctx, setCtx] = useState<ProjectContext | null>(null)
  const [loading, setLoading] = useState(false)

  const normalizeCtx = (c: any): ProjectContext | null => {
    if (!c) return null
    return {
      name: c.name ?? c.project?.name ?? activeProject?.name ?? 'Unknown',
      version: c.version ?? c.project?.version ?? '0.1.0',
      branch: c.branch ?? c.git?.branch ?? 'unknown',
      clean: typeof c.clean === 'boolean' ? c.clean : !(c.git?.isDirty ?? false),
      fileCount: c.fileCount ?? c.files?.total ?? 0,
      totalLines: c.totalLines ?? c.files?.estimatedLines ?? 0,
      stack: Array.isArray(c.stack) ? c.stack.join(' + ') : (c.stack ?? 'Unknown'),
      lastCommit: c.lastCommit ?? (c.git?.recentCommits?.[0] ? `${c.git.recentCommits[0].hash} ${c.git.recentCommits[0].subject.replace(/\\n/g, ' ')} (${c.git.recentCommits[0].time})` : 'No commits yet'),
      keyFiles: c.keyFiles ?? c.files?.keyFiles ?? [],
    } as ProjectContext
  }

  useEffect(() => {
    if (!activeProject) return
    setLoading(true)
    if (!window.forge) return
    window.forge.context.get(activeProject.path).then(c => {
      setCtx(normalizeCtx(c))
      setLoading(false)
    })
  }, [activeProject])

  const handleReindex = async () => {
    if (!activeProject) return
    setLoading(true)
    await window.forge.context.index(activeProject.path)
    const c = await window.forge.context.get(activeProject.path)
    setCtx(normalizeCtx(c))
    setLoading(false)
  }

  if (!activeProject) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13 }}>
      Open a project to see its dashboard
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
            {activeProject.name}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {activeProject.path}
          </p>
        </div>
        <button
          onClick={handleReindex}
          disabled={loading}
          style={{
            padding: '6px 14px', background: 'var(--pri)', color: '#fff',
            borderRadius: 'var(--r2)', fontSize: 12, fontWeight: 500,
            opacity: loading ? .6 : 1,
          }}
        >
          {loading ? 'Indexing…' : 'Re-index'}
        </button>
      </div>

      {/* KPI cards */}
      {ctx && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}>
            <KpiCard icon={<GitBranch size={16} />} label="Branch" value={ctx.branch} accent={ctx.clean ? 'var(--ok)' : 'var(--warn)'} />
            <KpiCard icon={<Files size={16} />} label="Files" value={String(ctx.fileCount)} />
            <KpiCard icon={<Layers size={16} />} label="Lines" value={ctx.totalLines.toLocaleString()} />
            <KpiCard icon={<Cpu size={16} />} label="Stack" value={ctx.stack} />
          </div>

          {/* Last commit */}
          <Section title="Last Commit">
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--muted)', padding: '10px 14px',
              background: 'var(--surface)', borderRadius: 'var(--r3)',
              border: '1px solid var(--brd)',
            }}>
              {ctx.lastCommit}
            </div>
          </Section>

          {/* Key files */}
          <Section title="Key Files">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ctx.keyFiles.map(f => (
                <div key={f} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--pri)', padding: '6px 12px',
                  background: 'var(--surface)', borderRadius: 'var(--r2)',
                  border: '1px solid var(--brd)',
                }}>
                  {f}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {!ctx && !loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 48, color: 'var(--faint)', gap: 10,
        }}>
          <Cpu size={36} strokeWidth={1} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No context found</div>
          <button
            onClick={handleReindex}
            style={{
              marginTop: 4, padding: '7px 16px',
              background: 'var(--pri)', color: '#fff',
              borderRadius: 'var(--r2)', fontSize: 12,
            }}
          >
            Index project
          </button>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, accent = 'var(--pri)' }: {
  icon: React.ReactNode; label: string; value: string; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--brd)',
      borderRadius: 'var(--r3)', padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: accent, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--faint)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '.07em',
        textTransform: 'uppercase', color: 'var(--faint)',
        marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  )
}
