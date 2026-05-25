import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

export default function AuthLayout() {
  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="seller-register" />
        <Stack.Screen name="seller-pending" />
        <Stack.Screen name="forgotpassword" />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
})