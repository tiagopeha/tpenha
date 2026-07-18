# Spec do MVP

## Objetivo

Fazer com que um pai/mãe voluntário consiga marcar um jogo inteiro no celular, offline, sob sol, sem treinamento — e que a família a 400 km de distância acompanhe cada jogada por um link no WhatsApp.

**Métricas norte:** jogos marcados por fim de semana · acessos remotos únicos por jogo · % de jogos iniciados que são concluídos no app.

## Personas

1. **Anotador(a)** — pai ou mãe voluntário na arquibancada. Pode não dominar as regras a fundo. Precisa de uma interface que impeça erro, permita correção fácil e funcione sem internet.
2. **Técnico(a)** — voluntário, gerencia elenco e categorias, convoca para treinos e jogos, define a escalação (lineup).
3. **Familiar remoto** — avós, tios, o pai que ficou trabalhando. Não baixa app: clica no link do WhatsApp e acompanha ao vivo.

## Escopo

### Dentro (MVP)

- Criar time → categorias → elenco (nome, número, posições preferidas).
- Agenda de treinos e jogos + RSVP com notificação (confirmar presença / justificar ausência).
- Marcação de jogo ao vivo: escalação inicial, desfecho de cada aparição ao bastão, avanço de corredores, substituições, encerramento.
- Página pública do jogo (web): placar, situação atual (entrada, outs, corredores), play-by-play, box score simples.
- Resumo pós-jogo compartilhável.

### Fora (não construir)

Marketplace de personais · pagamentos/crowdfunding · caronas · vídeo/AR · ERA com corridas limpas · multi-anotador · chaveamento de torneio · perfil público de atleta · qualquer paywall.

## Fluxos principais

1. **Setup:** técnico cria o time, adiciona categoria e elenco, agenda um jogo.
2. **Pré-jogo:** anotador abre o jogo, confirma escalação (ordem de rebatida + posições), informa o adversário como texto livre — **nunca** exigir que o adversário exista na plataforma (erro fatal do GameChanger no Brasil).
3. **Ao vivo:** para cada rebatedor, o anotador toca o desfecho (grid de botões grandes: 1B · 2B · 3B · HR · BB · K · Eliminado · FC · Erro · SAC/SF · HBP). Em seguida confirma corredores no diamante visual (arrastar/tocar: avançou, marcou, eliminado). Cada ação gera eventos no log local e o placar da página web atualiza em segundos quando há rede.
4. **Correção:** botão "corrigir última jogada" sempre visível; correções mais antigas via linha do tempo do play-by-play. Correção = evento novo com `supersedes`, e as estatísticas re-derivam sozinhas.
5. **Compartilhar:** desde o pré-jogo existe o botão "copiar link do jogo" formatado para colar no WhatsApp.
6. **Pós-jogo:** encerramento (inclusive por mercy rule), resumo com box score, link permanece como registro histórico.

## Telas (mobile)

1. **Home do time** — próximos compromissos, atalho para jogo ao vivo se houver.
2. **Elenco** — lista por categoria, número e posições; adicionar/editar atleta (vinculado à conta do responsável).
3. **Agenda + RSVP** — evento com local/horário; pais confirmam presença; técnico vê a lista consolidada.
4. **Pré-jogo** — escalação por arrastar-e-soltar, adversário em texto livre, configuração do jogo (esporte, categoria, nº de entradas — herdado do perfil de regras).
5. **Marcação ao vivo** — a tela crítica. Diamante no topo (corredores, outs, entrada, placar), rebatedor atual em destaque, grid de desfechos embaixo. Botões grandes (uso sob sol, com uma mão). Zero digitação durante o jogo.
6. **Play-by-play / correções** — linha do tempo tocável.
7. **Resumo do jogo** — placar final, box score, compartilhar.

## Página pública do jogo (web)

- **Estados:** pré-jogo (escalações + horário) → ao vivo (placar, entrada, outs, corredores, play-by-play em tempo real) → final (resumo + box score).
- **Requisitos duros:** carregar instantânea no browser embutido do WhatsApp em 4G fraco; OG image dinâmica com o placar atual (o preview do link É a primeira impressão do produto); atualização via Supabase Realtime sem refresh; funcionar sem login.
- Rodapé discreto: "Marcado com [nome do app]" → esse é o único canal de aquisição do MVP.

## Estatísticas do MVP

- **Rebatedor:** PA, AB, H, 2B, 3B, HR, BB, HBP, K, R, RBI (simplificado), BA, OBP, SLG, OPS. Fórmulas exatas em `docs/modelo-de-eventos.md`.
- **Arremessador:** IP, H, R (RA — sem separar corridas limpas no v1), BB, K, WHIP, RA9. Contagem de arremessos: ver questão em aberto nº 2.
- Acumulados de temporada ficam para a fase 2; o MVP deriva e mostra por jogo.

## Questões em aberto — para o Tiago (árbitro)

1. **Perfis de regra por categoria:** entre T-Bol → Juvenil, e entre beisebol × softbol, o que muda e afeta a marcação? Nº de entradas, mercy rule (qual diferença/quando), roubo de base liberado a partir de qual categoria, ordem de rebatida completa vs 9, tee/arremesso do técnico nas menores, corredor substituto (courtesy runner)? Isso vira o `RulesProfile` de cada jogo.
2. **Pitch count:** CBBS/federações impõem limite de arremessos por idade com descanso obrigatório (estilo Pitch Smart)? Se sim, contador de arremessos com alerta ao técnico sobe de "opcional" para prioridade alta.
3. **Súmula oficial:** como é feita a anotação oficial hoje num torneio (súmula em papel da federação? quem preenche?). O app deve mirar em gerar/espelhar a súmula oficial no futuro, ou é registro paralelo? A resposta define quanto detalhe defensivo mínimo guardamos desde já.
4. **Terceiro strike caído e interferências:** com que frequência aparecem nas categorias de base? Precisam de botão dedicado ou correção manual resolve no v1?
5. **Piloto:** qual time/categoria pilota primeiro, e em qual jogo/torneio do calendário?

## Riscos de produto

- **A tela de marcação é o produto.** Se o voluntário se perder ali, nada mais importa. Prototipar e testar com um anotador real antes de polir qualquer outra tela.
- **WhatsApp é o concorrente do módulo de agenda.** O RSVP precisa ser mais fácil que responder "confirmado" num grupo — um toque na notificação.
- **Correção é fluxo principal, não exceção.** Anotador voluntário erra; o design parte disso.
