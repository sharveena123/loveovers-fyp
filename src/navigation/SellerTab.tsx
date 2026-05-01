// SellerTabs.tsx
import OwnerDashboard from "@/app/(seller)/dashboard";
import OrdersScreen from "@/app/(seller)/orders";
import ProfileScreen from "@/app/(seller)/profile";
import SellerChat from "@/app/(seller)/sellerchat";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Home,
  MessageSquare,
  Package,
  User
} from "lucide-react-native";
import React from "react";

const Tab = createBottomTabNavigator();

export default function SellerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={OwnerDashboard}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Package color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={SellerChat}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
