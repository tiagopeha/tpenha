import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { initDB } from '@/lib/database'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    initDB()
      .catch(console.error)
      .finally(() => SplashScreen.hideAsync())
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}
