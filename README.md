# claude-mods

Mod per Claude Code.

## barra-uso

Due righe colorate sotto il prompt di Claude Code:

```
⏵⏵ auto mode on (shift+tab to cycle)
ctx 16% 159k/1M · 5h 82% ↻ 17:10 (4h35m) · sett 84% ↻ mer 17:00 (4g4h)  │  opus-5-5 · $2.55 · 9m · ⎇ main
```

- **ctx**: contesto usato, in percentuale e in token sulla finestra del modello
- **5h**: quanto resta della finestra di 5 ore, quando si azzera e tra quanto
- **sett**: quanto resta del limite settimanale, quando si azzera e tra quanto
- modello, costo della sessione, durata della sessione, branch git

I colori dicono a colpo d'occhio come sei messo: verde se resta più di metà, ambra sotto il 50%, rosso sotto il 20%. Un avviso compare quando un limite arriva al 90% e quando il contesto supera l'85%.

I limiti di 5 ore e settimanali si vedono solo con un abbonamento Claude (Pro/Max) e compaiono dopo la prima risposta del modello.

## Installazione

Al prompt di una sessione di Claude Code nel terminale:

```
/plugin install barra-uso --marketplace msworks-it/claude-mods
```

Rispondi `y` per aggiungere il marketplace, poi scegli lo scope (user per averla in ogni sessione).

Da una shell:

```
claude plugin install barra-uso --marketplace msworks-it/claude-mods
```

Nell'app desktop, dove `/plugin` non funziona: clicca + accanto al prompt, poi Plugins, Add marketplace con `msworks-it/claude-mods`, poi Add plugin.
