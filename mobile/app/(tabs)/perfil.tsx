import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { colors, spacing, radius } from '@/constants/theme'
import { getProfile, upsertProfile } from '@/lib/database'
import { calcBMR, calcTDEE } from '@/lib/calculator'
import {
  isHealthConnectAvailable,
  requestHealthPermissions,
} from '@/lib/health'
import type { UserProfile, Sex, Goal, ActivityLevel } from '@/lib/types'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentário', desc: 'Pouco ou nenhum exercício' },
  { value: 'light', label: 'Leve', desc: '1-3 dias/semana' },
  { value: 'moderate', label: 'Moderado', desc: '3-5 dias/semana' },
  { value: 'active', label: 'Ativo', desc: '6-7 dias/semana' },
  { value: 'very_active', label: 'Muito Ativo', desc: 'Atleta / trabalho físico' },
]

export default function PerfilScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [healthAvailable, setHealthAvailable] = useState<boolean | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Form state
  const [name, setName] = useState('Usuário')
  const [weightKg, setWeightKg] = useState('70')
  const [heightCm, setHeightCm] = useState('170')
  const [age, setAge] = useState('30')
  const [sex, setSex] = useState<Sex>('m')
  const [goal, setGoal] = useState<Goal>('deficit')
  const [targetDeficit, setTargetDeficit] = useState('500')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [apiKey, setApiKey] = useState('')

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      if (profile) {
        setName(profile.name)
        setWeightKg(String(profile.weight_kg))
        setHeightCm(String(profile.height_cm))
        setAge(String(profile.age))
        setSex(profile.sex)
        setGoal(profile.goal)
        setTargetDeficit(String(profile.target_deficit_kcal))
        setActivityLevel(profile.activity_level)
        setApiKey(profile.anthropic_api_key)
      }

      const avail = await isHealthConnectAvailable()
      setHealthAvailable(avail)
    } catch (err) {
      console.error('Perfil load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    // Validate
    const weight = parseFloat(weightKg)
    const height = parseFloat(heightCm)
    const ageNum = parseInt(age, 10)
    const deficit = parseInt(targetDeficit, 10)

    if (
      isNaN(weight) ||
      weight < 30 ||
      weight > 300 ||
      isNaN(height) ||
      height < 100 ||
      height > 250 ||
      isNaN(ageNum) ||
      ageNum < 10 ||
      ageNum > 120
    ) {
      Alert.alert(
        'Dados inválidos',
        'Verifique peso (30-300 kg), altura (100-250 cm) e idade (10-120 anos).'
      )
      return
    }

    setSaving(true)
    setSaved(false)
    try {
      const profile: Partial<UserProfile> = {
        name: name.trim() || 'Usuário',
        weight_kg: weight,
        height_cm: height,
        age: ageNum,
        sex,
        goal,
        target_deficit_kcal: isNaN(deficit) ? 500 : deficit,
        activity_level: activityLevel,
        anthropic_api_key: apiKey.trim(),
      }
      await upsertProfile(profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConnectHealth = async () => {
    const granted = await requestHealthPermissions()
    if (granted) {
      Alert.alert('Conectado!', 'Permissões do Health Connect concedidas com sucesso.')
    } else {
      Alert.alert(
        'Permissão negada',
        'Acesse as configurações do Health Connect para conceder as permissões manualmente.'
      )
    }
  }

  // Computed values for preview
  const computedBMR = (): number | null => {
    const w = parseFloat(weightKg)
    const h = parseFloat(heightCm)
    const a = parseInt(age, 10)
    if (isNaN(w) || isNaN(h) || isNaN(a)) return null
    const base = 10 * w + 6.25 * h - 5 * a
    return Math.round(sex === 'm' ? base + 5 : base - 161)
  }

  const computedTDEE = (): number | null => {
    const bmr = computedBMR()
    if (!bmr) return null
    const multipliers: Record<ActivityLevel, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    }
    return Math.round(bmr * multipliers[activityLevel])
  }

  const bmr = computedBMR()
  const tdee = computedTDEE()

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>Meu Perfil</Text>

          {/* ── Personal data ── */}
          <SectionCard title="Dados Pessoais">
            <FormField label="Nome">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.muted}
              />
            </FormField>

            <View style={styles.row}>
              <FormField label="Peso (kg)" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="numeric"
                  placeholder="70"
                  placeholderTextColor={colors.muted}
                />
              </FormField>
              <FormField label="Altura (cm)" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="numeric"
                  placeholder="170"
                  placeholderTextColor={colors.muted}
                />
              </FormField>
              <FormField label="Idade" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={colors.muted}
                />
              </FormField>
            </View>

            {/* Sex */}
            <FormField label="Sexo">
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, sex === 'm' && styles.toggleBtnActive]}
                  onPress={() => setSex('m')}
                >
                  <Text style={[styles.toggleLabel, sex === 'm' && styles.toggleLabelActive]}>
                    Masculino
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, sex === 'f' && styles.toggleBtnActive]}
                  onPress={() => setSex('f')}
                >
                  <Text style={[styles.toggleLabel, sex === 'f' && styles.toggleLabelActive]}>
                    Feminino
                  </Text>
                </TouchableOpacity>
              </View>
            </FormField>
          </SectionCard>

          {/* ── Goal ── */}
          <SectionCard title="Objetivo">
            <View style={styles.toggleRow}>
              {([
                { v: 'deficit' as Goal, l: 'Déficit', e: '📉' },
                { v: 'maintain' as Goal, l: 'Manter', e: '⚖️' },
                { v: 'surplus' as Goal, l: 'Superávit', e: '📈' },
              ] as { v: Goal; l: string; e: string }[]).map(({ v, l, e }) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.toggleBtn, goal === v && styles.toggleBtnActive, { flex: 1 }]}
                  onPress={() => setGoal(v)}
                >
                  <Text style={styles.toggleEmoji}>{e}</Text>
                  <Text style={[styles.toggleLabel, goal === v && styles.toggleLabelActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(goal === 'deficit' || goal === 'surplus') && (
              <FormField
                label={
                  goal === 'deficit'
                    ? 'Meta de déficit diário (kcal)'
                    : 'Meta de superávit diário (kcal)'
                }
              >
                <TextInput
                  style={styles.input}
                  value={targetDeficit}
                  onChangeText={setTargetDeficit}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.fieldHint}>
                  {goal === 'deficit'
                    ? 'Recomendado: 300-700 kcal/dia para perda saudável'
                    : 'Recomendado: 200-500 kcal/dia para ganho de massa'}
                </Text>
              </FormField>
            )}
          </SectionCard>

          {/* ── Activity level ── */}
          <SectionCard title="Nível de Atividade">
            <View style={{ gap: 8 }}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.activityBtn,
                    activityLevel === opt.value && styles.activityBtnActive,
                  ]}
                  onPress={() => setActivityLevel(opt.value)}
                >
                  <View style={styles.activityBtnLeft}>
                    <Text
                      style={[
                        styles.activityLabel,
                        activityLevel === opt.value && styles.activityLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.activityDesc}>{opt.desc}</Text>
                  </View>
                  {activityLevel === opt.value && (
                    <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>

          {/* ── BMR / TDEE preview ── */}
          {bmr && tdee && (
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>Cálculo Metabólico</Text>
              <View style={styles.calcRow}>
                <View style={styles.calcItem}>
                  <Text style={styles.calcValue}>{bmr}</Text>
                  <Text style={styles.calcLabel}>BMR (kcal)</Text>
                  <Text style={styles.calcDesc}>Taxa metabólica basal</Text>
                </View>
                <View style={styles.calcArrow}>
                  <Text style={styles.calcArrowText}>→</Text>
                </View>
                <View style={styles.calcItem}>
                  <Text style={[styles.calcValue, { color: colors.primary }]}>{tdee}</Text>
                  <Text style={styles.calcLabel}>TDEE (kcal)</Text>
                  <Text style={styles.calcDesc}>Gasto total diário</Text>
                </View>
              </View>
              {goal === 'deficit' && (
                <Text style={styles.calcTarget}>
                  Meta de consumo: ~{tdee - parseInt(targetDeficit || '0', 10)} kcal/dia
                </Text>
              )}
            </View>
          )}

          {/* ── API Key ── */}
          <SectionCard title="Inteligência Artificial">
            <View style={styles.apiKeyInfo}>
              <Text style={styles.apiKeyInfoText}>
                A chave da API Anthropic é usada para analisar fotos de refeições com o
                Claude. Obtenha sua chave em{' '}
                <Text style={{ color: colors.primary }}>console.anthropic.com</Text>
              </Text>
            </View>
            <FormField label="Chave API Anthropic">
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="sk-ant-api..."
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  <Text style={styles.eyeIcon}>{showApiKey ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </FormField>
          </SectionCard>

          {/* ── Samsung Health / Health Connect ── */}
          <SectionCard title="Samsung Health">
            <View style={styles.healthStatus}>
              <View style={styles.healthStatusLeft}>
                <View
                  style={[
                    styles.healthDot,
                    {
                      backgroundColor:
                        healthAvailable === null
                          ? colors.muted
                          : healthAvailable
                          ? colors.success
                          : colors.danger,
                    },
                  ]}
                />
                <Text style={styles.healthStatusText}>
                  {healthAvailable === null
                    ? 'Verificando...'
                    : healthAvailable
                    ? 'Health Connect disponível'
                    : 'Health Connect não disponível'}
                </Text>
              </View>
            </View>

            <View style={styles.healthInfo}>
              <Text style={styles.healthInfoText}>
                O FitIA usa o Health Connect para ler dados de passos, sono, frequência
                cardíaca e exercícios. O Samsung Health sincroniza automaticamente com o
                Health Connect.
              </Text>
            </View>

            {healthAvailable && (
              <TouchableOpacity style={styles.connectBtn} onPress={handleConnectHealth}>
                <Text style={styles.connectBtnText}>🔗 Conectar / Renovar Permissões</Text>
              </TouchableOpacity>
            )}

            {!healthAvailable && (
              <View style={styles.healthSteps}>
                <Text style={styles.healthStepsTitle}>Como conectar:</Text>
                <Text style={styles.healthStep}>1. Instale o Health Connect (Play Store)</Text>
                <Text style={styles.healthStep}>2. Abra o Samsung Health</Text>
                <Text style={styles.healthStep}>
                  3. Configurações → Conectar com outros apps
                </Text>
                <Text style={styles.healthStep}>4. Ative o Health Connect</Text>
              </View>
            )}
          </SectionCard>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {saved ? '✓ Salvo!' : 'Salvar Perfil'}
              </Text>
            )}
          </TouchableOpacity>

          {saved && (
            <Text style={styles.savedFeedback}>
              ✓ Perfil salvo com sucesso
            </Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={sectionStyles.card}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={{ gap: 14 }}>{children}</View>
    </View>
  )
}

function FormField({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: object
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
})

const fieldStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md },
  pageTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  toggleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  toggleEmoji: { fontSize: 16 },
  toggleLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  toggleLabelActive: { color: colors.primary },
  fieldHint: { color: colors.muted, fontSize: 12 },
  activityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  activityBtnLeft: { gap: 2 },
  activityLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  activityLabelActive: { color: colors.primary },
  activityDesc: { color: colors.muted, fontSize: 12 },
  calcCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    padding: spacing.md,
    gap: 12,
  },
  calcTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  calcItem: { alignItems: 'center', gap: 2 },
  calcValue: { color: colors.text, fontSize: 26, fontWeight: '700' },
  calcLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  calcDesc: { color: colors.muted, fontSize: 11 },
  calcArrow: { padding: 8 },
  calcArrowText: { color: colors.muted, fontSize: 20 },
  calcTarget: {
    color: colors.success,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  apiKeyInfo: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  apiKeyInfoText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyeBtn: {
    padding: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyeIcon: { fontSize: 18 },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  healthStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthStatusText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  healthInfo: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthInfoText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 13,
    alignItems: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  healthSteps: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthStepsTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  healthStep: { color: colors.muted, fontSize: 13 },
  saveBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  savedFeedback: {
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
})
