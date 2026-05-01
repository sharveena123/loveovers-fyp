// BuyerTabs.tsx
import BuyerChat from "@/app/(buyer)/buychat";
import BuyerHome from "@/app/(buyer)/buyerhome";
import BuyerMap from "@/app/(buyer)/buyermap";
import BuyerOrders from "@/app/(buyer)/buyerorders";
import BuyerProfile from "@/app/(buyer)/buyerprofile";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
    Home,
    MapIcon,
    MessageSquare,
    Package,
    User,
} from "lucide-react-native";
import React from "react";

const Tab = createBottomTabNavigator();

export default function BuyerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={BuyerHome}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={BuyerOrders}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Package color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={BuyerMap}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MapIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={BuyerProfile}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={BuyerChat}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
