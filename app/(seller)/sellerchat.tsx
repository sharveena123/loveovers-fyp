import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  Conversation,
  getConversations,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, MessageSquare } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export default function SellerChat() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<
    (Conversation & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const chats = await getConversations(user.uid, "seller");
      setConversations(chats);
    } catch (error) {
      console.error("Error loading conversations:", error);
      Alert.alert("Error", "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadConversations();
      }
    }, [user, loadConversations]),
  );

  const handleOpenChat = (conversationId: string) => {
    router.push({
      pathname: "/(seller)/chat/[id]",
      params: { id: conversationId },
    });
  };

  const handleReportIssue = () => {
    router.push("/(seller)/support");
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MessageSquare size={64} color={colors.textSoft} />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Start chatting with buyers about their orders
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.conversationCard}
              onPress={() => handleOpenChat(item.id)}
            >
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.buyerName}>{item.buyerName}</Text>
                  {item.buyerUnreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {item.buyerUnreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.lastMessage} numberOfLines={2}>
                  {item.lastMessage || "No messages yet"}
                </Text>
                <Text style={styles.timestamp}>
                  {item.lastMessageTime
                    ? new Date(
                        typeof item.lastMessageTime === "object" &&
                          "seconds" in item.lastMessageTime
                          ? item.lastMessageTime.seconds * 1000
                          : item.lastMessageTime instanceof Date
                            ? item.lastMessageTime
                            : Date.now(),
                      ).toLocaleDateString()
                    : ""}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity
        style={styles.supportButton}
        onPress={handleReportIssue}
      >
        <AlertCircle size={20} color={colors.white} />
        <Text style={styles.supportButtonText}>Report Issue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  conversationCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationContent: {
    gap: spacing.sm,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buyerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginLeft: spacing.md,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  lastMessage: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textSoft,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  supportButton: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  supportButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
