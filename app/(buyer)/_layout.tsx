import { auth } from "@/src/services/firebase/config";
import { colors } from "@/src/theme/styles";
import { router, Tabs } from "expo-router";
import {
  Home,
  MapPin,
  MessageSquare,
  Package,
  User,
} from "lucide-react-native";
import { useEffect } from "react";

export default function BuyerLayout() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/(auth)/login");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 5,
          backgroundColor: "#fff",
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="buyerhome"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="buyercart"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Package color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="buyermap"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="buyerprofile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="buychat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="buyerorders"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="itemdetail/[id]"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="mysterydetail/[id]"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="buyereditprofile"
        options={{
          href: null,
          title: "",
        }}
      />
      <Tabs.Screen
        name="buyerpreferences"
        options={{
          href: null,
          title: "",
        }}
      />
    </Tabs>
  );
}
