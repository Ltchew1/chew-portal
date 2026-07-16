// app/dashboard/guidance/page.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import PageHeader from '../../components/PageHeader';
import { IconSparkles } from '../../components/icons';

const STARTER_PROMPTS = [
  'What does "credit utilization" actually mean?',
  "What's the difference between a secured and unsecured card?",
  'What should I have ready before applying for business credit?',
];

export default function GuidancePage() {
  const { user } = useUser();
  const firstName = user?.firstName || 'there';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // Placeholder assistant message we'll stream text into.
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', content: accumulated };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: "Something went wrong reaching CHEW Guidance. Please try again in a moment.",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      <PageHeader
        eyebrow="CHEW Guidance"
        title={`Hi ${firstName}, what can I help you understand?`}
        description="Educational guidance only — not legal or financial advice, and not a substitute for your CHEW strategist."
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          style={{
            height: '440px',
            overflowY: 'auto',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '440px' }}>
              <div className="card-icon" style={{ margin: '0 auto 14px' }}>
                <IconSparkles />
              </div>
              <p className="text-faint" style={{ marginBottom: '18px' }}>
                Ask about credit, budgeting, business credit, or anything in your CHEW plan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="btn btn-outline btn-sm"
                    style={{ textAlign: 'left' }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: m.role === 'user' ? 'var(--black-elev)' : 'rgba(200,166,60,0.07)',
                border: '1px solid var(--panel-border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                fontSize: '0.92rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content || (loading && i === messages.length - 1 ? '…' : '')}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            gap: '10px',
            padding: '16px',
            borderTop: '1px solid var(--divider)',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--black-elev)',
              border: '1px solid var(--panel-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 14px',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
            }}
          />
          <button type="submit" className="btn btn-gold" disabled={loading || !input.trim()}>
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </form>
      </div>

      <p className="text-faint" style={{ fontSize: '0.78rem', marginTop: '14px' }}>
        CHEW Guidance provides general financial education only. It does not access, dispute, or modify
        credit reports, and it isn't a substitute for advice from a licensed attorney, accountant, or
        financial advisor. For anything specific to your situation, message your CHEW strategist.
      </p>
    </>
  );
}
