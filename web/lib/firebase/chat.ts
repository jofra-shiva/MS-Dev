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
  limit,
  increment
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

export const sendMessage = async (
  chatId: string, 
  senderId: string, 
  text: string, 
  mediaUrl?: string, 
  mediaType?: 'image' | 'audio' | 'file'
) => {
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

export const sendProjectSystemMessage = async (
  projectId: string,
  systemType: 'task_update' | 'task_assignment' | 'meeting_invite',
  text: string,
  systemData: any,
  actorId?: string // Optional: if an actor is responsible, their ID is the senderId so it appears on the right side if it's the current user
) => {
  const chatId = `project_${projectId}`;
  const senderId = actorId || 'system';
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  
  await addDoc(messagesRef, {
    chatId,
    senderId,
    text,
    isSystem: true,
    systemType,
    systemData,
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });

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
    
    chatData.participants.forEach(p => {
      if (p !== senderId) {
        updates[`unreadCounts.${p}`] = increment(1);
      }
    });

    await updateDoc(chatRef, updates);
  }
};

export const markChatAsRead = async (chatId: string, userId: string) => {
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadCounts.${userId}`]: 0
  });
};

import { writeBatch, deleteDoc } from 'firebase/firestore';

export const markMessagesAsRead = async (chatId: string, userId: string, messages: ChatMessage[]) => {
  const unreadMessages = messages.filter(m => !m.readBy?.includes(userId));
  if (unreadMessages.length === 0) return;
  
  const batch = writeBatch(db);
  unreadMessages.slice(0, 500).forEach(m => {
    const ref = doc(db, `chats/${chatId}/messages`, m.id);
    batch.update(ref, {
      readBy: arrayUnion(userId)
    });
  });
  
  await batch.commit();
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  await updateDoc(doc(db, `chats/${chatId}/messages`, messageId), {
    isDeleted: true,
    text: '' // Optional: clear the text to save space and ensure privacy
  });
};

export const editMessage = async (chatId: string, messageId: string, newText: string) => {
  await updateDoc(doc(db, `chats/${chatId}/messages`, messageId), {
    text: newText,
    isEdited: true
  });
};

export const clearChatMessages = async (chatId: string) => {
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  const snapshot = await getDocs(messagesRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
};

import { getStorageInstance } from './config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadChatMedia = async (chatId: string, file: File, type: 'image' | 'audio' | 'file'): Promise<string> => {
  const storage = await getStorageInstance();
  if (!storage) throw new Error('Firebase Storage is not available');
  
  const ext = file.name ? file.name.split('.').pop() : (type === 'audio' ? 'webm' : 'bin');
  const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const fileRef = ref(storage, `chats/${chatId}/${filename}`);
  
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

import { Project } from '@/types';

export const syncProjectGroupChats = async (projects: Project[]) => {
  for (const project of projects) {
    if (!project || !project.id || !project.members) continue;

    const chatId = `project_${project.id}`;
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    
    const memberUids = Object.keys(project.members).filter(uid => project.members[uid] !== null);
    const participantDetails: Record<string, any> = {};
    for (const uid of memberUids) {
      const m = project.members[uid];
      participantDetails[uid] = {
        displayName: m.displayName,
        photoURL: m.photoURL,
        email: m.email
      };
    }

    if (!snap.exists()) {
      await setDoc(chatRef, {
        id: chatId,
        type: 'group',
        projectId: project.id,
        name: `${project.name} Team`,
        participants: memberUids,
        participantDetails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      const chatData = snap.data() as Chat;
      const newParticipants = Array.from(new Set([...(chatData.participants || []), ...memberUids]));
      
      await updateDoc(chatRef, {
        participants: newParticipants,
        participantDetails: { ...(chatData.participantDetails || {}), ...participantDetails },
        name: `${project.name} Team`
      });
    }
  }
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

// ─── Meeting Tracking ───────────────────────────────────────────────────────

/**
 * Called when a user clicks "Join Meeting" in the chat.
 * Adds them to the joinedBy array inside the meeting_invite system message.
 */
export const recordMeetingJoin = async (
  chatId: string,
  messageId: string,
  user: { uid: string; displayName: string; photoURL: string }
) => {
  const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const existing: any[] = data.systemData?.joinedBy || [];

  // Don't add duplicates
  if (existing.some((j: any) => j.uid === user.uid)) return;

  const joinEntry = {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL || '',
    joinedAt: new Date().toISOString(),
  };

  await updateDoc(msgRef, {
    'systemData.joinedBy': arrayUnion(joinEntry),
    // Record startedAt on the first join
    ...(!data.systemData?.startedAt ? { 'systemData.startedAt': new Date().toISOString() } : {}),
  });

  // Also update the meeting document in the projects collection if meetingId exists
  if (data.systemData?.meetingId) {
    const meetingRef = doc(db, `projects/${chatId.replace('project_', '')}/meetings`, data.systemData.meetingId);
    try {
      await updateDoc(meetingRef, {
        joinedBy: arrayUnion(joinEntry.uid)
      });
    } catch (err) {
      console.warn("Could not update meeting doc joinedBy (maybe it doesn't exist)", err);
    }
  }
};

/**
 * Called when the meeting host clicks "End Meeting".
 * Records the end time so we can calculate duration.
 */
export const endMeeting = async (chatId: string, messageId: string) => {
  const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
  await updateDoc(msgRef, {
    'systemData.endedAt': new Date().toISOString(),
  });
};

// ─── User Search ─────────────────────────────────────────────────────────────

export const searchUsersByEmail = async (emailQuery: string): Promise<any[]> => {
  if (!emailQuery.trim()) return [];
  
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
