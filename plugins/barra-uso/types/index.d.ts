export type Finestra = { kind: string; percentUsed: number; resetsAt?: string }

export type Uso = {
  startedAt: number
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: Finestra[]
  cost?: { usd: number }
}

export type Istantanea = { model: string; usage: Uso; branch: string | null; now: number }

declare module 'claude-code' {
  interface PluginState {
    'barra-uso': { snap: Istantanea | null }
  }
}
