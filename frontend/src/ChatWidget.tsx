import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import type { Role } from './types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const ACCENT = 'rgb(1 61 182 / 0.65)';
const BUBBLE = '#f1efec';


const QUICK_QUESTIONS: Record<Role, string[]> = {
  CUSTOMER: [
    'Где мой заказ?',
    'Какие у меня заказы?',
    'Как оформить заказ?',
    'Как отменить заказ?',
  ],
  COURIER: ['Какие заказы мне назначены?', 'Как доставить заказ?'],
  MANAGER: ['Какие заказы сейчас в работе?', 'Покажи все заказы'],
  ADMIN: ['Какие заказы сейчас в работе?', 'Покажи все заказы'],
};

export default function ChatWidget({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Здравствуйте! Выберите вопрос ниже или напишите свой.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, busy, open]);

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;

    setError('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);

    try {
      const reply = await api<string>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: String(reply ?? '') },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        setError('Помощник временно недоступен, попробуйте позже');
      } else {
        setError(
          err instanceof Error ? err.message : 'Не удалось получить ответ',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    void ask(text);
  };

  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 92,
            width: 'min(360px, calc(100vw - 32px))',
            height: 'min(520px, 70vh)',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: ACCENT,
              color: '#fff',
              fontWeight: 600,
            }}
          >
            <span>Помощник</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 20,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 15,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? ACCENT : BUBBLE,
                  color: m.role === 'user' ? '#fff' : 'inherit',
                }}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: 15,
                  background: BUBBLE,
                }}
              >
                Думаю…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div
              style={{ padding: '6px 12px', color: '#c0392b', fontSize: 13 }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '0 12px 8px',
            }}
          >
            {QUICK_QUESTIONS[role].map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => void ask(q)}
                style={{
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  background: '#fff',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 13,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderTop: '1px solid #eee',
            }}
          >
            <input
              style={{ flex: 1, minWidth: 0 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваш вопрос…"
              disabled={busy}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !input.trim()}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Закрыть AI ассистента' : 'Открыть AI ассистента'}
        className={`ai-chat-button ${open ? 'open' : ''}`}
      >
        <span className="ai-chat-icon">{open ? '×' : '💬'}</span>

        <span className="ai-chat-label">
          {open ? 'Закрыть' : 'Chat with AI'}
        </span>
      </button>
    </>
  );
}
