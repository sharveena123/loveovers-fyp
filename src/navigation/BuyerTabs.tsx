// BuyerTabs.tsx
import BuyerCart from '@/app/(buyer)/buyercart'
import BuyerHome from '@/app/(buyer)/buyerhome'
import BuyerProfile from '@/app/(buyer)/buyerprofile'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Home, ShoppingCart, User } from 'lucide-react-native'
import React from 'react'

const Tab = createBottomTabNavigator()

export default function BuyerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={BuyerHome} options={{
        tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
      }} />
      <Tab.Screen name="Cart" component={BuyerCart} options={{
        tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
      }} />
      <Tab.Screen name="Profile" component={BuyerProfile} options={{
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />
      }} />
    </Tab.Navigator>
  )
}
