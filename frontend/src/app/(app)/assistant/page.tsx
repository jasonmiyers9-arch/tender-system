'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useTenderMatches } from '@/lib/hooks/useTenders';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AdvisorSnapshot = {
  overallScore: number;
  tenderId: string | null;
  tenderTitle: string | null;
  tenderMatchScore: number | null;
  isEligible: boolean | null;
  missingDocuments: string[];
};

const initialMessages: ChatMessage[] = [{
  role: 'assistant',
  content: 'Ask me about your compliance score, missing documents, or select a tender to get a specific action plan.',
}];

export default function ComplianceAssistantPage() {
  const token = useAppStore((state) => state.token);
  const tendersQuery = useTenderMatches();
  const tenders = useMemo(() => tendersQuery.data ?? [], [tendersQuery.data]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [question, setQuestion] = useState('');
  const [snapshot, setSnapshot] = useState<AdvisorSnapshot | null>(null);
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const selectedTender = useMemo(
    () => tenders.find((tender) => tender.id === selectedTenderId) ?? null,
    [selectedTenderId, tenders],
  );

  useEffect(() => {
    const requestedTenderId = new URLSearchParams(window.location.search).get('tenderId');
    if (requestedTenderId) setSelectedTenderId(requestedTenderId);
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  function resetConversation(tenderTitle?: string) {
    setMessages([{
      role: 'assistant',
      content: tenderTitle
        ? `I’m ready to assess your compliance position for “${tenderTitle}”. Ask what is missing or what to address first.`
        : initialMessages[0].content,
    }]);
    setQuestion('');
    setSnapshot(null);
    setModel('');
    setError('');
  }

  function changeTender(tenderId: string) {
    setSelectedTenderId(tenderId);
    resetConversation(tenders.find((tender) => tender.id === tenderId)?.title);
  }

  async function askAdvisor(event?: FormEvent) {
    event?.preventDefault();
    const prompt = question.trim();
    if (!prompt || loading) return;

    const priorMessages = messages;
    setMessages([...priorMessages, { role: 'user', content: prompt }]);
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: prompt,
          tenderId: selectedTenderId || null,
          messages: priorMessages.slice(-8),
        }),
      });
      const result = await response.json() as {
        answer?: string;
        model?: string;
        detail?: string;
        snapshot?: AdvisorSnapshot;
      };
      if (!response.ok) throw new Error(result.detail ?? `Request failed (${response.status})`);

      setMessages((current) => [...current, { role: 'assistant', content: result.answer ?? 'No answer returned.' }]);
      setSnapshot(result.snapshot ?? null);
      setModel(result.model ?? 'unknown');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to contact the compliance advisor');
    } finally {
      setLoading(false);
    }
  }

  function setSuggestedQuestion(value: string) {
    setQuestion(value);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="AI Compliance Advisor"
        subtitle="Understand your compliance position and what you need for a specific tender."
        icon={<Bot size={22} />}
        iconColor="#7C3AED"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Tender context</h3>}>
            <label className="mb-2 block text-xs font-medium text-[--color-text-secondary]" htmlFor="advisor-tender">
              Select a tender for specific advice
            </label>
            <select
              id="advisor-tender"
              value={selectedTenderId}
              onChange={(event) => changeTender(event.target.value)}
              disabled={tendersQuery.isLoading || tendersQuery.isError}
              className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text-primary]"
            >
              <option value="">{tendersQuery.isLoading ? 'Loading tenders...' : 'Company compliance only'}</option>
              {tenders.map((tender) => (
                <option key={tender.id} value={tender.id}>{tender.title}</option>
              ))}
            </select>
            {tendersQuery.isError && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[--color-danger]">
                <span>Unable to load tender context.</span>
                <button type="button" className="font-semibold underline" onClick={() => tendersQuery.refetch()}>Retry</button>
              </div>
            )}
            {selectedTender && (
              <p className="mt-3 text-xs leading-relaxed text-[--color-text-muted]">
                {selectedTender.organization} · closes {selectedTender.deadline}
              </p>
            )}
          </Card>

          <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Current assessment</h3>}>
            {snapshot ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[--color-text-muted]">Overall compliance score</p>
                  <p className="text-3xl font-bold text-[--color-text-primary]">{snapshot.overallScore}%</p>
                </div>
                {snapshot.tenderMatchScore !== null && (
                  <div>
                    <p className="text-xs text-[--color-text-muted]">Tender match score</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-2xl font-bold text-[--color-text-primary]">{snapshot.tenderMatchScore}%</p>
                      <Badge variant={snapshot.isEligible ? 'success' : 'warning'} size="sm">
                        {snapshot.isEligible ? 'Eligible' : 'Action needed'}
                      </Badge>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[--color-text-muted]">Missing document categories</p>
                  <p className="mt-1 text-sm text-[--color-text-primary]">
                    {snapshot.missingDocuments.length ? snapshot.missingDocuments.join(', ') : 'None identified'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[--color-text-muted]">Ask a question to calculate the latest assessment.</p>
            )}
          </Card>

          <Card>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-[--color-success]" size={18} />
              <p className="text-xs leading-relaxed text-[--color-text-muted]">
                Scores come from Tender Guard Pro’s rules-based compliance engine. AI explains the result but does not guarantee tender eligibility or an award.
              </p>
            </div>
          </Card>
        </div>

        <Card
          className="flex min-h-[650px] flex-col lg:col-span-8"
          header={(
            <div className="flex w-full items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[--color-text-primary]">Advisor conversation</h2>
                <p className="mt-0.5 max-w-xl truncate text-xs text-[--color-text-muted]">{selectedTender?.title ?? 'Company-wide compliance'}</p>
              </div>
              <button
                type="button"
                onClick={() => resetConversation(selectedTender?.title)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[--color-border] text-[--color-text-muted] hover:text-[--color-text-primary]"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          )}
        >
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-[--color-primary]/12 border border-[--color-primary]/20 text-[--color-text-primary]'
                    : 'border border-[--color-border] bg-[--color-bg] text-[--color-text-primary]'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[--color-text-muted]">
                <Sparkles size={15} className="animate-pulse" /> Reviewing your compliance data...
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>

          <div className="mt-5 border-t border-[--color-border] pt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                'What is my current compliance score?',
                'Which documents should I fix first?',
                'What do I need to qualify for this tender?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setSuggestedQuestion(suggestion)}
                  className="rounded-full border border-[--color-border] px-3 py-1.5 text-xs text-[--color-text-secondary] hover:border-[--color-primary] hover:text-[--color-primary]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form onSubmit={askAdvisor} className="flex items-end gap-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder="Ask about your score, documents, or selected tender..."
                rows={3}
                maxLength={2000}
                className="min-h-[76px] flex-1 resize-none rounded-xl border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text-primary] outline-none focus:border-[--color-primary]"
              />
              <Button type="submit" loading={loading} disabled={!question.trim()} leftIcon={<Send size={15} />}>
                Send
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-[--color-danger]">{error}</p>}
            {model && <p className="mt-2 text-[11px] text-[--color-text-muted]">Assessment source: {model === 'rules-based' ? 'Tender Guard Pro rules engine' : model}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
