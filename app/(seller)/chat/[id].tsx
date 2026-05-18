import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    getConversation,
    Message,
    QUICK_MESSAGES,
    sendMessage,
    subscribeToMessages,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    SafeAreaView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function SellerChatDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
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
        if (isMounted) {
          setConversation(conv);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConversation();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Subscribe to messages in real-time
    const unsubscribe = subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  const handleSendMessage = async (text: string, isQuick: boolean = false) => {
    if (!text.trim() || !user || !id) {
    }

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

      // Scroll to bottom
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
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/(seller)/(tabs)/sellerchat")}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.backButton} />
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text>Please log in to chat</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherUserName = conversation?.buyerName || "Buyer";
  const quickMsgs = QUICK_MESSAGES.seller;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/(seller)/(tabs)/sellerchat")}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
          <View style={styles.backButton} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          renderItem={({ item }) => {
            const isOwnMessage = item.senderId === user?.uid;
            return (
              <View
                style={[
                  styles.messageRow,
                  isOwnMessage && styles.ownMessageRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isOwnMessage && styles.ownMessageBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isOwnMessage && styles.ownMessageText,
                    ]}
                  >
                    {item.text}
                  </Text>
                  {item.isQuickMessage && (
                    <Text
                      style={[
                        styles.quickBadge,
                        isOwnMessage && styles.ownQuickBadge,
                      ]}
                    >
                      Quick message
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.timestamp,
                      isOwnMessage && styles.ownTimestamp,
                    ]}
                  >
                    {new Date(
                      typeof item.createdAt === "object" &&
                        "seconds" in item.createdAt
                        ? item.createdAt.seconds * 1000
                        : item.createdAt instanceof Date
                          ? item.createdAt.getTime()
                          : item.createdAt,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          scrollEnabled
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Quick Messages */}
        {showQuickMessages && (
          <View style={styles.quickMessagesContainer}>
            <FlatList
              data={quickMsgs}
              keyExtractor={(item, idx) => `quick-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.quickMessageButton}
                  onPress={() => handleSendMessage(item, true)}
                >
                  <Text style={styles.quickMessageText}>{item}</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Input Footer */}
        <View style={styles.inputFooter}>
          <TouchableOpacity
            onPress={() => setShowQuickMessages(!showQuickMessages)}
            style={styles.quickMessageToggle}
          >
            <Text style={styles.quickMessageToggleText}>
              {showQuickMessages ? "✕" : "⚡"}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            placeholderTextColor={colors.textSoft}
            multiline
          />

          <TouchableOpacity
            onPress={() => handleSendMessage(messageText)}
            disabled={!messageText.trim() || sending}
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            <Send
              size={20}
              color={messageText.trim() ? colors.white : colors.textSoft}
            />
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
  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    flex: 1,
    textAlign: "center",
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  messageRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: spacing.md,
    alignItems: "flex-end",
  },
  ownMessageRow: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "70%",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  messageText: {
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.white,
  },
  quickBadge: {
    fontSize: 10,
    color: colors.textSoft,
    fontStyle: "italic",
  },
  ownQuickBadge: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  timestamp: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 2,
  },
  ownTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  quickMessagesContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxHeight: 200,
  },
  quickMessageButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickMessageText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
  },
  inputFooter: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  quickMessageToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  quickMessageToggleText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
