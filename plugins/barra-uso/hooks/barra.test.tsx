import { expect, mock, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

import { C, coloreContesto, coloreLibero, durata, libero, reset, tokens } from './register'

const ORA = new Date(2026, 9, 17, 16, 0).getTime()

const USO: SessionUsage = {
  startedAt: ORA - 72 * 60_000,
  context: { tokens: 84_000, window: 200_000, percent: 42 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23, resetsAt: new Date(2026, 9, 17, 18, 40).toISOString() },
    { kind: 'seven_day', percentUsed: 61, resetsAt: new Date(2026, 9, 20, 9, 0).toISOString() },
  ],
  cost: { usd: 1.837 },
}

const HINT = { component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } } as const

test('reset: ora se oggi, giorno e ora se dopo, e quanto manca', async () => {
  expect(reset(new Date(2026, 9, 17, 18, 40).toISOString(), ORA)).toEqual({ quando: '18:40', tra: '2h40m' })
  expect(reset(new Date(2026, 9, 20, 9, 0).toISOString(), ORA)).toEqual({ quando: 'mar 09:00', tra: '2g17h' })
  expect(reset(undefined, ORA)).toBe(null)
})

test('colori e unità', async () => {
  expect(libero({ kind: 'five_hour', percentUsed: 92.5 })).toBe(7.5)
  expect(coloreLibero(77)).toBe(C.verde)
  expect(coloreLibero(39)).toBe(C.ambra)
  expect(coloreLibero(7.5)).toBe(C.rosso)
  expect(coloreContesto(42)).toBe(C.ciano)
  expect(coloreContesto(85)).toBe(C.rosso)
  expect(tokens(950)).toBe('950')
  expect(tokens(1_000_000)).toBe('1M')
  expect(durata(26 * 3_600_000)).toBe('1g2h')
})

test('due righe sotto il prompt, e il 90% fa un toast', async ($, on) => {
  const clock = mock.clock(on)
  await clock.set(ORA)
  const toast: string[] = []
  on('session.usage', () => ({ value: USO }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => (toast.push(e.text), { value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })

  const vuota = await $.ui.mount({ plugin: 'barra-uso', surface: 'terminal', ...HINT })
  expect(await vuota.find({ type: 'Text', text: /opus/ })).toBeUndefined()
  await vuota.unmount()

  await $.session.measure({
    context: USO.context,
    rateLimits: [{ kind: 'five_hour', percentUsed: 91 }],
    cost: USO.cost,
    changed: ['rateLimits'],
  })
  expect(toast).toEqual(['Limite sessione 5h: resta 9%'])

  const ui = await $.ui.mount({ plugin: 'barra-uso', surface: 'terminal', ...HINT })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '77%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /18:40/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /opus-5-5/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
  await ui.unmount()
})
