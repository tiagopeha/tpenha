import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { colors, radius, spacing } from '@/constants/theme'
import { analyzeMeal } from '@/lib/claude'
import { getProfile } from '@/lib/database'
import type { Meal, MealType, ClaudeNutrition } from '@/lib/types'

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'cafe', label: 'Café', emoji: '☕' },
  { value: 'almoco', label: 'Almoço', emoji: '\u{1F37D}️' },
  { value: 'jantar', label: 'Jantar', emoji: '\u{1F319}' },
  { value: 'lanche', label: 'Lanche', emoji: '\u{1F34E}' },
]

interface Props {
  date: string
  visible: boolean
  onClose: () => void
  onSave: (meal: Omit<Meal, 'id' | 'created_at'>) => void
}

export function MealForm({ date, visible, onClose, onSave }: Props) {
  const [mealType, setMealType] = useState<MealType>('almoco')
  const [description, setDescription] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [nutrition, setNutrition] = useState<ClaudeNutrition | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setDescription('')
    setImageUri(null)
    setNutrition(null)
    setMealType('almoco')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })
    if (!result.canceled) {
      setImageUri(result.assets[0].uri)
      setNutrition(null)
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })
    if (!result.canceled) {
      setImageUri(result.assets[0].uri)
      setNutrition(null)
    }
  }

  const analyzeWithAI = async () => {
    if (!description && !imageUri) {
      Alert.alert('Atenção', 'Descreva a refeição ou adicione uma foto.')
      return
    }
    setAnalyzing(true)
    try {
      const profile = await getProfile()
      const apiKey = profile?.anthropic_api_key ?? ''
      const result = await analyzeMeal(description, imageUri, apiKey)
      setNutrition(result)
    } catch (err: any) {
      Alert.alert('Erro na análise', err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!nutrition) {
      Alert.alert('Atenção', 'Analise a refeição primeiro.')
      return
    }
    setSaving(true)
    try {
      onSave({
        date,
        meal_type: mealType,
        description: description || 'Refeição',
        image_uri: imageUri ?? undefined,
        calories: nutrition.calories,
        protein_g: nutrition.protein_g,
        carbs_g: nutrition.carbs_g,
        fat_g: nutrition.fat_g,
        analyzed_by_ai: true,
      })
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nova Refeição</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Meal type selector */}
          <View>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeRow}>
              {MEAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, mealType === t.value && styles.typeBtnActive]}
                  onPress={() => setMealType(t.value)}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      mealType === t.value && styles.typeLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Image */}
          <View>
            <Text style={styles.label}>Foto (opcional)</Text>
            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
                <Text style={styles.imageBtnText}>📷 Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                <Text style={styles.imageBtnText}>🖼 Galeria</Text>
              </TouchableOpacity>
            </View>
            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setImageUri(null)}
                >
                  <Text style={{ color: colors.danger }}>✕ Remover foto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Description */}
          <View>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: frango grelhado com arroz e salada"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Analyze button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
            onPress={analyzeWithAI}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeBtnText}>🤖 Analisar com Claude</Text>
            )}
          </TouchableOpacity>

          {/* Nutrition result */}
          {nutrition && (
            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionTitle}>Estimativa Claude</Text>
              {nutrition.notes ? (
                <Text style={styles.nutritionNotes}>{nutrition.notes}</Text>
              ) : null}
              <View style={styles.macroGrid}>
                <MacroChip
                  label="Calorias"
                  value={nutrition.calories}
                  unit="kcal"
                  color={colors.primary}
                />
                <MacroChip
                  label="Proteína"
                  value={nutrition.protein_g}
                  unit="g"
                  color={colors.orange}
                />
                <MacroChip
                  label="Carbs"
                  value={nutrition.carbs_g}
                  unit="g"
                  color={colors.blue}
                />
                <MacroChip
                  label="Gordura"
                  value={nutrition.fat_g}
                  unit="g"
                  color={colors.yellow}
                />
              </View>
            </View>
          )}

          {/* Save button */}
          {nutrition && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>✓ Salvar Refeição</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function MacroChip({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <View style={[macroStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[macroStyles.value, { color }]}>
        {Math.round(value)}
        {unit}
      </Text>
      <Text style={macroStyles.label}>{label}</Text>
    </View>
  )
}

const macroStyles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  value: { fontSize: 18, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, marginTop: 2 },
})

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  closeBtn: { color: colors.muted, fontSize: 20, padding: 4 },
  body: { flex: 1, padding: spacing.md },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  typeEmoji: { fontSize: 22 },
  typeLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  typeLabelActive: { color: colors.primary },
  imageRow: { flexDirection: 'row', gap: 8 },
  imageBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  imageBtnText: { color: colors.text, fontSize: 14 },
  imagePreviewContainer: { marginTop: 8, gap: 6 },
  imagePreview: { width: '100%', height: 180, borderRadius: radius.md },
  removeImageBtn: { alignSelf: 'flex-start' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  analyzeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nutritionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    padding: spacing.md,
    gap: 12,
  },
  nutritionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  nutritionNotes: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  macroGrid: { flexDirection: 'row', gap: 8 },
  saveBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
