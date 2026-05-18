import { AddBagModal } from "@/src/components/dashboard/AddBagModal";
import { AddItemModal } from "@/src/components/dashboard/AddItemModal";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { colors, spacing } from "@/src/theme/styles";
import { Package, ShoppingBag } from "lucide-react-native";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface SellerAddMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function SellerAddMenu({ visible, onClose }: SellerAddMenuProps) {
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddBagModal, setShowAddBagModal] = useState(false);
  const sellerId = auth.currentUser?.uid;

  const handleAddItem = () => {
    onClose();
    setShowAddItemModal(true);
  };

  const handleAddBag = () => {
    onClose();
    setShowAddBagModal(true);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View style={styles.menuContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.menuButtons}>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={handleAddItem}
                  activeOpacity={0.85}
                >
                  <View style={styles.menuIconWrap}>
                    <Package size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuButtonText}>Add Item</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={handleAddBag}
                  activeOpacity={0.85}
                >
                  <View style={styles.menuIconWrap}>
                    <ShoppingBag size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuButtonText}>Mystery Bag</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {sellerId && (
        <>
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            sellerId={sellerId}
          />
          <AddBagModal
            open={showAddBagModal}
            onOpenChange={setShowAddBagModal}
            sellerId={sellerId}
            onSuccess={() => setShowAddBagModal(false)}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    alignItems: "center",
    paddingBottom: 100,
  },
  menuButtons: {
    gap: spacing.sm,
    alignItems: "center",
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 28,
    minWidth: 200,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
});
