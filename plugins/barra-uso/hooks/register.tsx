import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, Timer } from 'claude-code'

import type { Istantanea } from '../types'

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const REFRESH_MS = 30_000

export const C = {
  verde: '#9ece6a',
  ambra: '#e0af68',
  rosso: '#f7768e',
  ciano: '#7dcfff',
  blu: '#7aa2f7',
  viola: '#bb9af7',
  acqua: '#73daca',
  arancio: '#ff9e64',
}

const snap = atom({ plugin: 'barra-uso', key: 'snap' } as const, null)

export function tokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

export function durata(ms: number): string {
  const minuti = Math.max(0, Math.floor(ms / 60_000))
  const g = Math.floor(minuti / 1440)
  const h = Math.floor((minuti % 1440) / 60)
  const m = minuti % 60
  if (g > 0) return `${g}g${h}h`
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  return `${m}m`
}

function ora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Quando torna la finestra: l'ora se è oggi, altrimenti giorno e ora; e quanto manca. */
export function reset(iso: string | undefined, now: number): { quando: string; tra: string } | null {
  if (iso === undefined) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const oggi = new Date(now).toDateString() === d.toDateString()
  return { quando: oggi ? ora(d) : `${GIORNI[d.getDay()]} ${ora(d)}`, tra: durata(d.getTime() - now) }
}

export function libero(limit: SessionRateLimit): number {
  return Math.max(0, Math.round((100 - limit.percentUsed) * 10) / 10)
}

/** Colore di ciò che resta: verde oltre metà, ambra fino al 20%, rosso sotto. */
export function coloreLibero(percent: number): string {
  return percent > 50 ? C.verde : percent > 20 ? C.ambra : C.rosso
}

/** Colore del contesto usato: ciano fino al 60%, ambra fino all'80%, rosso oltre. */
export function coloreContesto(percent: number): string {
  return percent < 60 ? C.ciano : percent < 80 ? C.ambra : C.rosso
}

export function nomeModello(model: string): string {
  return model.replace(/^claude-/, '')
}

let branch: string | null = null
let timer: Timer | undefined
const avvisati = new Set<string>()

async function leggiBranch($: EngineInterface) {
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeoutMs: 3000,
    })
    branch = exitCode === 0 ? stdout.trim() || null : null
  } catch {
    branch = null
  }
}

async function aggiorna($: EngineInterface) {
  const [model, usage, now] = await Promise.all([$.session.model(), $.session.usage(), $.clock.now()])
  await update($, snap, () => ({ model, usage, branch, now }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined)
    await leggiBranch($)
    await aggiorna($)
    timer?.cancel()
    timer = $.clock.every(REFRESH_MS, () => void aggiorna($).catch(() => {}))
    return result
  })

  on('session.measure', async ($, e, next) => {
    for (const limit of e.rateLimits) {
      const chiave = `${limit.kind}:${limit.resetsAt ?? ''}`
      if (limit.percentUsed >= 90 && !avvisati.has(chiave)) {
        avvisati.add(chiave)
        const nome = limit.kind === 'five_hour' ? 'sessione 5h' : limit.kind === 'seven_day' ? 'settimana' : limit.kind
        $.ui.toast(`Limite ${nome}: resta ${Math.round(libero(limit))}%`)
      }
    }
    if ((e.context.percent ?? 0) >= 85 && !avvisati.has('ctx')) {
      avvisati.add('ctx')
      $.ui.toast(`Contesto all'${e.context.percent}%: valuta /compact`)
    }
    if ((e.context.percent ?? 0) < 50) avvisati.delete('ctx')

    await aggiorna($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await leggiBranch($)
    await aggiorna($)
    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const dati: Istantanea | null = await read($, snap)
    const motore = await next(e)
    if (dati === null) return motore

    const { Box, Text } = $.ui.resolve(e)
    const { model, usage, now } = dati
    const { context, rateLimits, cost } = usage
    const largo = (e.viewport?.columns ?? 160) >= 140
    const sep = <Text dimColor>{' · '}</Text>

    const finestra = (etichetta: string, kind: string) => {
      const limit = rateLimits.find(l => l.kind === kind)
      if (limit === undefined) {
        return (
          <Text>
            <Text dimColor>{etichetta} —</Text>
          </Text>
        )
      }
      const resta = libero(limit)
      const quando = reset(limit.resetsAt, now)
      return (
        <Text>
          <Text dimColor>{etichetta} </Text>
          <Text color={coloreLibero(resta)} weight="bold">
            {resta}%
          </Text>
          {quando && (
            <Text>
              <Text color={C.blu}> ↻ {quando.quando}</Text>
              {largo && <Text dimColor> ({quando.tra})</Text>}
            </Text>
          )}
        </Text>
      )
    }

    const contesto =
      context.percent !== undefined && context.tokens !== undefined ? (
        <Text>
          <Text dimColor>ctx </Text>
          <Text color={coloreContesto(context.percent)} weight="bold">
            {context.percent}%
          </Text>
          <Text dimColor>
            {' '}
            {tokens(context.tokens)}/{tokens(context.window)}
          </Text>
        </Text>
      ) : (
        <Text dimColor>ctx — /{tokens(context.window)}</Text>
      )

    return (
      <Box flexDirection="column">
        {motore}
        <Text>
          {contesto}
          {sep}
          {finestra('5h', 'five_hour')}
          {sep}
          {finestra('sett', 'seven_day')}
          <Text dimColor>{'  │  '}</Text>
          <Text>
            <Text color={C.viola}>{nomeModello(model)}</Text>
            {cost !== undefined && (
              <Text>
                {sep}
                <Text color={C.acqua}>${cost.usd.toFixed(2)}</Text>
              </Text>
            )}
            {sep}
            <Text dimColor>{durata(now - usage.startedAt)}</Text>
            {dati.branch && (
              <Text>
                {sep}
                <Text color={C.arancio}>⎇ {dati.branch}</Text>
              </Text>
            )}
          </Text>
        </Text>
      </Box>
    )
  })
}
