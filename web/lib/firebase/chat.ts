import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  Unsubscribe,
  limit
} from 'firebase/firestore';
import { db } from './config';
import { Chat, ChatMessage, MSDEVUser } from '@/types';

// ============================================================
// CHAT - Firebase Helpers
// ============================================================

export const startDirectChat = async (currentUser: MSDEVUser, targetUser: { uid: string, displayName: string, photoURL: string, email: string }) => {
  // Check if a direct chat already exists between these two users
  const q = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('participants', 'array-contains', currentUser.uid)
  );
  
  const snap = await getDocs(q);
  const existingChat = snap.docs.find(d => {
    const data = d.data() as Chat;
    return data.participants.includes(targetUser.uid);
  });

  if (existingChat) {
    return existingChat.id;
  }

  // Create new chat
  const chatRef = doc(collection(db, 'chats'));
  const newChatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'> = {
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

export const sendMessage = async (chatId: string, senderId: string, text: string) => {
  if (!text.trim()) return;

  const messagesRef = collection(db, `chats/${chatId}/messages`);
  
  // Add the message
  await addDoc(messagesRef, {
    chatId,
    senderId,
    text: text.trim(),
    readBy: [senderId],
    createdAt: serverTimestamp()
  });

  // Update the parent chat document with the last message
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: {
      text: text.trim(),
      senderId,
      createdAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  });
};

export const subscribeToUserChats = (
  userId: string,
  callback: (chats: Chat[]) => void
): Unsubscribe => {
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

export const searchUsersByEmail = async (emailQuery: string): Promise<any[]> => {
  if (!emailQuery.trim()) return [];
  
  // Basic substring search is hard in Firestore, so we do a prefix search or fetch all and filter if small.
  // Assuming a smallish user base for now, or just prefix search on email.
  const lowerQuery = emailQuery.toLowerCase();
  
  const q = query(
    collection(db, 'users'),
    where('email', '>=', lowerQuery),
    where('email', '<=', lowerQuery + '\uf8ff'),
    limit(10)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
};
