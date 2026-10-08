import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import type { Role } from './types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const ACCENT = 'rgb(1 61 182 / 0.65)';
const BUBBLE = 'rgba(241, 239, 236, 0.62)';

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
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, [messages, busy, open]);

  const ask = async (raw: string) => {
    const text = raw.trim();

    if (!text || busy) return;

    setError('');

    setMessages((m) => [
      ...m,
      {
        role: 'user',
        text,
      },
    ]);

    setBusy(true);

    try {
      const reply = await api<string>('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
        }),
      });

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: String(reply ?? ''),
        },
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

            display: 'flex',
            flexDirection: 'column',

            overflow: 'hidden',

            background: 'rgba(255, 255, 255, 0.42)',

            border: '1px solid rgba(255, 255, 255, 0.72)',
            borderRadius: 22,

            boxShadow:
              '0 20px 60px rgba(31, 29, 26, 0.16), inset 0 1px 0 rgba(255,255,255,.75)',

            backdropFilter: 'blur(24px) saturate(125%)',
            WebkitBackdropFilter: 'blur(24px) saturate(125%)',

            zIndex: 1000,
          }}
        >
          {/* ================= HEADER ================= */}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',

              padding: '13px 16px',

              background: 'rgba(1, 61, 182, 0.72)',

              color: '#fff',

              borderBottom: '1px solid rgba(255,255,255,.2)',

              boxShadow: '0 4px 18px rgba(1,61,182,.12)',

              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',

              fontWeight: 650,
            }}
          >
            <span>AI помощник</span>

            <button
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
              style={{
                width: 30,
                height: 30,

                display: 'grid',
                placeItems: 'center',

                background: 'rgba(255,255,255,.12)',

                border: '1px solid rgba(255,255,255,.18)',

                borderRadius: 9,

                color: '#fff',
                fontSize: 20,

                cursor: 'pointer',
                lineHeight: 1,

                transition: 'all .2s ease',
              }}
            >
              ×
            </button>
          </div>

          {/* ================= MESSAGES ================= */}

          <div
            style={{
              flex: 1,

              overflowY: 'auto',

              padding: 12,

              display: 'flex',
              flexDirection: 'column',
              gap: 8,

              background:
                'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.02))',
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',

                  maxWidth: '85%',

                  padding: '8px 12px',

                  borderRadius:
                    m.role === 'user'
                      ? '15px 15px 5px 15px'
                      : '15px 15px 15px 5px',

                  whiteSpace: 'pre-wrap',

                  background: m.role === 'user' ? ACCENT : BUBBLE,

                  color: m.role === 'user' ? '#fff' : '#27231f',

                  border:
                    m.role === 'user'
                      ? '1px solid rgba(255,255,255,.14)'
                      : '1px solid rgba(255,255,255,.58)',

                  boxShadow: '0 4px 14px rgba(31,29,26,.05)',

                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
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

                  borderRadius: '15px 15px 15px 5px',

                  background: BUBBLE,

                  color: '#81776f',

                  border: '1px solid rgba(255,255,255,.58)',

                  boxShadow: '0 4px 14px rgba(31,29,26,.05)',

                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                Думаю…
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ================= ERROR ================= */}

          {error && (
            <div
              style={{
                margin: '0 12px 4px',

                padding: '7px 10px',

                borderRadius: 10,

                background: 'rgba(253, 236, 236, .58)',

                border: '1px solid rgba(217,83,79,.2)',

                color: '#c0392b',

                fontSize: 13,

                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {error}
            </div>
          )}

          {/* ================= QUICK QUESTIONS ================= */}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,

              padding: '6px 12px 10px',

              /*
               * ВАЖНО:
               * Никакого background: #fff.
               * Блок полностью прозрачный.
               */
              background: 'transparent',

              position: 'relative',
              zIndex: 2,
            }}
          >
            {QUICK_QUESTIONS[role].map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => void ask(q)}
                className="ai-quick-question"
                style={{
                  border: '1px solid rgba(1, 61, 182, 0.35)',
                  color: ACCENT,
                  background: 'rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 999,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                  boxShadow:
                    '0 2px 10px rgba(31,29,26,.04), inset 0 1px 0 rgba(255,255,255,.45)',
                  transition: 'all .2s ease',
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* ================= INPUT ================= */}

          <form
            onSubmit={onSubmit}
            style={{
              display: 'flex',
              gap: 8,

              padding: '10px 12px 12px',

              background: 'rgba(255,255,255,.10)',

              borderTop: '1px solid rgba(255,255,255,.35)',

              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <input
              style={{
                flex: 1,
                minWidth: 0,

                padding: '10px 12px',

                border: '1px solid rgba(173,157,143,.22)',

                borderRadius: 12,

                background: 'rgba(255,255,255,.34)',

                color: '#1f1d1a',

                outline: 'none',

                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваш вопрос…"
              disabled={busy}
            />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !input.trim()}
              style={{
                minWidth: 46,
                padding: '0 13px',
                borderRadius: 12,
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* ================= AI BUTTON ================= */}

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
