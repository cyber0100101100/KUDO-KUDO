import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { ChatMessage } from '../types';

export default function ChatRoomScreen() {
  const { chatId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState<{name: string, title: string, photo: string, id: string} | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !chatId || !user) return;

    // Reset unread count for current user
    const resetUnread = async () => {
      try {
        const roomRef = doc(db, 'chats', chatId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          if (data.unreadCount && data.unreadCount[user.uid] > 0) {
            await updateDoc(roomRef, {
              [`unreadCount.${user.uid}`]: 0
            });
          }
        }
      } catch (e) {
        console.warn('Failed to reset unread count', e);
      }
    };
    resetUnread();

    // Fetch recipient info
    const fetchRecipient = async () => {
      const parts = chatId.split('_');
      const otherId = parts.find(p => p !== user.uid);
      if (!otherId) return;

      try {
        const userSnap = await getDoc(doc(db, 'users', otherId));
        if (userSnap.exists()) {
          const u = userSnap.data();
          setRecipient({
            id: otherId,
            name: u.displayName || u.name || 'زميل',
            title: u.jobTitle || (u.role === 'manager' ? 'مدير' : 'موظف'),
            photo: u.profileImageUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100"
          });
        } else if (otherId === 'manager-id') {
          // Fallback for demo manager
          setRecipient({
            id: otherId,
            name: 'أحمد المدير',
            title: 'مدير العمليات',
            photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrx6_YgVbgBetk0oZ6llBYzVNK4VTOfHOwXfEymGwa_8klRJ1KuvX7K7GXmjsSKxNQGF9fLUtibemNgKJxYLeOq4OiNqFLJ5zN5yVcr86ResMsVKVB9-DRtVjWHcL9CbFNGhjn1j6JIprMML3ss3CcAk2NnO22w2TkoZ3J28ZUx6wLNOZkGl_5BIVslf5NDdLytsf0ushIoqc48Q_RVC0ElsGTaD2xANUL81Bf0ntFoDx2eBYX5UDfPA'
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchRecipient();

    // Ensure room exists
    const ensureRoom = async () => {
      try {
        const roomRef = doc(db, 'chats', chatId);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          const parts = chatId.split('_');
          const pIds = parts.length === 2 ? parts : [user.uid, recipient?.id || 'manager-id'];
          await setDoc(roomRef, {
            participants: pIds,
            lastMessage: 'بدء المحادثة',
            lastUpdate: serverTimestamp(),
            unreadCount: pIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `chats/${chatId}`);
      }
    };

    ensureRoom();

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chatId, user, authLoading]);

  const sendMessage = async (imageUrl?: string) => {
    if ((!text.trim() && !imageUrl) || !chatId || !user || sending) return;
    
    const msg = text;
    const currentRecipient = recipient;
    setSending(true);
    setText('');

    try {
      // 1. Add message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: user.displayName,
        text: msg,
        imageUrl: imageUrl || null,
        type: imageUrl ? 'image' : 'text',
        timestamp: new Date().toISOString()
      });

      // 2. Update chat room last message
      const parts = chatId.split('_');
      const otherId = parts.find(id => id !== user.uid) || recipient?.id || 'manager-id';
      const roomRef = doc(db, 'chats', chatId);
      
      const updateData: any = {
        lastMessage: imageUrl ? 'صورة' : msg,
        lastUpdate: serverTimestamp(),
        lastSenderId: user.uid,
        [`unreadCount.${otherId}`]: increment(1)
      };

      await setDoc(roomRef, updateData, { merge: true });

      // 3. Create notification for recipient
      if (otherId) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: otherId,
            title: `رسالة جديدة من ${user.displayName || 'زميل'}`,
            message: imageUrl ? 'أرسل لك صورة' : (msg.length > 50 ? msg.substring(0, 47) + '...' : msg),
            type: 'chat',
            isRead: false,
            createdAt: serverTimestamp(),
            metadata: { chatId }
          });
        } catch (e) {
          console.warn('Notification failed', e);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}/messages`);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    setSending(true);
    try {
      const path = `chats/${chatId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await sendMessage(url);
    } catch (err) {
      console.error('File upload failed', err);
      alert('فشل رفع الصورة');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-800 h-screen flex flex-col">
      <div className="w-full bg-white h-screen relative flex flex-col shadow-sm overflow-hidden">
        <header className="flex items-center justify-between px-8 py-6 bg-white border-b border-slate-100 z-10 sticky top-0">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              محادثة
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">متصل الآن</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-8 pb-32 flex flex-col gap-6">

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col gap-2 max-w-[85%] ${msg.senderId === user?.uid ? 'self-start items-start text-right' : 'self-end items-end text-left'}`}>
              <div className={`p-5 rounded-[24px] shadow-sm text-sm font-medium leading-relaxed ${msg.senderId === user?.uid ? 'bg-[#E31E24] text-white rounded-tr-none shadow-red-100' : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200/50'}`}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded" className="max-w-full rounded-xl mb-2 cursor-pointer hover:opacity-90" onClick={() => window.open(msg.imageUrl)} />
                )}
                <p>{msg.text}</p>
              </div>
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-bold text-slate-300">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.senderId === user?.uid && (
                  <span className="material-symbols-outlined text-[14px] text-[#E31E24]">done_all</span>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </main>

        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 p-6 z-20">
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all shadow-sm border border-slate-100 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <div className="flex-1 relative">
              <input 
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#E31E24] focus:bg-white transition-all text-right shadow-inner" 
                placeholder={sending ? "جاري الإرسال..." : "اكتب رسالتك هنا..."} 
                type="text" 
                value={text}
                disabled={sending}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
            </div>
            <button 
              onClick={() => sendMessage()} 
              disabled={sending || !text.trim()}
              className="w-12 h-12 bg-[#E31E24] text-white rounded-2xl flex items-center justify-center hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-90 disabled:opacity-50"
            >
              <span className="material-symbols-outlined filled-icon">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
