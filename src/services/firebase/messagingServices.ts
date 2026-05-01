import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  sendersRole: "buyer" | "seller";
  text: string;
  isQuickMessage?: boolean;
  createdAt: Timestamp | Date;
  read: boolean;
}

export interface Conversation {
  id: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  orderId?: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp | Date;
  lastMessageSenderId?: string;
  buyerUnreadCount: number;
  sellerUnreadCount: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Issue {
  id: string;
  userId: string;
  userName: string;
  userRole: "buyer" | "seller";
  userEmail: string;
  orderId?: string;
  issueType: "payment" | "delivery" | "product" | "seller" | "buyer" | "other";
  subject: string;
  description: string;
  attachments?: string[];
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  resolvedAt?: Timestamp | Date;
  resolution?: string;
}

// QUICK MESSAGES
export const QUICK_MESSAGES = {
  buyer: [
    "Is this item still available?",
    "What's the delivery timeline?",
    "Can you provide more details?",
    "Can we negotiate on the price?",
    "When will you be online?",
    "Thank you!",
    "Please confirm the order",
  ],
  seller: [
    "Thank you for your interest!",
    "Item is available and ready to ship",
    "Delivery within 3-5 days",
    "Sure, I can provide more details",
    "I'm available to help",
    "Order confirmed and processing",
    "Shipped! Here's your tracking info",
  ],
};

// ========================
// CONVERSATION FUNCTIONS
// ========================

export const createConversation = async (
  buyerId: string,
  buyerName: string,
  sellerId: string,
  sellerName: string,
  orderId?: string,
): Promise<string> => {
  try {
    // Check if conversation already exists
    const q = query(
      collection(db, "conversations"),
      where("buyerId", "==", buyerId),
      where("sellerId", "==", sellerId),
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // Create new conversation
    const conversation: Conversation = {
      id: "", // Will be set from doc ID
      buyerId,
      buyerName,
      sellerId,
      sellerName,
      ...(orderId && { orderId }),
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "conversations"), conversation);
    return docRef.id;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
};

export const getConversations = async (
  userId: string,
  userRole: "buyer" | "seller",
) => {
  try {
    const field = userRole === "buyer" ? "buyerId" : "sellerId";
    const q = query(
      collection(db, "conversations"),
      where(field, "==", userId),
    );

    const snapshot = await getDocs(q);
    const conversations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      } as Conversation & { id: string };
    });

    // Sort by updatedAt on client side to avoid composite index requirement
    return conversations.sort((a, b) => {
      const aDate =
        a.updatedAt instanceof Date
          ? a.updatedAt.getTime()
          : (a.updatedAt as any).toMillis?.() || 0;
      const bDate =
        b.updatedAt instanceof Date
          ? b.updatedAt.getTime()
          : (b.updatedAt as any).toMillis?.() || 0;
      return bDate - aDate;
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw error;
  }
};

export const getConversation = async (conversationId: string) => {
  try {
    const docRef = doc(db, "conversations", conversationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      ...docSnap.data(),
      id: docSnap.id,
    } as Conversation & { id: string };
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
};

// ========================
// MESSAGE FUNCTIONS
// ========================

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  sendersRole: "buyer" | "seller",
  text: string,
  isQuickMessage: boolean = false,
) => {
  try {
    // Create message
    const message: Message = {
      id: "", // Will be set from doc ID
      conversationId,
      senderId,
      senderName,
      sendersRole,
      text,
      isQuickMessage,
      createdAt: Timestamp.now(),
      read: false,
    };

    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );
    const docRef = await addDoc(messagesRef, message);

    // Update conversation with last message
    const unreadField =
      sendersRole === "buyer" ? "sellerUnreadCount" : "buyerUnreadCount";
    const conversationRef = doc(db, "conversations", conversationId);
    const conv = await getConversation(conversationId);
    const currentUnreadCount = (conv?.[unreadField] || 0) as number;

    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: senderId,
      [unreadField]: currentUnreadCount + 1,
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const getMessages = async (conversationId: string) => {
  try {
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Message & { id: string },
    );
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};

export const markMessagesAsRead = async (
  conversationId: string,
  messageIds: string[],
) => {
  try {
    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );

    for (const messageId of messageIds) {
      const messageDocRef = doc(messagesRef, messageId);
      await updateDoc(messageDocRef, { read: true });
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};

export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: (Message & { id: string })[]) => void,
) => {
  try {
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Message & { id: string },
      );
      callback(messages);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to messages:", error);
    throw error;
  }
};

// ========================
// ISSUE FUNCTIONS
// ========================

export const createIssue = async (
  userId: string,
  userName: string,
  userRole: "buyer" | "seller",
  userEmail: string,
  issueType: string,
  subject: string,
  description: string,
  orderId?: string,
): Promise<string> => {
  try {
    const issue: Issue = {
      id: "",
      userId,
      userName,
      userRole,
      userEmail,
      orderId,
      issueType: issueType as Issue["issueType"],
      subject,
      description,
      status: "open",
      priority: "medium",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "issues"), issue);
    return docRef.id;
  } catch (error) {
    console.error("Error creating issue:", error);
    throw error;
  }
};

export const getUserIssues = async (userId: string) => {
  try {
    const q = query(collection(db, "issues"), where("userId", "==", userId));

    const snapshot = await getDocs(q);
    const issues = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Issue & { id: string },
    );

    // Sort by createdAt on client side to avoid composite index requirement
    return issues.sort((a, b) => {
      const aDate =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : (a.createdAt as any).toMillis?.() || 0;
      const bDate =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : (b.createdAt as any).toMillis?.() || 0;
      return bDate - aDate;
    });
  } catch (error) {
    console.error("Error getting user issues:", error);
    throw error;
  }
};

export const getIssue = async (issueId: string) => {
  try {
    const docRef = doc(db, "issues", issueId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Issue & { id: string };
  } catch (error) {
    console.error("Error getting issue:", error);
    throw error;
  }
};

export const updateIssueStatus = async (
  issueId: string,
  status: "open" | "in_progress" | "resolved" | "closed",
  resolution?: string,
) => {
  try {
    const issueRef = doc(db, "issues", issueId);
    const updateData: any = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = Timestamp.now();
      updateData.resolution = resolution || "";
    }

    await updateDoc(issueRef, updateData);
  } catch (error) {
    console.error("Error updating issue status:", error);
    throw error;
  }
};
