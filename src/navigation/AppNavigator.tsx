// AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import BuyerTabs from './BuyerTabs'
import SellerTabs from './SellerTabs'

export default function AppNavigator() {
  const [userType, setUserType] = useState<'seller' | 'buyer' | null>(null)

  // mock fetching user type
  useEffect(() => {
    // Replace with your auth logic
    const fetchUserType = async () => {
      const type = await getLoggedInUserType() // 'seller' or 'buyer'
      setUserType(type)
    }
    fetchUserType()
  }, [])

  if (!userType) return null // or a loading screen

  return (
    <NavigationContainer>
      {userType === 'seller' ? <SellerTabs /> : <BuyerTabs />}
    </NavigationContainer>
  )
}

// Example placeholder
async function getLoggedInUserType(): Promise<'seller' | 'buyer'> {
  // Replace with Firebase / auth logic
  return 'seller'
}
