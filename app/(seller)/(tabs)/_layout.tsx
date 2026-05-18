import { SellerAddMenu } from "@/src/components/seller/SellerAddMenu";
import { colors } from "@/src/theme/styles";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import {
  Home,
  MessageSquare,
  Package,
  Plus,
  User,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

function PlusTabButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      style={styles.plusTabWrapper}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? "Close add menu" : "Add item or mystery bag"}
    >
      <View style={[styles.plusCircle, isOpen && styles.plusCircleOpen]}>
        {isOpen ? (
          <X color={colors.white} size={26} strokeWidth={2.5} />
        ) : (
          <Plus color={colors.white} size={28} strokeWidth={2.5} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
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
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => (
              <Package color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarLabel: () => null,
            tabBarIcon: () => null,
            tabBarButton: (_props: BottomTabBarButtonProps) => (
              <PlusTabButton
                isOpen={menuOpen}
                onToggle={() => setMenuOpen((open) => !open)}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="sellerchat"
          options={{
            title: "Chat",
            tabBarIcon: ({ color, size }) => (
              <MessageSquare color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>

      <SellerAddMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  plusTabWrapper: {
    top: -18,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 4,
    borderColor: "#fff",
  },
  plusCircleOpen: {
    backgroundColor: "#5a3200",
  },
});
