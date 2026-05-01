import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  createIssue,
  getUserIssues,
  Issue,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ISSUE_TYPES = [
  { label: "Payment Issue", value: "payment" },
  { label: "Delivery Problem", value: "delivery" },
  { label: "Product Issue", value: "product" },
  { label: "Seller Issue", value: "seller" },
  { label: "Buyer Complaint", value: "buyer" },
  { label: "Other", value: "other" },
];

export default function SellerSupport() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [issues, setIssues] = useState<(Issue & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    issueType: "other",
    subject: "",
    description: "",
  });

  const loadIssues = useCallback(async () => {
    if (!user) {
      setIssues([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userIssues = await getUserIssues(user.uid);
      setIssues(userIssues);
    } catch (error) {
      console.error("Error loading issues:", error);
      Alert.alert("Error", "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadIssues();
      }
    }, [user, loadIssues]),
  );

  const handleCreateIssue = async () => {
    if (!formData.subject.trim() || !formData.description.trim()) {
      Alert.alert("Required", "Please fill in all fields");
      return;
    }

    if (!user) return;

    try {
      await createIssue(
        user.uid,
        user.displayName || "Seller",
        "seller",
        user.email || "",
        formData.issueType,
        formData.subject,
        formData.description,
      );

      Alert.alert(
        "Success",
        "Issue reported successfully. We'll get back to you soon.",
      );
      setFormData({ issueType: "other", subject: "", description: "" });
      setShowCreateModal(false);
      loadIssues();
    } catch (error) {
      console.error("Error creating issue:", error);
      Alert.alert("Error", "Failed to create issue");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return colors.primary;
      case "in_progress":
        return "#FF9800";
      case "resolved":
        return "#4CAF50";
      case "closed":
        return colors.textSoft;
      default:
        return colors.textSoft;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle size={16} color={getStatusColor(status)} />;
      case "in_progress":
        return <Clock size={16} color={getStatusColor(status)} />;
      case "resolved":
      case "closed":
        return <CheckCircle size={16} color={getStatusColor(status)} />;
      default:
        return null;
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
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support</Text>
          <View style={styles.backButton} />
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={issues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.issueCard}>
            <View style={styles.issueHeader}>
              <View style={styles.statusBadge}>
                {getStatusIcon(item.status)}
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
              <Text style={styles.issueType}>{item.issueType}</Text>
            </View>
            <Text style={styles.issueSubject} numberOfLines={2}>
              {item.subject}
            </Text>
            <Text style={styles.issueDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.issueDate}>
              {new Date(
                typeof item.createdAt === "object" &&
                  "seconds" in item.createdAt
                  ? item.createdAt.seconds * 1000
                  : item.createdAt instanceof Date
                    ? item.createdAt
                    : Date.now(),
              ).toLocaleDateString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <AlertCircle size={64} color={colors.textSoft} />
            </View>
            <Text style={styles.emptyTitle}>No issues reported</Text>
            <Text style={styles.emptyText}>
              If you encounter any problems, please report them here
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        scrollEnabled
      />

      {/* Create Issue Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <TouchableOpacity onPress={handleCreateIssue}>
              <Text style={styles.modalSubmitText}>Send</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Issue Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeButtonsContainer}>
                  {ISSUE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        formData.issueType === type.value &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, issueType: type.value })
                      }
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.issueType === type.value &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief description of the issue"
                value={formData.subject}
                onChangeText={(text) =>
                  setFormData({ ...formData, subject: text })
                }
                placeholderTextColor={colors.textSoft}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Provide detailed information about the issue"
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholderTextColor={colors.textSoft}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formInfo}>
              <AlertCircle size={16} color={colors.primary} />
              <Text style={styles.formInfoText}>
                Our support team will review your issue and respond within 24
                hours
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  issueCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  issueType: {
    fontSize: 11,
    color: colors.textSoft,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  issueSubject: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  issueDescription: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
  },
  issueDate: {
    fontSize: 11,
    color: colors.textSoft,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 300,
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
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseText: {
    fontSize: 24,
    color: colors.textSoft,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  formGroup: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  typeButtonsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  typeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  descriptionInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  formInfo: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  formInfoText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "500",
  },
});
