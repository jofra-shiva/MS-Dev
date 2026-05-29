'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Chat, ChatMessage, Project, Task } from '@/types';
import { 
  subscribeToUserChats, 
  subscribeToChatMessages, 
  sendMessage, 
  startDirectChat, 
  searchUsersByEmail, 
  markChatAsRead, 
  syncProjectGroupChats,
  markMessagesAsRead,
  deleteMessage,
  editMessage,
  clearChatMessages,
  uploadChatMedia,
  recordMeetingJoin,
  endMeeting
} from '@/lib/firebase/chat';
import { subscribeToUserProjects, subscribeToTasks } from '@/lib/firebase/firestore';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { AuraOrb } from '@/components/ui/AuraOrb';
import toast from 'react-hot-toast';
import Link from 'next/link';
import MSLoader from '@/components/ui/MSLoader';

// Helper to format date like WhatsApp
const formatMessageDate = (date: Date) => {
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
};

// Helper to generate dynamic colors from string
const getColorFromName = (name: string) => {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Helper to get up to 2 initials from a name
const getInitials = (name: string) => {
  if (!name) return 'G';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAuraGradient = (name: string) => {
  const hash = Array.from(name || '').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6;
  const gradients = [
    'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', // Blue to Purple
    'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
    'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', // Amber to Orange
    'linear-gradient(135deg, #ec4899 0%, #e11d48 100%)', // Pink to Rose
    'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', // Sky to Blue
    'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // Violet to Fuchsia
  ];
  return gradients[hash];
};

// Helper to parse Task Mentions in text (e.g. TASK-123 or task-123) and @mentions
const renderMessageText = (text: string, projectId?: string, onUserClick?: (name: string) => void) => {
  const regex = /(\[Module:\s*[^\]]+\]|\[Task:\s*[^\]]+\]|(?:#)?TASK-\d+|@[^\s]+)/gi;
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    if (part.startsWith('[Module:')) {
      const moduleName = part.replace('[Module:', '').replace(']', '').trim();
      return <span key={i} style={{ color: '#d946ef', fontWeight: 600, background: 'rgba(217,70,239,0.1)', padding: '2px 6px', borderRadius: 6 }}>🧩 {moduleName}</span>;
    }
    if (part.startsWith('[Task:')) {
      const taskId = part.replace('[Task:', '').replace(']', '').trim();
      const url = projectId ? `/projects/${projectId}/kanban?ticket=${taskId}` : '#';
      return (
        <Link key={i} href={url} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 6 }}>
          📋 {taskId}
        </Link>
      );
    }
    if (part.toUpperCase().startsWith('TASK-') || part.toUpperCase().startsWith('#TASK-')) {
      const url = projectId ? `/projects/${projectId}/kanban?ticket=${part.replace('#', '').toUpperCase()}` : '#';
      return (
        <Link key={i} href={url} style={{ color: '#53bdeb', textDecoration: 'none', fontWeight: 600 }}>
          {part.toUpperCase()}
        </Link>
      );
    }
    if (part.startsWith('@')) {
      const name = part.slice(1);
      return (
        <span 
          key={i} 
          onClick={() => onUserClick?.(name)}
          style={{ color: 'var(--accent)', fontWeight: 600, background: 'rgba(0,168,132,0.1)', padding: '0 4px', borderRadius: 4, cursor: 'pointer' }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

// Regex for parsing reply-format messages stored as "> Replying to Name:\n> quote\n\nmessage"
const REPLY_RE = /^> Replying to ([^:]+):\n> ([^\n]*)\n\n([\s\S]*)$/;
function parseReply(text: string) {
  const m = text.match(REPLY_RE);
  if (!m) return null;
  return { replyName: m[1], quotedText: m[2], actualText: m[3] };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  
  // Advanced features state
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [meetingToEnd, setMeetingToEnd] = useState<string | null>(null);
  
  // Projects sync
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Filter state
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  
  // Search state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Chat List Filtering
  const [chatListQuery, setChatListQuery] = useState('');

  // Message Search
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

  // Media & Recording State
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Media Preview State
  const [selectedMediaPreview, setSelectedMediaPreview] = useState<{file: File, url: string, type: 'image'|'file'} | null>(null);

  // Advanced Mentions
  const [mentionMode, setMentionMode] = useState<'idle' | 'type_select' | 'users' | 'modules' | 'tasks'>('idle');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  // Active Project Data
  const [activeProjectTasks, setActiveProjectTasks] = useState<Task[]>([]);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);

  // Mouse Interactive Animation State
  const [fillAmount, setFillAmount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const visitedChats = useRef<Set<string>>(new Set());
  const [initialLoadFinished, setInitialLoadFinished] = useState(false);

  // Load user projects and sync group chats
  useEffect(() => {
    if (!user) return;
    return subscribeToUserProjects(user.uid, (projs) => {
      setProjects(projs);
      syncProjectGroupChats(projs).catch(console.error);
    });
  }, [user]);

  // Load user chats
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserChats(user.uid, setChats);
    return unsub;
  }, [user]);

  // Handle Active Chat changes
  useEffect(() => {
    if (!activeChat || !user) {
      setMessages([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      setMentionQuery('');
      return;
    }
    
    if ((activeChat.unreadCounts?.[user.uid] || 0) > 0) {
      markChatAsRead(activeChat.id, user.uid).catch(console.error);
    }

    const unsub = subscribeToChatMessages(activeChat.id, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    let unsubTasks: any = null;
    if (activeChat.type === 'group' && activeChat.projectId) {
      unsubTasks = subscribeToTasks(activeChat.projectId, setActiveProjectTasks);
    } else {
      setActiveProjectTasks([]);
    }

    return () => {
      unsub();
      if (unsubTasks) unsubTasks();
    };
  }, [activeChat, user]);

  // Scroll to bottom and mark messages as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    
    if (activeChat && user && messages.length > 0) {
      if ((activeChat.unreadCounts?.[user.uid] || 0) > 0) {
        markChatAsRead(activeChat.id, user.uid).catch(console.error);
      }
      markMessagesAsRead(activeChat.id, user.uid, messages).catch(console.error);
    }
  }, [messages, activeChat, user]);

  // MS Cinematic Loader Timer
  useEffect(() => {
    if (loadingChatId) {
      const timer = setTimeout(() => {
        setLoadingChatId(null);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [loadingChatId]);

  // Initial Landing Page Animation Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadFinished(true);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Mouse Interactive Animation (Landing Page)
  useEffect(() => {
    if (activeChat) return;
    
    let lastX = 0;
    let lastY = 0;
    let lastTime = Date.now();
    let currentFill = 0;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt = Math.max(1, now - lastTime);
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance / dt; 

      currentFill = Math.min(1, currentFill + speed * 0.08);
      
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;
    };

    const loop = () => {
      currentFill = Math.max(0, currentFill - 0.003); // Slow decay
      setFillAmount(currentFill);
      animationFrameId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !user || !messageText.trim()) return;

    let finalMessage = messageText.trim();
    if (replyToMessage) {
      finalMessage = `> Replying to ${activeChat.participantDetails?.[replyToMessage.senderId]?.displayName || 'You'}:\n> ${replyToMessage.text}\n\n${finalMessage}`;
    }

    const currentText = messageText;
    setMessageText('');
    setReplyToMessage(null);

    try {
      if (editingMessage) {
        await editMessage(activeChat.id, editingMessage.id, currentText);
        setEditingMessage(null);
      } else {
        await sendMessage(activeChat.id, user.uid, finalMessage);
      }
    } catch (err: any) {
      toast.error('Failed to send message');
      setMessageText(currentText);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;
    
    const isImage = file.type.startsWith('image/');
    const url = URL.createObjectURL(file);
    setSelectedMediaPreview({ file, url, type: isImage ? 'image' : 'file' });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!activeChat || !user) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setSelectedMediaPreview({ file, url, type: 'image' });
          e.preventDefault();
          break;
        }
      }
    }
  };

  const confirmSendMedia = async () => {
    if (!selectedMediaPreview || !activeChat || !user) return;
    
    setIsUploadingMedia(true);
    const textToSend = messageText.trim() || selectedMediaPreview.file.name;
    const currentPreview = selectedMediaPreview;
    setSelectedMediaPreview(null);
    setMessageText('');
    
    try {
      const url = await uploadChatMedia(activeChat.id, currentPreview.file, currentPreview.type);
      await sendMessage(activeChat.id, user.uid, textToSend, url, currentPreview.type);
    } catch (err: any) {
      toast.error('Failed to upload media');
      console.error(err);
    } finally {
      setIsUploadingMedia(false);
      URL.revokeObjectURL(currentPreview.url);
    }
  };

  const toggleRecording = async () => {
    if (!activeChat || !user) return;

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([audioBlob], 'audio_message.webm', { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop()); // Stop mic usage

          setIsUploadingMedia(true);
          try {
            const url = await uploadChatMedia(activeChat.id, file, 'audio');
            await sendMessage(activeChat.id, user.uid, 'Voice message', url, 'audio');
          } catch (err: any) {
            toast.error('Failed to send audio message');
          } finally {
            setIsUploadingMedia(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        toast.error('Microphone access denied or unavailable');
        console.error(err);
      }
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsersByEmail(searchQuery);
      setSearchResults(results.filter(r => r.uid !== user?.uid));
    } catch (err: any) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleStartChat = async (targetUser: any) => {
    if (!user) return;
    try {
      const chatId = await startDirectChat(
        { uid: user.uid, displayName: user.displayName || '', photoURL: user.photoURL || '', email: user.email || '' } as any,
        targetUser
      );
      
      setIsSearchModalOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      
      const chat = chats.find(c => c.id === chatId);
      if (chat) setActiveChat(chat);
    } catch (err: any) {
      toast.error('Failed to start chat');
    }
  };

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setOpenDropdownId(null);
  };

  const handleConfirmDelete = async () => {
    if (!activeChat || !messageToDelete) return;
    try {
      await deleteMessage(activeChat.id, messageToDelete);
    } catch (e) {
      toast.error('Failed to delete message');
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleEditMessageClick = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setMessageText(msg.text);
    setOpenDropdownId(null);
  };

  const getOtherParticipant = (chat: Chat) => {
    if (!user) return null;
    const otherId = chat.participants.find(p => p !== user.uid);
    if (!otherId) return null;
    return chat.participantDetails?.[otherId];
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.uid) return 'You';
    return activeChat?.participantDetails?.[senderId]?.displayName?.split(' ')[0] || 'Unknown';
  };

  const handleClearChat = async () => {
    setIsChatMenuOpen(false);
    if (!activeChat || !confirm('Are you sure you want to clear this chat? This will delete all messages for everyone.')) return;
    try {
      await clearChatMessages(activeChat.id);
      toast.success('Chat cleared');
    } catch (e) {
      toast.error('Failed to clear chat');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageText(val);
    
    if (activeChat?.type === 'group') {
      const lastAtPos = val.lastIndexOf('@');
      if (lastAtPos !== -1 && (lastAtPos === 0 || val[lastAtPos - 1] === ' ')) {
        const query = val.slice(lastAtPos + 1);
        if (!query.includes(' ')) {
          if (mentionMode === 'idle' || mentionMode === 'type_select') {
            if (query === '') setMentionMode('type_select');
            else setMentionMode('users'); // default fallback if they keep typing
          }
          setMentionQuery(query.toLowerCase());
          setMentionIndex(0);
          return;
        }
      }
    }
    setMentionMode('idle');
  };

  const getMentionableItems = () => {
    if (mentionMode === 'users') {
      return activeChat?.participants
        .filter(uid => uid !== user?.uid)
        .map(uid => activeChat?.participantDetails?.[uid])
        .filter(p => p?.displayName?.toLowerCase().includes(mentionQuery)) || [];
    }
    if (mentionMode === 'modules') {
      const activeProject = projects.find(p => p.id === activeChat?.projectId);
      const allModules = activeProject?.customModules || [];
      return allModules.filter(m => m.toLowerCase().includes(mentionQuery)).map(m => ({ type: 'module', name: m }));
    }
    if (mentionMode === 'tasks') {
      return activeProjectTasks.filter(t => 
        t.title.toLowerCase().includes(mentionQuery) || 
        (t.ticketId || t.id).toLowerCase().includes(mentionQuery)
      ).map(t => ({ type: 'task', id: t.ticketId || t.id, title: t.title }));
    }
    return [];
  };

  const mentionableItems = getMentionableItems();

  const handleSelectMention = (item: any) => {
    const lastAtPos = messageText.lastIndexOf('@');
    let replacement = '';
    
    if (mentionMode === 'users' || item.email) { // user object
      const mentionName = item.displayName.replace(/\s+/g, '');
      replacement = `@${mentionName}`;
    } else if (mentionMode === 'modules' || item.type === 'module') {
      replacement = `[Module: ${item.name}]`;
    } else if (mentionMode === 'tasks' || item.type === 'task') {
      replacement = `[Task: ${item.id}]`;
    }

    const newText = messageText.slice(0, lastAtPos) + replacement + ' ' + messageText.slice(lastAtPos + mentionQuery.length + 1);
    setMessageText(newText);
    setMentionMode('idle');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionMode !== 'idle') {
      if (mentionMode === 'type_select') {
        if (e.key === 'Escape') setMentionMode('idle');
        return;
      }
      if (mentionableItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex(prev => (prev + 1) % mentionableItems.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex(prev => (prev - 1 + mentionableItems.length) % mentionableItems.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleSelectMention(mentionableItems[mentionIndex]);
        } else if (e.key === 'Escape') {
          setMentionMode('idle');
        }
      }
    }
  };

  const handleUserClick = (mentionName: string) => {
    if (activeChat?.type !== 'group') return;
    const matchedUser = activeChat.participants
      .map(uid => activeChat.participantDetails?.[uid])
      .find(p => p?.displayName?.replace(/\s+/g, '') === mentionName);
    
    if (matchedUser) {
      // Find the matched user's full UID by looking up in participantDetails
      const matchedUid = activeChat.participants.find(uid => activeChat.participantDetails?.[uid]?.email === matchedUser.email);
      setSelectedUserProfile({ ...matchedUser, uid: matchedUid });
    }
  };

  if (!user) return null;

  const filteredChats = chats.filter(chat => {
    if (filter === 'unread' && (chat.unreadCounts?.[user.uid] || 0) === 0) return false;
    if (filter === 'groups' && chat.type !== 'group') return false;
    
    if (chatListQuery.trim()) {
      const isGroup = chat.type === 'group';
      const q = chatListQuery.toLowerCase();
      const other = !isGroup ? getOtherParticipant(chat) : null;
      const displayName = isGroup ? chat.name || '' : (other?.displayName || 'Unknown');
      if (!displayName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ 
      height: 'calc(100dvh - 60px)', display: 'flex', overflow: 'hidden', 
      margin: '-24px', background: 'var(--bg-primary)'
    }}>
      
      {/* ----------------------------- LEFT PANE (Chat List) ----------------------------- */}
      <div style={{ width: 340, borderRight: '1px solid #222d34', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', flexShrink: 0 }}>
        
        {/* Top Header */}
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', height: 59 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Chats</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-3)' }}>
            {/* Search Icon */}
            <button 
              onClick={() => setChatListQuery(prev => prev === '__search__' ? '' : '__search__')} 
              style={{ background: 'none', border: 'none', color: chatListQuery === '__search__' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
              title="Search chats"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z"></path></svg>
            </button>
            {/* New Chat */}
            <button onClick={() => setIsSearchModalOpen(true)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}>
              <div style={{ background: 'var(--accent)', color: 'var(--bg-card)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>
              </div>
            </button>
          </div>
        </div>

        {/* Inline Search Bar — shown only when search icon is active */}
        {chatListQuery === '__search__' || (chatListQuery && chatListQuery !== '__search__') ? (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', height: 36, border: '1px solid var(--border)' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-3)"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z"></path></svg>
              <input 
                type="text" 
                placeholder="Search chats..."
                value={chatListQuery === '__search__' ? '' : chatListQuery}
                onChange={(e) => setChatListQuery(e.target.value || '__search__')}
                autoFocus
                style={{ background: 'transparent', border: 'none', color: 'var(--text-1)', fontSize: 14, marginLeft: 10, width: '100%', outline: 'none', fontFamily: 'inherit' }} 
              />
              {chatListQuery !== '__search__' && (
                <button onClick={() => setChatListQuery('__search__')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg>
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Filter Pills */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, borderBottom: '1px solid #222d34' }}>
          {(['all', 'unread', 'groups'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--accent)' : 'var(--bg-elevated)',
                color: filter === f ? 'var(--bg-card)' : 'var(--text-2)',
                border: 'none', borderRadius: 16, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
        
        {/* Chat List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredChats.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
              <div style={{ fontSize: 13 }}>No conversations found.</div>
            </div>
          ) : (
            filteredChats.map(chat => {
              const isGroup = chat.type === 'group';
              const baseName = isGroup ? (chat.name || '').replace(' Team', '') : '';
              const other = !isGroup ? getOtherParticipant(chat) : null;
              const isActive = activeChat?.id === chat.id;
              const unread = chat.unreadCounts?.[user.uid] || 0;
              
              const displayName = isGroup ? chat.name || '' : (other?.displayName || 'Unknown');
              const displayLastMessage = chat.lastMessage?.text || '';
              
              return (
                <div 
                  key={chat.id} 
                  onClick={() => {
                    if (activeChat?.id !== chat.id) {
                      if (!visitedChats.current.has(chat.id)) {
                        visitedChats.current.add(chat.id);
                        setLoadingChatId(chat.id);
                      }
                      setActiveChat(chat);
                    }
                  }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px', height: 72,
                    cursor: 'pointer',
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  {isGroup ? (
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                      background: getAuraGradient(baseName),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 2px 2px rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
                        {baseName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ) : other?.photoURL ? (
                    <img src={other.photoURL} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#fff', fontSize: 18 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Text Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', borderBottom: isActive ? 'none' : '1px solid #222d34' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div className="truncate-1" style={{ fontSize: 16, color: 'var(--text-1)' }}>{displayName}</div>
                      <div style={{ fontSize: 12, color: unread > 0 ? 'var(--accent)' : 'var(--text-2)' }}>
                        {chat.lastMessage ? formatMessageDate(chat.lastMessage.createdAt) : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="truncate-1" style={{ fontSize: 14, color: 'var(--text-2)' }}>
                        {isGroup && chat.lastMessage && chat.lastMessage.senderId !== user.uid ? `${getSenderName(chat.lastMessage.senderId)}: ` : ''}
                        {displayLastMessage}
                      </div>
                      {unread > 0 && (
                        <div style={{ background: 'var(--accent)', color: 'var(--bg-card)', fontSize: 12, fontWeight: 600, borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                          {unread}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------------------- RIGHT PANE (Active Chat) ----------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
        
        {/* Cinematic MS Loader */}
        <AnimatePresence>
          {loadingChatId && (
            <motion.div 
              key="loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 2, filter: 'blur(15px)' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', position: 'absolute', inset: 0, background: 'var(--bg-primary)', zIndex: 100 }}
            >
              <AuraOrb subtitle="Messages" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Landing Page Aura Animation (First Load Only) */}
        {!activeChat && !initialLoadFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <AuraOrb subtitle="Messages" />
          </div>
        )}

        {activeChat ? (
          <>
            {/* Header */}
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', height: 59, borderLeft: '1px solid #313d45' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {activeChat.type === 'group' ? (
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: getAuraGradient((activeChat.name || '').replace(' Team', '')),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.3)',
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    <span style={{ color: '#fff', fontSize: 17, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      {(activeChat.name || '').replace(' Team', '').charAt(0).toUpperCase()}
                    </span>
                  </div>
                ) : getOtherParticipant(activeChat)?.photoURL ? (
                  <img src={getOtherParticipant(activeChat)!.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#fff', fontSize: 16 }}>
                    {getOtherParticipant(activeChat)?.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                
                {/* Clickable Header */}
                <div style={{ cursor: 'pointer' }}>
                  {activeChat.type === 'group' ? (
                    <Link href={`/projects/${activeChat.projectId}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: 16, color: 'var(--text-1)' }}>{activeChat.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 1 }} className="truncate-1">
                        {activeChat.participants.map(uid => uid === user.uid ? 'You' : activeChat.participantDetails?.[uid]?.displayName?.split(' ')[0]).join(', ')}
                      </div>
                    </Link>
                  ) : (
                    <>
                      <div style={{ fontSize: 16, color: 'var(--text-1)' }}>{getOtherParticipant(activeChat)?.displayName}</div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, color: 'var(--text-3)', position: 'relative' }}>
                <button onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"></path></svg>
                </button>
                <button onClick={() => setIsChatMenuOpen(!isChatMenuOpen)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path></svg>
                </button>
                
                {/* Chat Menu */}
                {isChatMenuOpen && (
                  <div style={{ position: 'absolute', top: 32, right: 0, background: 'var(--bg-elevated)', borderRadius: 3, boxShadow: '0 2px 5px 0 rgba(11,20,26,.26),0 2px 10px 0 rgba(11,20,26,.16)', zIndex: 20, minWidth: 160, padding: '8px 0' }}>
                    <div onClick={handleClearChat} style={{ padding: '10px 24px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }} className="hover-bg">Clear chat</div>
                  </div>
                )}
              </div>
            </div>

            {/* Message Search Bar */}
            {isMessageSearchOpen && (
              <div style={{ background: 'var(--bg-elevated)', padding: '8px 16px', display: 'flex', alignItems: 'center', borderLeft: '1px solid #313d45' }}>
                <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', height: 36 }}>
                  <input 
                    type="text" 
                    placeholder="Search messages..." 
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 14, width: '100%', outline: 'none', fontFamily: 'inherit' }}
                    autoFocus
                  />
                  <button onClick={() => { setIsMessageSearchOpen(false); setMessageSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 4% 10px', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={() => { setOpenDropdownId(null); setIsChatMenuOpen(false); }}>
              {messages.filter(m => !messageSearchQuery || m.text.toLowerCase().includes(messageSearchQuery.toLowerCase())).map((msg, idx, arr) => {
                const isMe = msg.senderId === user.uid;
                const showTail = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
                const showName = !isMe && activeChat.type === 'group' && showTail;
                const isHovered = hoveredMessageId === msg.id;
                const isDropdownOpen = openDropdownId === msg.id;
                
                // Read receipts
                const hasRead = msg.readBy && msg.readBy.length > 1;

                if (msg.isSystem) {
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                      <div style={{ 
                        background: msg.systemType === 'meeting_invite' ? 'var(--bg-card)' : 'var(--bg-hover)', 
                        padding: msg.systemType === 'meeting_invite' ? '16px 20px' : '6px 16px', 
                        borderRadius: msg.systemType === 'meeting_invite' ? 12 : 24, 
                        maxWidth: '85%', 
                        color: msg.systemType === 'meeting_invite' ? 'var(--text-1)' : 'var(--text-2)', 
                        fontSize: 13, 
                        textAlign: 'center', 
                        border: msg.systemType === 'meeting_invite' ? '1px solid var(--border-subtle)' : '1px solid var(--border)', 
                        boxShadow: msg.systemType === 'meeting_invite' ? 'var(--shadow-card)' : 'none' 
                      }}>
                        {msg.systemType === 'meeting_invite' && msg.systemData ? (
                          (() => {
                            const sd = msg.systemData;
                            const joinedBy: any[] = sd.joinedBy || [];
                            const isEnded = !!sd.endedAt;
                            const startedAt = sd.startedAt ? new Date(sd.startedAt) : null;
                            const endedAt = sd.endedAt ? new Date(sd.endedAt) : null;
                            const durationMs = startedAt && endedAt ? endedAt.getTime() - startedAt.getTime() : null;
                            const durationStr = durationMs != null
                              ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
                              : null;
                            const alreadyJoined = joinedBy.some((j: any) => j.uid === user.uid);
                            const isHost = msg.systemData?.createdBy === user.uid || msg.senderId === user.uid;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', minWidth: 260 }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isEnded ? 'var(--text-3)' : 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                                  {isEnded ? 'Meeting Ended' : 'Meeting Scheduled'}
                                </div>

                                {/* Title & time */}
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{sd.name}</div>
                                <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{format(msg.createdAt, 'MMM d, yyyy h:mm a')}</div>

                                {/* Duration if ended */}
                                {isEnded && durationStr && (
                                  <div style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '4px 12px', borderRadius: 99, fontWeight: 600 }}>
                                    Duration: {durationStr}
                                  </div>
                                )}

                                {/* Participants who joined */}
                                {joinedBy.length > 0 && (
                                  <div style={{ width: '100%' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      {isEnded ? 'Attended' : 'Live Now'} ({joinedBy.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                      {joinedBy.map((j: any) => (
                                        <div key={j.uid} title={j.displayName} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-primary)', borderRadius: 99, padding: '3px 8px 3px 3px', fontSize: 12, fontWeight: 600 }}>
                                          {j.photoURL ? (
                                            <img src={j.photoURL} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                                          ) : (
                                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                                              {j.displayName?.[0]}
                                            </div>
                                          )}
                                          <span style={{ color: isEnded ? 'var(--text-3)' : 'var(--accent)' }}>{j.displayName?.split(' ')[0]}</span>
                                          {!isEnded && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Invited Attendees (when no one has joined yet) */}
                                {joinedBy.length === 0 && sd.attendees && sd.attendees.length > 0 && activeChat.type === 'group' && (
                                  <div style={{ width: '100%' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                                      Invited ({sd.attendees.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                      {sd.attendees.map((uid: string) => {
                                        const p = activeChat.participantDetails?.[uid];
                                        const name = p?.displayName || 'Unknown';
                                        return (
                                          <div key={uid} title={name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-primary)', borderRadius: 99, padding: '3px 8px 3px 3px', fontSize: 12, fontWeight: 600 }}>
                                            {p?.photoURL ? (
                                              <img src={p.photoURL} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                                                {name[0]}
                                              </div>
                                            )}
                                            <span style={{ color: 'var(--text-3)' }}>{name.split(' ')[0]}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Action buttons */}
                                {!isEnded && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <a
                                      href={sd.link || `/projects/${activeChat.projectId}/meetings`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={async () => {
                                        try {
                                          await recordMeetingJoin(activeChat.id, msg.id, {
                                            uid: user.uid,
                                            displayName: user.displayName || 'Unknown',
                                            photoURL: user.photoURL || '',
                                          });
                                        } catch (e) { console.error(e); }
                                      }}
                                      style={{ background: 'var(--accent)', color: 'var(--bg-card)', textDecoration: 'none', padding: '7px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                                      {alreadyJoined ? 'Rejoin' : 'Join Meeting'}
                                    </a>
                                    {isHost && (
                                      <button
                                        onClick={() => setMeetingToEnd(msg.id)}
                                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '7px 14px', borderRadius: 20, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                                      >
                                        End Meeting
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {msg.systemType === 'task_assignment' && <svg viewBox="0 0 24 24" width="16" height="16" fill="#53bdeb" style={{ flexShrink: 0 }}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>}
                            {msg.systemType === 'task_update' && <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--accent)" style={{ flexShrink: 0 }}><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></svg>}
                            <span style={{ lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {msg.senderId && activeChat.participantDetails?.[msg.senderId]?.displayName && (msg.systemType === 'task_update' || msg.systemType === 'task_assignment') ? (
                                <>
                                  <strong 
                                    onClick={() => {
                                      const uid = msg.senderId;
                                      const details = activeChat.participantDetails?.[uid];
                                      if (details) setSelectedUserProfile({ ...details, uid });
                                    }}
                                    style={{ 
                                      color: msg.systemType === 'task_update' ? 'var(--accent)' : '#53bdeb',
                                      cursor: 'pointer',
                                      borderBottom: '1px dotted currentColor',
                                    }}
                                  >
                                    {activeChat.participantDetails[msg.senderId].displayName.split(' ')[0]}
                                  </strong>{' '}
                                  {renderMessageText(msg.text.charAt(0).toLowerCase() + msg.text.slice(1), activeChat.projectId, handleUserClick)}
                                </>
                              ) : (
                                renderMessageText(msg.text, activeChat.projectId, handleUserClick)
                              )}
                              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>{format(msg.createdAt, 'HH:mm')}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={msg.id} 
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: showTail ? 8 : 2 }}
                  >
                    <div style={{ 
                      maxWidth: '65%', 
                      padding: '6px 10px', 
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      borderTopRightRadius: isMe && showTail ? 4 : 12,
                      borderTopLeftRadius: !isMe && showTail ? 4 : 12,
                      background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: isMe ? 'var(--btn-primary-text)' : 'var(--text-1)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      position: 'relative',
                      border: isMe ? 'none' : '1px solid var(--border-subtle)',
                      fontSize: 14.5
                    }}>
                      
                      {/* Down Arrow for Dropdown */}
                      {(isHovered || isDropdownOpen) && !msg.isDeleted && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); setOpenDropdownId(isDropdownOpen ? null : msg.id); }}
                          style={{ position: 'absolute', top: 0, right: 0, padding: '6px 8px', background: isMe ? 'linear-gradient(to right, transparent, var(--accent) 20%)' : 'linear-gradient(to right, transparent, var(--bg-elevated) 20%)', borderRadius: '0 12px 0 0', cursor: 'pointer', zIndex: 10 }}
                        >
                          <svg viewBox="0 0 18 18" width="18" height="18" fill="rgba(255,255,255,0.6)"><path d="M3.3 4.6L9 10.3l5.7-5.7 1.6 1.6L9 13.6 1.7 6.2z"></path></svg>
                        </div>
                      )}

                      {/* Dropdown Menu */}
                      {isDropdownOpen && !msg.isDeleted && (
                        <div style={{ position: 'absolute', top: 24, right: 0, background: 'var(--bg-elevated)', borderRadius: 3, boxShadow: '0 2px 5px 0 rgba(11,20,26,.26),0 2px 10px 0 rgba(11,20,26,.16)', zIndex: 20, minWidth: 120, padding: '8px 0' }}>
                          <div onClick={() => { setReplyToMessage(msg); setOpenDropdownId(null); }} style={{ padding: '10px 24px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }} className="hover-bg">Reply</div>
                          {isMe && (
                            <>
                              <div onClick={() => handleEditMessageClick(msg)} style={{ padding: '10px 24px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }} className="hover-bg">Edit</div>
                              <div onClick={() => handleDeleteClick(msg.id)} style={{ padding: '10px 24px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }} className="hover-bg">Delete</div>
                            </>
                          )}
                        </div>
                      )}

                      {showName && !msg.isDeleted && (
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#53bdeb', marginBottom: 2 }}>
                          {activeChat.participantDetails?.[msg.senderId]?.displayName}
                        </div>
                      )}
                      
                      {msg.isDeleted ? (
                        <div style={{ fontSize: 14.2, lineHeight: '19px', paddingRight: 60, fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"></path></svg>
                          {isMe ? 'You deleted this message' : `${activeChat.participantDetails?.[msg.senderId]?.displayName?.split(' ')[0]} deleted this message`}
                        </div>
                      ) : (
                        <div style={{ paddingRight: 60, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {msg.mediaUrl ? (
                            msg.mediaType === 'audio' ? (
                              <audio src={msg.mediaUrl} controls style={{ maxWidth: '100%', height: 40 }} />
                            ) : msg.mediaType === 'image' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <img src={msg.mediaUrl} alt="" style={{ maxWidth: 300, maxHeight: 300, borderRadius: 8, cursor: 'pointer', objectFit: 'contain', background: 'var(--bg-card)' }} onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                {msg.text !== 'Voice message' && msg.text !== 'File attachment' && msg.text !== 'Image' && <span style={{ fontSize: 14.2, lineHeight: '19px', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{renderMessageText(msg.text, activeChat.projectId, handleUserClick)}</span>}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isMe ? 'var(--accent)' : 'var(--bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"></path></svg>
                                <a href={msg.mediaUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontSize: 14 }}>{msg.text}</a>
                              </div>
                            )
                          ) : (() => {
                            const reply = parseReply(msg.text);
                            if (reply) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {/* Reply quote block */}
                                  <div style={{
                                    borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : 'var(--accent)'}`,
                                    borderRadius: '0 6px 6px 0',
                                    background: isMe ? 'rgba(0,0,0,0.15)' : 'var(--bg-card)',
                                    padding: '6px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                  }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--accent)', marginBottom: 1 }}>
                                      {reply.replyName}
                                    </div>
                                    <div style={{ fontSize: 12.5, color: isMe ? 'rgba(255,255,255,0.55)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                      {renderMessageText(reply.quotedText, activeChat.projectId, handleUserClick)}
                                    </div>
                                  </div>
                                  {/* Actual message */}
                                  <div style={{ fontSize: 14.2, lineHeight: '19px', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                    {renderMessageText(reply.actualText, activeChat.projectId, handleUserClick)}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div style={{ fontSize: 14.2, lineHeight: '19px', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                {renderMessageText(msg.text, activeChat.projectId, handleUserClick)}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-3)', position: 'absolute', right: 7, bottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {!msg.isDeleted && msg.isEdited && <span style={{ fontStyle: 'italic', marginRight: 4 }}>Edited</span>}
                        {format(msg.createdAt, 'HH:mm')}
                        {isMe && (
                          hasRead ? (
                            <svg viewBox="0 0 16 15" width="16" height="15" fill="#53bdeb"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                          ) : (
                            <svg viewBox="0 0 16 15" width="16" height="15" fill="rgba(255,255,255,0.6)"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"></path></svg>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} style={{ height: 1 }} />
            </div>

            {/* Replying To / Editing Banner */}
            {(replyToMessage || editingMessage) && (
              <div style={{ 
                background: 'var(--bg-elevated)', 
                padding: '10px 16px', 
                borderBottom: '1px solid var(--border-subtle)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'stretch',
                  background: 'var(--bg-card)', 
                  borderRadius: 10, 
                  borderLeft: `4px solid ${editingMessage ? '#f59e0b' : 'var(--accent)'}`, 
                  flex: 1, 
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ padding: '8px 12px', flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 11, 
                      color: editingMessage ? '#f59e0b' : 'var(--accent)', 
                      fontWeight: 700, 
                      marginBottom: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}>
                      {editingMessage ? (
                        <><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>Editing message</>
                      ) : (
                        <><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>Replying to {activeChat.participantDetails?.[replyToMessage!.senderId]?.displayName || 'You'}</>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editingMessage ? editingMessage.text : replyToMessage?.text}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setReplyToMessage(null); setEditingMessage(null); setMessageText(''); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, flexShrink: 0, borderRadius: 6, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg>
                </button>
              </div>
            )}

            {/* Input Area */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, color: 'var(--text-2)' }}>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }} title="Attach file">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.111-.589 1.543l-9.547 9.549a3.97 3.97 0 0 1-2.829 1.171 3.975 3.975 0 0 1-2.83-1.173 3.973 3.973 0 0 1-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.57.57 0 0 0-.834.018l-7.205 7.207a5.577 5.577 0 0 0-1.645 3.971z"></path></svg>
                </button>
              </div>
              <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                {/* Mentions Dropdown */}
                <AnimatePresence>
                  {mentionMode !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{ position: 'absolute', bottom: '100%', left: 16, marginBottom: 8, background: 'var(--bg-elevated)', borderRadius: 8, boxShadow: '0 2px 5px 0 rgba(11,20,26,.26),0 2px 10px 0 rgba(11,20,26,.16)', overflow: 'hidden', zIndex: 10, width: 300 }}
                    >
                      {mentionMode === 'type_select' ? (
                        <div>
                          <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-2)', borderBottom: '1px solid #313d45' }}>What do you want to mention?</div>
                          {[
                            { id: 'users', icon: '👤', label: 'User' },
                            { id: 'modules', icon: '🧩', label: 'Module' },
                            { id: 'tasks', icon: '📋', label: 'Task' }
                          ].map((opt, i) => (
                            <div 
                              key={opt.id} 
                              onClick={() => { setMentionMode(opt.id as any); setMentionQuery(''); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: mentionIndex === i ? 'var(--bg-card)' : 'transparent' }}
                              onMouseEnter={() => setMentionIndex(i)}
                            >
                              <span style={{ fontSize: 18 }}>{opt.icon}</span>
                              <span style={{ color: 'var(--text-1)', fontSize: 15 }}>Mention {opt.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {mentionableItems.length === 0 ? (
                            <div style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 14 }}>No matches found</div>
                          ) : (
                            mentionableItems.map((item, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => handleSelectMention(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: idx === mentionIndex ? 'var(--bg-card)' : 'transparent' }}
                                onMouseEnter={() => setMentionIndex(idx)}
                              >
                                {mentionMode === 'users' ? (
                                  <>
                                    {(item as any)?.photoURL ? (
                                      <img src={(item as any).photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: getColorFromName((item as any)?.displayName || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                                        {(item as any)?.displayName?.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div style={{ color: 'var(--text-1)', fontSize: 15 }}>{(item as any)?.displayName}</div>
                                  </>
                                ) : mentionMode === 'modules' ? (
                                  <>
                                    <span style={{ fontSize: 18 }}>🧩</span>
                                    <div style={{ color: 'var(--text-1)', fontSize: 15 }}>{(item as any).name}</div>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ fontSize: 18 }}>📋</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 500 }}>{(item as any).id}</span>
                                      <span style={{ color: 'var(--text-1)', fontSize: 14 }} className="truncate-1">{(item as any).title}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  {isRecording ? (
                    <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                      <span style={{ color: 'var(--text-2)', fontSize: 15 }}>Recording audio...</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={messageText}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder="Type a message or paste an image"
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-1)', outline: 'none', fontSize: 15, fontFamily: 'inherit' }}
                    />
                  )}
                </form>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {messageText.trim() ? (
                  <button onClick={handleSendMessage} disabled={!messageText.trim() || isUploadingMedia} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0 }}>
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                  </button>
                ) : (
                  <button onClick={toggleRecording} style={{ background: 'none', border: 'none', color: isRecording ? '#ef4444' : 'var(--text-2)', cursor: 'pointer', padding: 0 }} title="Record voice message">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.002z"></path></svg>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', background: 'var(--bg-elevated)' }}>
            <div style={{ width: 320, height: 200, marginBottom: 32, position: 'relative' }}>
              {/* Background Arc */}
              <svg viewBox="0 0 320 200" fill="none" style={{ position: 'absolute', inset: 0 }}>
                <path d="M20 180 A 140 140 0 0 1 300 180" stroke="var(--bg-card)" strokeWidth="32" strokeLinecap="round" />
              </svg>
              {/* Interactive Foreground Arc */}
              <svg viewBox="0 0 320 200" fill="none" style={{ position: 'absolute', inset: 0 }}>
                <motion.path 
                  d="M20 180 A 140 140 0 0 1 300 180" 
                  stroke="#00a884" 
                  strokeWidth="32" 
                  strokeLinecap="round" 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: fillAmount }}
                  transition={{ type: 'tween', ease: 'easeOut', duration: 0.1 }}
                />
              </svg>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-1)', marginBottom: 16 }}>MS-Dev Web</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, textAlign: 'center', maxWidth: 400 }}>
              Send and receive messages seamlessly with your team.
            </p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,20,26,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)', borderRadius: 12, padding: 24, boxShadow: '0 17px 50px 0 rgba(11,20,26,.19), 0 12px 15px 0 rgba(11,20,26,.24)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-1)', margin: 0 }}>New chat</h3>
                <button onClick={() => setIsSearchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg></button>
              </div>

              <form onSubmit={handleSearchUsers} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <input 
                  type="text" 
                  style={{ flex: 1, background: 'var(--bg-elevated)', border: 'none', borderRadius: 8, padding: '9px 12px', color: 'var(--text-2)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} 
                  placeholder="Search by email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button type="submit" disabled={searching || !searchQuery.trim()} style={{ background: 'var(--accent)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {searchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-2)', fontSize: 14 }}>
                    {searchQuery ? 'No users found.' : 'Enter an email to find users.'}
                  </div>
                ) : (
                  searchResults.map(res => (
                    <div key={res.uid} onClick={() => handleStartChat(res)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #222d34', cursor: 'pointer' }}>
                      {res.photoURL ? (
                        <img src={res.photoURL} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#fff', fontSize: 18 }}>
                          {res.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, color: 'var(--text-1)', marginBottom: 2 }}>{res.displayName}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{res.email}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {messageToDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,20,26,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              style={{ width: '100%', maxWidth: 400, background: 'var(--bg-elevated)', borderRadius: 3, padding: '22px 24px', boxShadow: '0 17px 50px 0 rgba(11,20,26,.19), 0 12px 15px 0 rgba(11,20,26,.24)' }}
            >
              <div style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 32 }}>
                Delete message?
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button 
                  onClick={() => setMessageToDelete(null)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--accent)', borderRadius: 24, padding: '8px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  style={{ background: 'var(--accent)', border: 'none', color: 'var(--bg-card)', borderRadius: 24, padding: '8px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                >
                  Delete for me
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMediaPreview && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(11, 20, 26, 0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}
          >
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-1)' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Send Media</h3>
                <button onClick={() => setSelectedMediaPreview(null)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg>
                </button>
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'center' }}>
                {selectedMediaPreview.type === 'image' ? (
                  <img src={selectedMediaPreview.url} alt="Preview" style={{ maxHeight: 400, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                ) : (
                  <div style={{ padding: 40, color: 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"></path></svg>
                    <span style={{ color: 'var(--text-1)', fontSize: 15 }}>{selectedMediaPreview.file.name}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <input 
                  type="text" 
                  placeholder="Add a caption..." 
                  value={messageText}
                  onChange={handleTextChange}
                  style={{ flex: 1, background: 'var(--bg-hover)', border: 'none', borderRadius: 8, padding: '12px 16px', color: 'var(--text-1)', outline: 'none', fontSize: 15, fontFamily: 'inherit' }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') confirmSendMedia(); }}
                />
                <button 
                  onClick={confirmSendMedia}
                  disabled={isUploadingMedia}
                  style={{ background: 'var(--accent)', color: 'var(--bg-card)', border: 'none', borderRadius: 8, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUploadingMedia ? 'not-allowed' : 'pointer', opacity: isUploadingMedia ? 0.6 : 1 }}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      <AnimatePresence>
        {selectedUserProfile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            style={{ position: 'fixed', inset: 0, background: 'rgba(11,20,26,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setSelectedUserProfile(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div style={{ padding: 32, background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative' }}>
                <button onClick={() => setSelectedUserProfile(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.8 5.8l-1.6-1.6-6.2 6.2-6.2-6.2-1.6 1.6 6.2 6.2-6.2 6.2 1.6 1.6 6.2-6.2 6.2 6.2 1.6-1.6-6.2-6.2 6.2-6.2z"></path></svg>
                </button>
                
                {selectedUserProfile.photoURL ? (
                  <img src={selectedUserProfile.photoURL} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #111b21', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                ) : (
                  <div style={{ width: 96, height: 96, borderRadius: '50%', background: getColorFromName(selectedUserProfile.displayName || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#fff', fontWeight: 'bold', border: '4px solid #111b21', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    {selectedUserProfile.displayName?.substring(0, 2).toUpperCase()}
                  </div>
                )}
                
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ margin: 0, color: 'var(--text-1)', fontSize: 22, fontWeight: 700 }}>{selectedUserProfile.displayName}</h2>
                  <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>{selectedUserProfile.email}</div>
                </div>

                {/* Message button - only if not own profile */}
                {selectedUserProfile.uid !== user.uid && (
                  <button
                    onClick={async () => {
                      if (!user?.uid) return;
                      const chatId = await startDirectChat(user as any, { uid: selectedUserProfile.uid, displayName: selectedUserProfile.displayName, photoURL: selectedUserProfile.photoURL || '', email: selectedUserProfile.email });
                      setSelectedUserProfile(null);
                      const chat = chats.find(c => c.id === chatId);
                      if (chat) setActiveChat(chat);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--accent)', color: 'var(--btn-primary-text)',
                      border: 'none', borderRadius: 10,
                      padding: '10px 24px', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 4px 12px rgba(0,168,132,0.3)',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    Message
                  </button>
                )}
              </div>
              
              {/* Activity Section */}
              <div style={{ padding: '0 24px 24px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--accent)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>Project Activity</h3>
                
                {activeProjectTasks.filter(t => t.assigneeId === selectedUserProfile.uid).length === 0 ? (
                  <div style={{ color: 'var(--text-2)', fontSize: 14, textAlign: 'center', padding: '32px 0', background: 'var(--bg-elevated)', borderRadius: 12 }}>
                    No active tasks in this project.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                    {activeProjectTasks.filter(t => t.assigneeId === selectedUserProfile.uid).map(task => (
                      <Link href={`/projects/${activeChat?.projectId}/kanban?ticket=${task.ticketId || task.id}`} key={task.id} onClick={() => setSelectedUserProfile(null)} style={{ textDecoration: 'none' }}>
                        <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid #2a3942', transition: 'all 0.2s' }} className="hover-bg">
                          <div style={{ color: 'var(--text-1)', fontSize: 15, fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>{task.title}</div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
                            <span style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>{task.ticketId || task.id}</span>
                            <span style={{ 
                              color: task.status === 'completed' ? '#10b981' : task.status === 'in_progress' ? '#f59e0b' : '#8b5cf6',
                              background: task.status === 'completed' ? 'rgba(16,185,129,0.1)' : task.status === 'in_progress' ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                              padding: '4px 8px', borderRadius: 6, fontWeight: 600, textTransform: 'capitalize'
                            }}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Meeting Confirmation Modal */}
      <AnimatePresence>
        {meetingToEnd && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMeetingToEnd(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>End Meeting?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Are you sure you want to end this meeting? This will record the end time and duration for everyone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button 
                  onClick={() => setMeetingToEnd(null)}
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!activeChat || !meetingToEnd) return;
                    try {
                      await endMeeting(activeChat.id, meetingToEnd);
                      toast.success('Meeting ended');
                      setMeetingToEnd(null);
                    } catch (e) {
                      toast.error('Failed to end meeting');
                    }
                  }}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                >
                  End Meeting
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
