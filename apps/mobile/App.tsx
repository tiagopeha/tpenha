import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

// Placeholder de scaffold — a UI de marcação vem depois, começando pela tela
// de marcação ao vivo (docs/spec-mvp.md).
export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Projeto Diamante — em construção</Text>
      <StatusBar style="auto" />
    </View>
  );
}
