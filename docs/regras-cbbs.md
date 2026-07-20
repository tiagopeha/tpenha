# Regras CBBS → requisitos de engenharia

Compilado dos regulamentos CBBS (anexo técnico CT-02 e regulamentos de torneios de base). **Os valores variam por edição e por torneio** — por isso, regra é DADO, não código: tudo aqui vira registros `RulesProfile` versionados, validados pelo Tiago (árbitro) contra o regulamento vigente antes de cada competição. Nunca hardcode um limite.

## 1. Pitch count — a funcionalidade nº 1 do produto

A contagem oficial de arremessos é competência da mesa de anotação, que **deve avisar o árbitro principal nos últimos 5 arremessos permitidos**. Automatizar isso é a proposta de valor dominante do app na mesa oficial ("back net").

### Limites diários por categoria (validar valores vigentes)

| Categoria | Idade típica | Limite diário |
| --- | --- | --- |
| T-Bol (jogando no Pré-Infantil, último ano) | 8 | 50 bolas — **em um único dia do torneio** (pode dividir entre 2 jogos do mesmo dia; proibido arremessar nos demais dias) |
| Pré-Infantil | 9–10 | 55 (60 em edições anteriores) |
| Infantil | 11–12 | 60 |
| Pré-Júnior e Júnior | 13–16 | 75 |
| Juvenil | 17–18 | 85 |
| Sub-23 / Adulto | 19+ | limite por **outs** (7 ou 21), não por bolas |

### Lógica obrigatória

1. **Alerta em `limite − 5`:** notificação visual ostensiva (laranja/vermelho): "Atleta X tem 5 arremessos restantes — notifique o árbitro principal". É dever regulamentar da mesa; o app assume o cálculo mental.
2. **"Terminar de enfrentar o rebatedor" — nunca hard block:** o arremessador que atinge o limite durante um confronto pode terminá-lo, ultrapassando o teto. O botão de arremesso jamais bloqueia. A legalidade é decidida por `pitchesAtStartOfAtBat ≤ limite`; se sim, o excedente é legal e **não acumula** para os tetos agregados de dois dias. Guardar as duas contagens: `officialPitches` e `overageToFinishBatter`.
3. **Reentrada no mesmo dia — proibida na margem exígua:** removido do montículo faltando poucos arremessos para o limite, o atleta não volta a arremessar no dia. Margens: Pré-Infantil/Infantil ≤ 6 restantes · Pré-Júnior/Júnior ≤ 8 · Juvenil ≤ 9. Validar no ato da realocação e bloquear/avisar com referência à norma.
4. **Dias consecutivos:** permitido respeitando o limite diário E o teto agregado de 2 dias consecutivos (valores do agregado: validar CT-02 vigente).
5. **T-Bol "um único dia":** antes de alocar um atleta de 8 anos como arremessador, consultar o histórico do torneio inteiro — se houver arremesso em data anterior, bloquear.
6. **Jogo suspenso (chuva) retomado no dia seguinte:** as bolas do jogo original valem para as restrições daquela partida, mas o razão diário recomeça — segmentar contagens por `gameId` E por `calendarDay`.
7. **Exclusividade arremessador ↔ receptor (mesmo dia, qualquer volume):** arremessou → não pode receber; recebeu (uma única recepção) → não pode arremessar. Validação cruzada no construtor de escalação: desabilitar visualmente a posição proibida + texto explicando a norma.

### Implicação de arquitetura

Tudo acima exige um **razão diário do atleta** que atravessa jogos: `derivePitcherDayLedger(eventos de todos os jogos do dia de competição)` → por atleta: bolas oficiais, excedente legal, jogos, flags `pitchedToday`/`caughtToday`, restantes, elegibilidade de reentrada. Logo, jogos precisam de um agrupamento leve por **dia de competição** (`competitionDayId` = torneio + data). Isso NÃO é gestão de chaveamento — é só o vínculo mínimo para o razão funcionar.

## 2. Perfil de regras por categoria (`RulesProfile`)

```ts
type RulesProfile = {
  id: string; name: string;            // "CBBS Pré-Infantil 2026 — fase classificatória"
  sport: 'baseball' | 'softball';
  category: Category;
  scheduledInnings: number;            // 6 (base) · 7 (softbol) · 9 (beisebol avançado)
  timeLimit?: { minutes: 90|100|120; stop: 'hard' | 'noNewInning' };
  runCapPerInning?: number;            // ex.: 5 pontos encerram a entrada (grupos B)
  mercy: { runDiff: number; fromInning: number; immediate: boolean }[];
                                       // ex.: [{20, 2, true /* Super Nocaute */}, {10 ou 15, entradas intermediárias, false}]
  pitching: {
    style: 'tee' | 'coachPitch' | 'kidPitch';
    dailyPitchLimit?: number; dailyOutLimit?: number;   // um OU outro
    warnAt: number;                     // dailyPitchLimit − 5
    reentryBanMargin?: 6 | 8 | 9;
    twoDayAggregateLimit?: number;      // validar
  };
  running: {
    leadOffAllowed: boolean;            // Pré-Infantil: false (sair antes da bola cruzar = infração)
    stealHomeAllowed: boolean;          // Pré-Infantil: false → tentativa = OUT declarado
    wpPbAdvanceCap?: 'oneBase';         // PI/Infantil: wild pitch/passed ball além da linha de 10 m ⇒ máx. 1 base
  };
  battingOrder: { mode: 'traditional9' | 'continuous'; maxSlots: number /* até 14 */; extraHitter?: boolean };
  tball?: { minHitDistanceM: 5; buntProhibited: true; infieldFly: false; deadBallOnReturnToCoach: true };
};
```

Semânticas que o motor aplica a partir do perfil:

- **Relógio:** `hard` = corte no segundo exato; `noNewInning` = termina a entrada corrente, não inicia outra. Cronômetro dispara no "Play Ball" (`clockStarted`).
- **Nocaute:** após cada corrida, avaliar `mercy[]`. Super Nocaute (20 pontos na 2ª entrada) encerra **imediatamente**, mesmo no meio da entrada — o app exibe intervenção obrigatória, não depende da memória do anotador.
- **T-Bol:** módulo de arremessos removido da UI (sem balls/strikes), botões de bunt e infield fly ocultos, submódulo de foul por distância < 5 m, jogada morta quando a bola volta ao técnico.

## 3. Escalação: ordem contínua, defesa desacoplada e corredor de cortesia

- **Ordem de rebatida contínua:** 12–14 atletas rebatem em sequência compulsória; a defesa é operada por 9. Trocas defensivas **não alteram** a ordem de rebatida. Em eventos livres existe o Rebatedor Extra (10 rebatedores) — vaga suplementar, não é DH.
- **Modelo:** `battingSlots` expansível (9–14) totalmente desacoplado do mapa defensivo (`position → playerId`). Dois tipos de mudança: substituição ofensiva (permanente no slot) × mudança defensiva (só reposiciona campo). Com ordem contínua, o módulo de substituição ofensiva fica desativado.
- **Corredor de cortesia (CC):** substitui pontualmente o arremessador ou receptor NAS BASES para acelerar o jogo. **Não é substituição oficial** — modelar como sobreposição efêmera (alias) sobre a ocupação da base; o titular permanece ativo e reentra normalmente. Tratar CC como substituição de nó na escalação é erro fatal (o sistema acusaria reentrada ilegal do titular). Um CC pode ser trocado por outro, ou virar substituto de verdade depois, via evento próprio. _Validar com árbitro: a corrida marcada pelo CC credita a quem na estatística individual?_
- **Softbol — empréstimo de atletas (roster override):** em torneios de base (ex.: Taça Brasil Sub-11 Feminino), permite-se completar os 9 com atletas emprestadas de equipes rivais. A escalação aceita "convidadas" avulsas sem alterar o registro-mãe da atleta no clube de origem.

## 4. Súmula oficial e o "fechamento"

- Toda equipe é **obrigada** a apresentar anotador para a mesa oficial; falha ⇒ **multa de R$ 350,00** por evento.
- A CBBS delegou à mesa o **fechamento** completo da súmula: tabulação manual de todas as estatísticas, inclusive ERA. Essa é a dor monetizável do clube — o app que fecha a súmula sozinho elimina risco de multa, erro e horas de trabalho.
- Para fechar de verdade, é preciso registrar **como** cada out ocorreu (ex.: assistência 6-3) e os erros — sem isso é impossível separar corrida merecida de corrida por erro (ERA). Por isso o **modo súmula oficial** exige atribuição defensiva; ver `modelo-de-eventos.md`.
- Fase 2: geração da súmula em PDF no layout oficial da federação (ponte de adoção antes de qualquer homologação formal). _Pedir ao Tiago um exemplar preenchido para clonar o layout._

### Numeração defensiva (para atribuição tipo "6-3")

1 Pitcher · 2 Catcher · 3 Primeira base · 4 Segunda base · 5 Terceira base · 6 Interbases (SS) · 7 Jardineiro esquerdo · 8 Central · 9 Direito.

## 5. Desempate: TQB e LOB

Hierarquia típica de classificação em grupos: vitórias → **TQB** → saldo de pontos → confronto direto.

- **TQB** = (pontos feitos ÷ entradas atacadas) − (pontos sofridos ÷ entradas defendidas), com entradas **fracionárias**: cada out vale ⅓ (2 outs na 5ª = 4,667 entradas). Nosso log registra cada out individualmente ⇒ `deriveTQB` é derivação pura, sem mudança de schema.
- **LOB por entrada atacada** (desempate seguinte): corredores em base no momento exato do 3º out. O rastreio posicional de corredores já dá isso ⇒ `deriveLOB` snapshot no `halfInningEnded`.

## 6. Validações pendentes (Tiago, como árbitro)

1. Valores vigentes do CT-02 desta temporada (limites por categoria + teto agregado de 2 dias) — ideal: anexar o PDF do regulamento no repo.
2. **Softbol:** existe limite de arremessos (windmill) nas categorias de base? A regra DP/FLEX é usada nos torneios CBBS?
3. Corrida do corredor de cortesia credita ao CC ou ao titular?
4. Exemplar de súmula oficial preenchida (foto/PDF) para a fase 2.
