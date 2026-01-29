import { DMSans_400Regular } from '@expo-google-fonts/dm-sans'
import { Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins'
import { Stack } from 'expo-router'
import { useEffect } from 'react'

// Prevent splash screen from auto-hiding

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    DMSans_400Regular,
  })

  useEffect(() => {
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(seller)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="index" />
    </Stack>
  )
}