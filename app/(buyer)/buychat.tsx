import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  Conversation,
  getConversations,
  markConversationAsRead,
  repairConversationUnreadCounts,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { BUYER_ROUTES, pushWithReturn } from "@/src/utils/navigation";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronRight,
  Headphones,
  MessageSquare,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function toDate(time: Conversation["lastMessageTime"]): Date | null {
  if (!time) return null;
  if (typeof time === "object" && "seconds" in time) {
    return new Date(time.seconds * 1000);
  }
  if (time instanceof Date) return time;
  return null;
}

function formatMessageTime(time: Conversation["lastMessageTime"]) {
  const date = toDate(time);
  if (!date) return "";

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 172_800_000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationCard({
  item,
  onPress,
}: {
  item: Conversation & { id: string };
  onPress: () => void;
}) {
  const unread = item.buyerUnreadCount > 0;
  const isOwnLast =
    item.lastMessageSenderId && item.lastMessageSenderId === item.buyerId;

  return (
    <TouchableOpacity
      style={[styles.conversationCard, unread && styles.conversationCardUnread]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, unread && styles.avatarUnread]}>
          <Text style={[styles.avatarText, unread && styles.avatarTextUnread]}>
            {getInitials(item.sellerName)}
          </Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.conversationBody}>
        <View style={styles.conversationTop}>
          <Text
            style={[styles.sellerName, unread && styles.sellerNameUnread]}
            numberOfLines={1}
          >
            {item.sellerName}
          </Text>
          <Text style={[styles.timestamp, unread && styles.timestampUnread]}>
            {formatMessageTime(item.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.messagePreviewRow}>
          <Text
            style={[styles.lastMessage, unread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {isOwnLast ? "You: " : ""}
            {item.lastMessage || "No messages yet"}
          </Text>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.buyerUnreadCount > 9 ? "9+" : item.buyerUnreadCount}
              </Text>
            </View>
          )}
        </View>

        {item.orderId ? (
          <Text style={styles.orderTag}>Order #{item.orderId.slice(-6)}</Text>
        ) : null}
      </View>

      <ChevronRight size={18} color={colors.textSoft} style={styles.chevron} />
    </TouchableOpacity>
  );
}

export default function BuyerChat() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<
    (Conversation & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const chats = await getConversations(user.uid, "buyer");
      const withUnread = chats.filter((c) => (c.buyerUnreadCount || 0) > 0);
      if (withUnread.length > 0) {
        await Promise.all(
          withUnread.map((c) => repairConversationUnreadCounts(c.id)),
        );
        const refreshed = await getConversations(user.uid, "buyer");
        setConversations(refreshed);
      } else {
        setConversations(chats);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      Alert.alert("Error", "Failed to load conversations");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setLoading(true);
        loadConversations().finally(() => setLoading(false));
      }
    }, [user, loadConversations]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  const handleOpenChat = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, buyerUnreadCount: 0 } : c,
      ),
    );
    markConversationAsRead(conversationId, "buyer").catch((error) => {
      console.error("Error clearing unread on open:", error);
    });
    pushWithReturn(
      router,
      "/(buyer)/chat/[id]",
      BUYER_ROUTES.chat,
      { id: conversationId },
    );
  };

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.buyerUnreadCount || 0),
    0,
  );

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading messages…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerDecor} />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MessageSquare size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>
            Sign in to chat with sellers about your orders
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.primaryButtonText}>Go to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerContent}>
          <View style={styles.greetingRow}>
            <Sparkles size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.greeting}>Inbox</Text>
          </View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length} conversation
            {conversations.length !== 1 ? "s" : ""}
            {totalUnread > 0 ? ` · ${totalUnread} unread` : ""}
          </Text>
        </View>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MessageSquare size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Message a seller from an item page to ask about pickup times or
            what&apos;s in a mystery bag.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/(buyer)/buyerhome")}
          >
            <Text style={styles.primaryButtonText}>Browse deals</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              onPress={() => handleOpenChat(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.supportCard}
          onPress={() =>
            pushWithReturn(router, "/(buyer)/support", BUYER_ROUTES.chat)
          }
          activeOpacity={0.88}
        >
          <View style={styles.supportIconWrap}>
            <Headphones size={20} color={colors.primary} />
          </View>
          <View style={styles.supportTextWrap}>
            <Text style={styles.supportTitle}>Need help?</Text>
            <Text style={styles.supportSubtitle}>Contact support</Text>
          </View>
          <ChevronRight size={20} color={colors.textSoft} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSoft,
    fontWeight: "500",
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 4,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerContent: { zIndex: 1 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  conversationCardUnread: {
    borderColor: "rgba(106,60,0,0.2)",
    backgroundColor: colors.primarySoft,
  },
  avatarWrap: { position: "relative", marginRight: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarUnread: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  avatarTextUnread: { color: colors.white },
  unreadDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.white,
  },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: spacing.sm,
  },
  sellerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sellerNameUnread: { fontWeight: "800" },
  timestamp: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
  },
  timestampUnread: {
    color: colors.primary,
    fontWeight: "700",
  },
  messagePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.textSoft,
    lineHeight: 19,
  },
  lastMessageUnread: {
    color: colors.text,
    fontWeight: "600",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.white,
  },
  orderTag: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 6,
  },
  chevron: { marginLeft: spacing.xs },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  supportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  supportTextWrap: { flex: 1 },
  supportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  supportSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
});
