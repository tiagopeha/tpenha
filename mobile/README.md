# FitIA — App Mobile Android

Dashboard de déficit calórico que integra Samsung Health, registro de refeições com IA (Claude) e cálculos nutricionais. Tudo roda localmente no celular.

## Pré-requisitos

- Node.js 18+
- Android Studio (para build nativo) ou Expo Go (para testar rapidamente)
- Android 9+ com Samsung Health instalado
- Health Connect instalado (Android 13 e abaixo: instale pela Play Store; Android 14+: já incluso)

## Setup

```bash
cd mobile
npm install
```

## Rodar no celular (Expo Go)

```bash
npx expo start
```

Escaneie o QR code com o Expo Go app (Android).

> Atenção: react-native-health-connect não funciona no Expo Go — só no build nativo.

## Build APK (instalar direto)

```bash
# Instale EAS CLI
npm install -g eas-cli

# Login na Expo (conta gratuita em expo.dev)
eas login

# Build local (precisa Android Studio instalado)
npx expo run:android

# Ou build na nuvem (recomendado)
eas build -p android --profile preview
```

O APK gerado pode ser instalado diretamente no celular via ADB ou transferência de arquivo.

## Configuração do app

1. Abra o app → aba **Perfil**
2. Preencha seus dados (peso, altura, idade, sexo)
3. Adicione sua **Anthropic API Key** (obtenha em console.anthropic.com)
4. Permita acesso ao **Health Connect** quando solicitado
5. No Samsung Health → Configurações → Conectar com outros apps → ative o Health Connect

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | Expo SDK 51 + React Native 0.74 |
| Navegação | Expo Router (file-based) |
| Banco local | expo-sqlite |
| Saúde | react-native-health-connect (Health Connect API) |
| IA refeições | Claude API (Anthropic) — claude-opus-4-7 com visão |
| UI | StyleSheet + react-native-svg |

## Estrutura

```
mobile/
├── app/
│   ├── _layout.tsx          ← Root layout + inicialização do SQLite
│   └── (tabs)/
│       ├── _layout.tsx      ← Barra de abas (4 abas)
│       ├── index.tsx        ← Dashboard com gauge, macros, Samsung Health
│       ├── refeicoes.tsx    ← Refeições agrupadas por tipo
│       ├── treinos.tsx      ← Treinos, sono e frequência cardíaca
│       └── perfil.tsx       ← Configurações do perfil
├── components/
│   ├── DeficitGauge.tsx     ← Gauge circular SVG
│   ├── MacrosBar.tsx        ← Barra de progresso horizontal
│   ├── MealCard.tsx         ← Card de refeição
│   ├── MealForm.tsx         ← Modal de nova refeição (foto + IA)
│   ├── SamsungCard.tsx      ← Card de métrica de saúde
│   └── RecommendationCard.tsx ← Card de recomendação
├── lib/
│   ├── database.ts          ← CRUD SQLite
│   ├── calculator.ts        ← BMR, TDEE, déficit, recomendação
│   ├── claude.ts            ← Chamadas à API Claude
│   ├── health.ts            ← Wrapper Health Connect
│   └── types.ts             ← Interfaces TypeScript
└── constants/
    └── theme.ts             ← Cores, espaçamentos
```
