"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadChatMedia = exports.startDirectChat = exports.searchUsersByEmail = exports.markChatAsRead = exports.sendMessage = exports.subscribeToChatMessages = exports.subscribeToUserChats = void 0;
const firestore_1 = require("@firebase/firestore");
const storage_1 = require("@firebase/storage");
const client_1 = require("./client");
const subscribeToUserChats = (userId, callback) => {
    const db = (0, client_1.getFirebaseDb)();
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'chats'), (0, firestore_1.where)('participants', 'array-contains', userId), (0, firestore_1.orderBy)('updatedAt', 'desc'));
    return (0, firestore_1.onSnapshot)(q, (snap) => {
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
            };
        }));
    });
};
exports.subscribeToUserChats = subscribeToUserChats;
const subscribeToChatMessages = (chatId, callback) => {
    const db = (0, client_1.getFirebaseDb)();
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, `chats/${chatId}/messages`), (0, firestore_1.orderBy)('createdAt', 'asc'));
    return (0, firestore_1.onSnapshot)(q, (snap) => {
        callback(snap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                id: d.id,
                createdAt: data.createdAt?.toDate?.() || new Date()
            };
        }));
    });
};
exports.subscribeToChatMessages = subscribeToChatMessages;
const sendMessage = async (chatId, senderId, text, mediaUrl, mediaType) => {
    const db = (0, client_1.getFirebaseDb)();
    const messagesRef = (0, firestore_1.collection)(db, `chats/${chatId}/messages`);
    await (0, firestore_1.addDoc)(messagesRef, {
        chatId,
        senderId,
        text,
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(mediaType ? { mediaType } : {}),
        readBy: [senderId],
        createdAt: (0, firestore_1.serverTimestamp)(),
    });
    // Update the parent chat document with the last message and increment unread counts
    const chatRef = (0, firestore_1.doc)(db, 'chats', chatId);
    const chatSnap = await (0, firestore_1.getDoc)(chatRef);
    if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const updates = {
            lastMessage: {
                text: text.trim(),
                senderId,
                createdAt: (0, firestore_1.serverTimestamp)()
            },
            updatedAt: (0, firestore_1.serverTimestamp)()
        };
        // Increment unread count for everyone except the sender
        chatData.participants.forEach(p => {
            if (p !== senderId) {
                updates[`unreadCounts.${p}`] = (0, firestore_1.increment)(1);
            }
        });
        await (0, firestore_1.updateDoc)(chatRef, updates);
    }
};
exports.sendMessage = sendMessage;
const markChatAsRead = async (chatId, userId) => {
    const db = (0, client_1.getFirebaseDb)();
    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(db, 'chats', chatId), {
        [`unreadCounts.${userId}`]: 0
    });
};
exports.markChatAsRead = markChatAsRead;
const searchUsersByEmail = async (emailQuery) => {
    if (!emailQuery.trim())
        return [];
    const lowerQuery = emailQuery.toLowerCase();
    const db = (0, client_1.getFirebaseDb)();
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'users'), (0, firestore_1.where)('email', '>=', lowerQuery), (0, firestore_1.where)('email', '<=', lowerQuery + '\uf8ff'), (0, firestore_1.limit)(10));
    const snap = await (0, firestore_1.getDocs)(q);
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};
exports.searchUsersByEmail = searchUsersByEmail;
const startDirectChat = async (currentUser, targetUser) => {
    const db = (0, client_1.getFirebaseDb)();
    // Check if a direct chat already exists
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'chats'), (0, firestore_1.where)('type', '==', 'direct'), (0, firestore_1.where)('participants', 'array-contains', currentUser.uid));
    const snap = await (0, firestore_1.getDocs)(q);
    const existingChat = snap.docs.find((d) => {
        const data = d.data();
        return data.participants.includes(targetUser.uid);
    });
    if (existingChat) {
        return existingChat.id;
    }
    // Create new chat
    const chatRef = (0, firestore_1.doc)((0, firestore_1.collection)(db, 'chats'));
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
    await (0, firestore_1.setDoc)(chatRef, {
        ...newChatData,
        id: chatRef.id,
        createdAt: (0, firestore_1.serverTimestamp)(),
        updatedAt: (0, firestore_1.serverTimestamp)()
    });
    return chatRef.id;
};
exports.startDirectChat = startDirectChat;
const uploadChatMedia = async (chatId, base64DataUrl, fileName) => {
    const app = (0, client_1.getFirebaseApp)();
    const storage = (0, storage_1.getStorage)(app);
    const ext = fileName.split('.').pop();
    const storageFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const fileRef = (0, storage_1.ref)(storage, `chats/${chatId}/${storageFileName}`);
    await (0, storage_1.uploadString)(fileRef, base64DataUrl, 'data_url');
    return (0, storage_1.getDownloadURL)(fileRef);
};
exports.uploadChatMedia = uploadChatMedia;
//# sourceMappingURL=chatService.js.map