import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { fetchChatThreads, type ChatThread } from '@/services/chat-api';

const POLL_MS = 30000;

type ChatContextValue = {
  threads: ChatThread[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setThreads([]);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await fetchChatThreads(token);
      setThreads(rows);
    } catch {
      /* keep last good list */
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setThreads([]);
      return;
    }
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [token, refresh]);

  const unreadCount = useMemo(
    () => threads.reduce((sum, t) => sum + (Number(t.unread) || 0), 0),
    [threads],
  );

  const value = useMemo(
    () => ({ threads, unreadCount, isLoading, refresh }),
    [threads, unreadCount, isLoading, refresh],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
