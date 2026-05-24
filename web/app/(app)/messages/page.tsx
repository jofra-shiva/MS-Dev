'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Chat, ChatMessage } from '@/types';
import { subscribeToUserChats, subscribeToChatMessages, sendMessage, startDirectChat, searchUsersByEmail } from '@/lib/firebase/chat';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  
  // Search state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserChats(user.uid, setChats);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToChatMessages(activeChat.id, setMessages);
    return unsub;
  }, [activeChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !user || !messageText.trim()) return;

    const text = messageText;
    setMessageText(''); // Optimistic clear
    
    try {
      await sendMessage(activeChat.id, user.uid, text);
    } catch (err: any) {
      toast.error('Failed to send message');
      setMessageText(text); // Revert
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsersByEmail(searchQuery);
      // Filter out self
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
      
      // Close modal and find the chat
      setIsSearchModalOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      
      // Automatically select the chat if it's already in the list
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        setActiveChat(chat);
      } else {
        // Will be picked up by the listener shortly
        toast.success('Chat started!');
      }
    } catch (err: any) {
      toast.error('Failed to start chat');
    }
  };

  const getOtherParticipant = (chat: Chat) => {
    if (!user) return null;
    const otherId = chat.participants.find(p => p !== user.uid);
    if (!otherId) return null;
    return chat.participantDetails[otherId];
  };

  if (!user) return null;

  return (
    <div style={{ height: 'calc(100dvh - 60px)', display: 'flex', overflow: 'hidden', background: 'var(--bg-primary)', margin: '-24px', borderTop: '1px solid var(--border-subtle)' }}>
      
      {/* Sidebar (Chat List) */}
      <div style={{ width: 340, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Messages</h2>
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => setIsSearchModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {chats.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 13 }}>No conversations yet.</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setIsSearchModalOpen(true)}>Start a Chat</button>
            </div>
          ) : (
            chats.map(chat => {
              const other = getOtherParticipant(chat);
              const isActive = activeChat?.id === chat.id;
              
              return (
                <div 
                  key={chat.id} 
                  onClick={() => setActiveChat(chat)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    background: isActive ? 'var(--bg-active)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  className="hover:bg-active"
                >
                  {other?.photoURL ? (
                    <img src={other.photoURL} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-2)' }}>
                      {other?.displayName?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div className="truncate-1" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{other?.displayName || 'Unknown User'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {chat.lastMessage ? format(chat.lastMessage.createdAt, 'HH:mm') : ''}
                      </div>
                    </div>
                    <div className="truncate-1" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {chat.lastMessage?.text || 'No messages yet'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
              {getOtherParticipant(activeChat)?.photoURL ? (
                <img src={getOtherParticipant(activeChat)!.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-2)' }}>
                  {getOtherParticipant(activeChat)?.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{getOtherParticipant(activeChat)?.displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{getOtherParticipant(activeChat)?.email}</div>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === user.uid;
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ 
                      maxWidth: '70%', 
                      padding: '10px 14px', 
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: isMe ? '#fff' : 'var(--text-1)',
                      border: isMe ? 'none' : '1px solid var(--border-subtle)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.text}</div>
                      <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-3)', textAlign: 'right', marginTop: 4 }}>
                        {format(msg.createdAt, 'HH:mm')}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 12 }}>
                <input 
                  type="text" 
                  className="input" 
                  style={{ flex: 1, borderRadius: 24, padding: '12px 20px' }} 
                  placeholder="Type a message..." 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  autoFocus
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ borderRadius: '50%', width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  disabled={!messageText.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px) translateY(1px)' }}>
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>MS-Dev Messages</h2>
            <p style={{ fontSize: 14 }}>Select a conversation or start a new one.</p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="modal" 
              style={{ width: '100%', maxWidth: 480, padding: 24 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New Chat</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsSearchModalOpen(false)}>Close</button>
              </div>

              <form onSubmit={handleSearchUsers} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <input 
                  type="text" 
                  className="input" 
                  style={{ flex: 1 }} 
                  placeholder="Search by email prefix..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={searching || !searchQuery.trim()}>
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)', fontSize: 13 }}>
                    {searchQuery ? 'No users found.' : 'Enter an email to find users.'}
                  </div>
                ) : (
                  searchResults.map(res => (
                    <div key={res.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      {res.photoURL ? (
                        <img src={res.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-2)' }}>
                          {res.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{res.displayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{res.email}</div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => handleStartChat(res)}>Chat</button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
