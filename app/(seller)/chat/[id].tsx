import { Text, TextInput } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  getConversation,
  markConversationAsRead,
  Message,
  QUICK_MESSAGES,
  resolveBuyerDisplayName,
  sendMessage,
  subscribeToMessages,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { goBackToReturn, SELLER_ROUTES } from "@/src/utils/navigation";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send, Zap } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
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

export default function SellerChatDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const returnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;

  const handleBack = () =>
    goBackToReturn(router, returnTo, SELLER_ROUTES.chat);
  const { user, loading: authLoading } = useAuth();
  const [conversation, setConversation] = useState<{
    buyerName?: string;
    orderId?: string;
  } | null>(null);
  const [messages, setMessages] = useState<(Message & { id: string })[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadConversation = async () => {
      try {
        const conv = await getConversation(id);
        if (isMounted && conv) {
          const buyerName = await resolveBuyerDisplayName(
            conv.buyerId,
            conv.buyerName,
          );
          setConversation({ ...conv, buyerName });
          setLoading(false);
        } else if (isMounted) {
          setConversation(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        if (isMounted) setLoading(false);
      }
    };

    loadConversation();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToMessages(id, setMessages);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  const clearUnread = useCallback(async () => {
    if (!id || !user) return;
    try {
      await markConversationAsRead(id, "seller");
    } catch (error) {
      console.error("Error clearing unread count:", error);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      clearUnread();
    }, [clearUnread]),
  );

  useEffect(() => {
    if (!id || !user) return;
    const hasUnreadFromBuyer = messages.some(
      (m) => m.sendersRole === "buyer" && m.read !== true,
    );
    if (hasUnreadFromBuyer) {
      clearUnread();
    }
  }, [id, user, messages, clearUnread]);

  const handleSendMessage = async (text: string, isQuick = false) => {
    if (!text.trim() || !user || !id) return;

    try {
      setSending(true);
      await sendMessage(
        id,
        user.uid,
        user.displayName || "Seller",
        "seller",
        text,
        isQuick,
      );
      setMessageText("");
      setShowQuickMessages(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.loginPrompt}>Please log in to chat</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherUserName = conversation?.buyerName || "Customer";
  const quickMsgs = QUICK_MESSAGES.seller;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {getInitials(otherUserName)}
              </Text>
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {otherUserName}
              </Text>
              {conversation?.orderId ? (
                <Text style={styles.headerOrder}>
                  Order #{conversation.orderId.slice(-6)}
                </Text>
              ) : (
                <Text style={styles.headerOrder}>Customer chat</Text>
              )}
            </View>
          </View>
          <View style={styles.backButton} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          renderItem={({ item }) => {
            const isOwn = item.senderId === user.uid;
            return (
              <View
                style={[styles.messageRow, isOwn && styles.messageRowOwn]}
              >
                {!isOwn ? (
                  <Text style={styles.senderLabel}>{otherUserName}</Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    isOwn ? styles.bubbleOwn : styles.bubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isOwn && styles.messageTextOwn,
                    ]}
                  >
                    {item.text}
                  </Text>
                  {item.isQuickMessage && (
                    <View
                      style={[
                        styles.quickTag,
                        isOwn && styles.quickTagOwn,
                      ]}
                    >
                      <Zap size={10} color={isOwn ? colors.white : colors.primary} />
                      <Text
                        style={[
                          styles.quickTagText,
                          isOwn && styles.quickTagTextOwn,
                        ]}
                      >
                        Quick reply
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.msgTime,
                      isOwn && styles.msgTimeOwn,
                    ]}
                  >
                    {new Date(
                      typeof item.createdAt === "object" &&
                        "seconds" in item.createdAt
                        ? item.createdAt.seconds * 1000
                        : item.createdAt instanceof Date
                          ? item.createdAt.getTime()
                          : Date.now(),
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.messagesListEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.noMessages}>
              <Text style={styles.noMessagesTitle}>Start the conversation</Text>
              <Text style={styles.noMessagesText}>
                Send a message or use a quick reply below
              </Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Quick replies */}
        {showQuickMessages && (
          <View style={styles.quickPanel}>
            <Text style={styles.quickPanelTitle}>Quick replies</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickScroll}
            >
              {quickMsgs.map((msg, idx) => (
                <TouchableOpacity
                  key={`quick-${idx}`}
                  style={styles.quickChip}
                  onPress={() => handleSendMessage(msg, true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickChipText}>{msg}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            onPress={() => setShowQuickMessages(!showQuickMessages)}
            style={[
              styles.quickToggle,
              showQuickMessages && styles.quickToggleActive,
            ]}
          >
            <Zap
              size={18}
              color={showQuickMessages ? colors.white : colors.primary}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            value={messageText}
            onChangeText={setMessageText}
            placeholderTextColor={colors.textSoft}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            onPress={() => handleSendMessage(messageText)}
            disabled={!messageText.trim() || sending}
            style={[
              styles.sendBtn,
              (!messageText.trim() || sending) && styles.sendBtnDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Send size={18} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loginPrompt: {
    fontSize: 15,
    color: colors.textSoft,
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
  },
  headerOrder: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  messagesListEmpty: {
    justifyContent: "center",
  },
  messageRow: {
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    maxWidth: "85%",
  },
  messageRowOwn: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSoft,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: colors.white,
  },
  quickTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickTagOwn: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  quickTagText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
  },
  quickTagTextOwn: {
    color: "rgba(255,255,255,0.9)",
  },
  msgTime: {
    fontSize: 10,
    color: colors.textSoft,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  msgTimeOwn: {
    color: "rgba(255,255,255,0.65)",
  },
  noMessages: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  noMessagesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  noMessagesText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
  },
  quickPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  quickPanelTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.1)",
    maxWidth: 260,
  },
  quickChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickToggle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickToggleActive: {
    backgroundColor: colors.primary,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
