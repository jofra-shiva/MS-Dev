import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  increment,
  limit,
  getDocs,
  setDoc,
  Unsubscribe
} from '@firebase/firestore';
import { ref, uploadString, getDownloadURL, getStorage } from '@firebase/storage';
import { getFirebaseDb, getFirebaseApp } from './client';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'file';
  readBy: string[];
  createdAt: Date;
  isDeleted?: boolean;
  isEdited?: boolean;
  isSystem?: boolean;
  systemType?: string;
  systemData?: any;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  participantDetails?: Record<string, {
    displayName: string;
    photoURL: string;
    email: string;
  }>;
  name?: string;
  projectId?: string;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: Date;
  };
  unreadCounts?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export const subscribeToUserChats = (
  userId: string,
  callback: (chats: Chat[]) => void
): Unsubscribe => {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        lastMessage: data.lastMessage ? {
          ...data.lastMessage,
          createdAt: data.lastMessage.createdAt?.toDate?.() || new Date()
        } : undefined
      } as Chat;
    }));
  });
};

export const subscribeToChatMessages = (
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe => {
  const db = getFirebaseDb();
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.() || new Date()
      } as ChatMessage;
    }));
  });
};

export const sendMessage = async (
  chatId: string, 
  senderId: string, 
  text: string, 
  mediaUrl?: string, 
  mediaType?: 'image' | 'audio' | 'file'
) => {
  const db = getFirebaseDb();
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  await addDoc(messagesRef, {
    chatId,
    senderId,
    text,
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(mediaType ? { mediaType } : {}),
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });

  // Update the parent chat document with the last message and increment unread counts
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (chatSnap.exists()) {
    const chatData = chatSnap.data() as Chat;
    const updates: Record<string, any> = {
      lastMessage: {
        text: text.trim(),
        senderId,
        createdAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    };
    
    // Increment unread count for everyone except the sender
    chatData.participants.forEach(p => {
      if (p !== senderId) {
        updates[`unreadCounts.${p}`] = increment(1);
      }
    });

    await updateDoc(chatRef, updates);
  }
};

export const markChatAsRead = async (chatId: string, userId: string) => {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadCounts.${userId}`]: 0
  });
};

export const searchUsersByEmail = async (emailQuery: string): Promise<any[]> => {
  if (!emailQuery.trim()) return [];
  const lowerQuery = emailQuery.toLowerCase();
  const db = getFirebaseDb();
  
  const q = query(
    collection(db, 'users'),
    where('email', '>=', lowerQuery),
    where('email', '<=', lowerQuery + '\uf8ff'),
    limit(10)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ uid: d.id, ...d.data() }));
};

export const startDirectChat = async (currentUser: any, targetUser: any) => {
  const db = getFirebaseDb();
  // Check if a direct chat already exists
  const q = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('participants', 'array-contains', currentUser.uid)
  );
  
  const snap = await getDocs(q);
  const existingChat = snap.docs.find((d: any) => {
    const data = d.data() as Chat;
    return data.participants.includes(targetUser.uid);
  });

  if (existingChat) {
    return existingChat.id;
  }

  // Create new chat
  const chatRef = doc(collection(db, 'chats'));
  const newChatData = {
    type: 'direct',
    participants: [currentUser.uid, targetUser.uid],
    participantDetails: {
      [currentUser.uid]: {
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        email: currentUser.email
      },
      [targetUser.uid]: {
        displayName: targetUser.displayName,
        photoURL: targetUser.photoURL,
        email: targetUser.email
      }
    }
  };

  await setDoc(chatRef, {
    ...newChatData,
    id: chatRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return chatRef.id;
};

export const uploadChatMedia = async (chatId: string, base64DataUrl: string, fileName: string): Promise<string> => {
  const app = getFirebaseApp();
  const storage = getStorage(app);
  
  const ext = fileName.split('.').pop();
  const storageFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const fileRef = ref(storage, `chats/${chatId}/${storageFileName}`);
  
  await uploadString(fileRef, base64DataUrl, 'data_url');
  return getDownloadURL(fileRef);
};
