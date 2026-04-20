'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './StatusBadge';
import { AiGenerateButton } from '@/components/shared/AiGenerateButton';
import { CommentsList } from '@/components/comments/CommentsList';
import { formatShortDate } from '@/lib/utils';
import { ChevronDown, ChevronRight, ChevronUp, AlertTriangle, Upload, FileText, Loader2, CheckCircle2, XCircle, Trash2, Sparkles, Send } from 'lucide-react';
import { TrackUpdateDiff } from '@/components/documents/TrackUpdateDiff';
import { toast } from 'sonner';
import {
  getNextMeetingStatus,
  MEETING_STATUS_ORDER,
  type FirstMeetingScenarioMode,
  type Meeting,
  type MeetingStatus,
  type UserRole,
} from '@/types';

interface MeetingCardProps {
  meeting: Meeting;
  currentUserId: string;
  userRole: UserRole;
  defaultOpen?: boolean;
  managerName?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  preparation: 'Подготовка',
  conducted: 'Проведена',
  processed: 'Обработана',
  closed: 'Закрыта',
};

const NEXT_STATUS_BUTTON: Record<MeetingStatus, string | null> = {
  preparation: 'Отметить как проведённую',
  conducted: 'Перевести в Обработана',
  processed: 'Закрыть встречу',
  closed: null,
};

export function MeetingCard({ meeting: initialMeeting, currentUserId, userRole, defaultOpen = false, onDeleted, managerName = '' }: MeetingCardProps & { onDeleted?: (id: string) => void }) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [statusChanging, setStatusChanging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyzingTranscription, setAnalyzingTranscription] = useState(false);
  const [sendingScenarioToTelegram, setSendingScenarioToTelegram] = useState(false);
  const [scenarioModeSaving, setScenarioModeSaving] = useState(false);
  const [peopleCandidates, setPeopleCandidates] = useState<Array<{ name: string; position?: string; context?: string }>>([]);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [creatingCards, setCreatingCards] = useState(false);
  const [trackResyncing, setTrackResyncing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Record<string, unknown>>({});

  const isAssistant = userRole === 'assistant';
  const isConsultant = userRole === 'consultant';

  const assistantFields: Record<MeetingStatus, string[]> = {
    preparation: ['date', 'scenario', 'scenario_approved_at', 'first_meeting_scenario_mode', 'transcription_prompt', 'previous_context_text', 'previous_context_json'],
    conducted: ['date', 'transcription_text', 'transcription_file_url', 'previous_context_text', 'previous_context_json'],
    processed: [
      'key_facts', 'problems_signals', 'conclusions', 'strengths', 'weaknesses', 'action_plan', 'next_scenario',
      'previous_context_text', 'previous_context_json',
    ],
    closed: [],
  };

  const consultantFields: Record<MeetingStatus, string[]> = {
    preparation: ['date', 'scenario', 'scenario_approved_at', 'first_meeting_scenario_mode', 'transcription_prompt', 'previous_context_text', 'previous_context_json'],
    conducted: ['previous_context_text', 'previous_context_json'],
    processed: ['previous_context_text', 'previous_context_json'],
    closed: [],
  };

  const canEdit = (field: string): boolean => {
    if (isAssistant) return assistantFields[meeting.status]?.includes(field) ?? false;
    if (isConsultant) return consultantFields[meeting.status]?.includes(field) ?? false;
    return false;
  };

  const saveField = useCallback((field: string, value: unknown) => {
    pendingSaveRef.current[field] = value;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');

    debounceRef.current = setTimeout(async () => {
      const updates = { ...pendingSaveRef.current };
      pendingSaveRef.current = {};

      try {
        const res = await fetch(`/api/meetings/${meeting.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (res.ok) {
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 3000);
        } else {
          const data = await res.json();
          toast.error(data.error ?? 'Ошибка сохранения');
          setSaveState('error');
        }
      } catch {
        setSaveState('error');
        toast.error('Ошибка сохранения');
      }
    }, 1500);
  }, [meeting.id]);

  function updateField(field: string, value: string) {
    setMeeting((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'scenario') {
        next.scenario_approved_at = null;
      }
      return next;
    });
    if (canEdit(field)) {
      saveField(field, value);
      if (field === 'scenario') {
        saveField('scenario_approved_at', null);
      }
    }
  }

  function updateDiagnosticExtension(partial: Record<string, unknown>) {
    const next = {
      ...(meeting.diagnostic_extension ?? {}),
      ...partial,
    };
    setMeeting((prev) => ({ ...prev, diagnostic_extension: next }));
    if (canEdit('diagnostic_extension')) {
      saveField('diagnostic_extension', next);
    }
  }

  async function patchMeeting(payload: Record<string, unknown>) {
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? 'Ошибка сохранения');
    }
    setMeeting((prev) => ({ ...prev, ...data }));
  }

  async function handleStatusChange() {
    const nextStatus = getNextMeetingStatus(meeting.status);
    if (!nextStatus || statusChanging) return;

    setStatusChanging(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await res.json()) as Record<string, unknown> & {
        missing_fields?: string[];
        error?: string;
        track_sync?: {
          ok: boolean;
          skipped?: boolean;
          skip_reason?: string;
          code?: string;
          message?: string;
        };
      };

      if (!res.ok) {
        if (data.missing_fields) {
          const labels: Record<string, string> = {
            conclusions: 'Выводы',
            action_plan: 'План действий',
          };
          const fieldNames = data.missing_fields.map((f: string) => labels[f] ?? f).join(', ');
          toast.error(`Заполните обязательные поля: ${fieldNames}`);
        } else {
          toast.error(data.error ?? 'Ошибка смены статуса');
        }
        return;
      }

      const { track_sync: trackSync, ...meetingPayload } = data;
      setMeeting((prev) => ({ ...prev, ...meetingPayload }));
      toast.success(`Статус изменён: ${STATUS_LABELS[nextStatus]}`);

      if (nextStatus === 'closed' && trackSync) {
        if (trackSync.ok === false) {
          toast.error(`Трек: ${trackSync.message ?? 'ошибка синхронизации'}`, {
            description: trackSync.code === 'NOT_STRUCTURED' ? 'Откройте вкладку «Трек» и установите шаблон v1.' : undefined,
          });
        } else if (trackSync.skipped && trackSync.skip_reason === 'no_input') {
          toast.info('Трек не изменён: нет расшифровки и полей анализа для автозаполнения.');
        } else if (trackSync.skipped && trackSync.skip_reason === 'already_synced') {
          // идемпотентный повтор — без уведомления
        } else if (trackSync.ok) {
          toast.success('Трек развития (v1) обновлён', {
            description: 'См. вкладку «Трек» на карточке руководителя.',
          });
        }
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleForceTrackSync() {
    setTrackResyncing(true);
    try {
      const res = await fetch(`/api/managers/${meeting.manager_id}/track/sync-from-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id, force_resync: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка синхронизации трека', {
          description: data.code === 'NOT_STRUCTURED' ? 'Установите шаблон v1 на вкладке «Трек».' : undefined,
        });
        return;
      }
      if (data.skipped && data.skip_reason === 'no_input') {
        toast.info('Нечего добавить в трек: нет расшифровки и полей анализа.');
      } else {
        toast.success('Трек обновлён');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setTrackResyncing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Встреча №${meeting.meeting_number} удалена`);
        onDeleted?.(meeting.id);
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка удаления');
        setConfirmDelete(false);
      }
    } catch {
      toast.error('Ошибка соединения');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meeting_id', meeting.id);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка загрузки файла');
        return;
      }

      setMeeting((prev) => ({
        ...prev,
        transcription_file_url: data.file_url,
        transcription_text: data.transcription_text,
      }));
      toast.success(`Файл загружен. Извлечено ${data.chars_count} символов`);
    } catch {
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  }

  async function handleApproveScenario() {
    try {
      await patchMeeting({ scenario_approved_at: new Date().toISOString() });
      toast.success('Сценарий утверждён');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения';
      toast.error(message);
    }
  }

  async function handleSendScenarioToTelegram() {
    if (!meeting.scenario_approved_at) {
      toast.error('Сначала утвердите сценарий');
      return;
    }
    setSendingScenarioToTelegram(true);
    try {
      const res = await fetch('/api/telegram/send-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка отправки в Telegram');
        return;
      }
      toast.success('Сценарий отправлен в Telegram');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSendingScenarioToTelegram(false);
    }
  }

  async function handleScenarioModeChange(mode: FirstMeetingScenarioMode) {
    const previousMode = meeting.first_meeting_scenario_mode ?? 'ai';
    if (previousMode === mode || scenarioModeSaving) {
      return;
    }
    setScenarioModeSaving(true);
    setMeeting((prev) => ({ ...prev, first_meeting_scenario_mode: mode }));
    try {
      await patchMeeting({ first_meeting_scenario_mode: mode });
      toast.success(mode === 'manual' ? 'Режим: свой сценарий' : 'Режим: генерация AI');
    } catch (err) {
      setMeeting((prev) => ({ ...prev, first_meeting_scenario_mode: previousMode }));
      const message = err instanceof Error ? err.message : 'Ошибка сохранения';
      toast.error(message);
    } finally {
      setScenarioModeSaving(false);
    }
  }

  async function handleAnalyzeTranscription() {
    if (!meeting.transcription_text) {
      toast.error('Сначала добавьте текст расшифровки');
      return;
    }
    setAnalyzingTranscription(true);
    try {
      const res = await fetch('/api/ai/analyze-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка анализа');
        return;
      }

      const {
        key_facts,
        problems_signals,
        conclusions,
        strengths,
        weaknesses,
        action_plan,
        next_scenario,
        diagnostic_extension,
        people_candidates,
      } = data;
      setMeeting((prev) => ({
        ...prev,
        key_facts,
        problems_signals,
        conclusions,
        strengths,
        weaknesses,
        action_plan,
        next_scenario,
        diagnostic_extension: diagnostic_extension ?? prev.diagnostic_extension,
      }));
      toast.success('Расшифровка обработана — поля заполнены');

      if (people_candidates?.length > 0) {
        setPeopleCandidates(people_candidates);
        setSelectedPeople(new Set(people_candidates.map((p: { name: string }) => p.name)));
      }
    } catch {
      toast.error('Ошибка соединения с AI');
    } finally {
      setAnalyzingTranscription(false);
    }
  }

  async function handleConfirmPeople() {
    const toCreate = peopleCandidates.filter((p) => selectedPeople.has(p.name));
    if (toCreate.length === 0) {
      setPeopleCandidates([]);
      return;
    }
    setCreatingCards(true);
    try {
      const res = await fetch('/api/managers/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meeting.id,
          people: toCreate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка создания карточек');
        return;
      }
      const names = (data.created as Array<{ name: string }>).map((c) => c.name).join(', ');
      toast.success(`Карточки созданы: ${names}`);
      setPeopleCandidates([]);
      setSelectedPeople(new Set());
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setCreatingCards(false);
    }
  }

  const nextStatus = getNextMeetingStatus(meeting.status);
  const nextButtonLabel = NEXT_STATUS_BUTTON[meeting.status];
  const isFirstMeeting = meeting.meeting_number === 1;
  const firstMeetingMode = meeting.first_meeting_scenario_mode ?? 'ai';
  const showScenarioGenerator = !isFirstMeeting || firstMeetingMode === 'ai';
  const canGenerateScenario = isFirstMeeting || !!(meeting.previous_context_text?.trim());

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
      {/* Header — div вместо button, чтобы не было button внутри button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Встреча №{meeting.meeting_number}
              {meeting.date && <span className="text-gray-500 dark:text-gray-400 font-normal"> · {formatShortDate(meeting.date)}</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveState === 'saving' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Сохранение..." />}
          {saveState === 'saved' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          {saveState === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          <StatusBadge status={meeting.status} />
          {isAssistant && (
            confirmDelete ? (
              <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Удаляю...' : 'Да, удалить'}
                </button>
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => setConfirmDelete(false)}
                >
                  Отмена
                </button>
              </span>
            ) : (
              <button
                className="p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors rounded"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                title="Удалить встречу"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-6 space-y-5 border-t border-gray-100 dark:border-gray-800">
          {/* Status bar */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              {MEETING_STATUS_ORDER.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300 dark:text-gray-600">→</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s === meeting.status ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-400 dark:text-gray-600'}`}>
                    {STATUS_LABELS[s]}
                  </span>
                </span>
              ))}
            </div>
            {nextStatus && nextButtonLabel && isAssistant && meeting.status !== 'closed' && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-500 text-white border-transparent hover:scale-[1.01] transition-all duration-150 shadow-sm"
                onClick={handleStatusChange}
                disabled={statusChanging}
              >
                {statusChanging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {nextButtonLabel}
              </Button>
            )}
          </div>

          <Separator />

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Дата встречи</Label>
            {canEdit('date') ? (
              <Input
                type="date"
                value={meeting.date ?? ''}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-40"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">{meeting.date ? formatShortDate(meeting.date) : '—'}</p>
            )}
          </div>

          {/* Context + preparation: на первой встрече сначала подготовка, потом вводной контекст */}
          {(() => {
            const contextVisible =
              (meeting.previous_context_text != null && meeting.previous_context_text !== '') ||
              canEdit('previous_context_text');
            const contextSection = contextVisible ? (
              <ExpandableField
                label={
                  <div className="flex items-center gap-2">
                    <span>{isFirstMeeting ? 'Вводной контекст' : 'Контекст из предыдущих встреч'}</span>
                    {meeting.context_from_unclosed && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Из незакрытой встречи
                      </span>
                    )}
                  </div>
                }
                hint={
                  isFirstMeeting ? (
                    <span>
                      Первая встреча с руководителем: прошлых сессий в треке ещё нет. Базовый профиль — в карточке; сюда можно добавить факты до старта или оставить пустым и сгенерировать сценарий по профилю.
                    </span>
                  ) : undefined
                }
                placeholder={
                  isFirstMeeting
                    ? 'Необязательно: факты до первой сессии. Можно оставить пустым.'
                    : 'Текст контекста из предыдущих встреч…'
                }
                value={meeting.previous_context_text ?? ''}
                editable={canEdit('previous_context_text')}
                onChange={(v) => updateField('previous_context_text', v)}
              />
            ) : null;

            const preparationSection =
              meeting.scenario || meeting.transcription_prompt || meeting.status === 'preparation' ? (
                <>
                  {isFirstMeeting && (
                    <div className="space-y-2">
                      <Label>Способ подготовки сценария</Label>
                      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 gap-1 bg-gray-50 dark:bg-gray-800/40">
                        <Button
                          size="sm"
                          variant={firstMeetingMode === 'manual' ? 'default' : 'ghost'}
                          className="h-7 text-xs"
                          onClick={() => void handleScenarioModeChange('manual')}
                          disabled={!canEdit('first_meeting_scenario_mode') || scenarioModeSaving}
                        >
                          Свой сценарий
                        </Button>
                        <Button
                          size="sm"
                          variant={firstMeetingMode === 'ai' ? 'default' : 'ghost'}
                          className="h-7 text-xs"
                          onClick={() => void handleScenarioModeChange('ai')}
                          disabled={!canEdit('first_meeting_scenario_mode') || scenarioModeSaving}
                        >
                          Сгенерировать AI
                        </Button>
                      </div>
                    </div>
                  )}
                  <MeetingTextField
                    label="Сценарий встречи"
                    value={meeting.scenario ?? ''}
                    editable={canEdit('scenario')}
                    markdown={!canEdit('scenario')}
                    richMarkdownEdit={canEdit('scenario')}
                    onChange={(v) => updateField('scenario', v)}
                    aiButton={canEdit('scenario') ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {showScenarioGenerator && (
                          <AiGenerateButton
                            endpoint="/api/ai/generate-scenario"
                            meetingId={meeting.id}
                            onSuccess={(v) => updateField('scenario', v)}
                            label="Сгенерировать"
                            disabled={!canGenerateScenario}
                          />
                        )}
                    {meeting.scenario && !meeting.scenario_approved_at && (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-500"
                          onClick={handleApproveScenario}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Утвердить
                        </Button>
                      </>
                    )}
                    {meeting.scenario_approved_at && (
                      <>
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Утверждён
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-sky-500 hover:bg-sky-400 text-white"
                          onClick={handleSendScenarioToTelegram}
                          disabled={sendingScenarioToTelegram}
                        >
                          {sendingScenarioToTelegram ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Отправить в Telegram
                        </Button>
                      </>
                    )}
                  </div>
                ) : undefined}
              />

              <MeetingTextField
                label="Промпт для расшифровки"
                value={meeting.transcription_prompt ?? ''}
                editable={canEdit('transcription_prompt')}
                markdown={!canEdit('transcription_prompt')}
                richMarkdownEdit={canEdit('transcription_prompt')}
                onChange={(v) => updateField('transcription_prompt', v)}
                aiButton={canEdit('transcription_prompt') ? (
                  <AiGenerateButton
                    endpoint="/api/ai/generate-prompt"
                    meetingId={meeting.id}
                    onSuccess={(v) => updateField('transcription_prompt', v)}
                    label="Сгенерировать"
                    disabled={!meeting.scenario}
                  />
                ) : undefined}
              />
            </>
              ) : null;

            return (
              <>
                {!isFirstMeeting && contextSection}
                {preparationSection}
                {isFirstMeeting && contextSection}
              </>
            );
          })()}

          {/* Post-meeting fields */}
          {(meeting.status === 'conducted' || meeting.status === 'processed' || meeting.status === 'closed') && (
            <>
              <Separator />
              {/* Transcription — hidden for closed meetings that have analysis */}
              {meeting.status !== 'closed' && <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Расшифровка</Label>
                  {canEdit('transcription_file_url') && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".txt,.docx"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                      />
                      <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                        {uploadingFile ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {uploadingFile ? 'Загрузка...' : 'Загрузить файл (.txt, .docx)'}
                      </span>
                    </label>
                  )}
                </div>
                {meeting.transcription_file_url && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FileText className="w-3.5 h-3.5" />
                    <a href={meeting.transcription_file_url} target="_blank" rel="noreferrer" className="hover:underline">
                      Скачать файл
                    </a>
                  </div>
                )}
                <MeetingTextField
                  label=""
                  value={meeting.transcription_text ?? ''}
                  editable={canEdit('transcription_text')}
                  onChange={(v) => updateField('transcription_text', v)}
                  rows={6}
                />
              </div>}

              {isAssistant && meeting.transcription_text && (meeting.status === 'conducted' || meeting.status === 'processed') && (
                <>
                  <Button
                    className="w-full gap-2 bg-violet-600 hover:bg-violet-500 text-white border-transparent hover:scale-[1.01] transition-all duration-150 shadow-sm"
                    onClick={handleAnalyzeTranscription}
                    disabled={analyzingTranscription}
                  >
                    {analyzingTranscription ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {analyzingTranscription ? 'Анализирую расшифровку...' : 'Обработать расшифровку'}
                  </Button>
                  <TrackUpdateDiff
                    meetingId={meeting.id}
                    managerId={meeting.manager_id}
                    managerName={managerName}
                  />

                  {/* People candidates dialog */}
                  {peopleCandidates.length > 0 && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Найдены новые люди в расшифровке</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Выберите кому создать карточки</p>
                      </div>
                      <div className="space-y-2">
                        {peopleCandidates.map((p) => (
                          <label key={p.name} className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                              checked={selectedPeople.has(p.name)}
                              onChange={(e) => {
                                setSelectedPeople((prev) => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(p.name) : next.delete(p.name);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                              {(p.position || p.context) && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{[p.position, p.context].filter(Boolean).join(' · ')}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleConfirmPeople}
                          disabled={creatingCards || selectedPeople.size === 0}
                          className="bg-blue-600 hover:bg-blue-500 text-white"
                        >
                          {creatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                          {creatingCards ? 'Создаю...' : `Создать (${selectedPeople.size})`}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPeopleCandidates([]); setSelectedPeople(new Set()); }}
                        >
                          Пропустить
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Analysis fields */}
          {(meeting.status === 'processed' || meeting.status === 'closed') && (
            <>
              <Separator />
              <div className="grid md:grid-cols-2 gap-4">
                <MeetingTextField
                  label="Ключевые факты"
                  value={meeting.key_facts ?? ''}
                  editable={canEdit('key_facts')}
                  onChange={(v) => updateField('key_facts', v)}
                />
                <MeetingTextField
                  label="Проблемы и сигналы"
                  value={meeting.problems_signals ?? ''}
                  editable={canEdit('problems_signals')}
                  onChange={(v) => updateField('problems_signals', v)}
                />
              </div>

              <MeetingTextField
                label={<span>Выводы <span className="text-red-400">*</span></span>}
                value={meeting.conclusions ?? ''}
                editable={canEdit('conclusions')}
                onChange={(v) => updateField('conclusions', v)}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <MeetingTextField
                  label="Сильные стороны"
                  value={meeting.strengths ?? ''}
                  editable={canEdit('strengths')}
                  onChange={(v) => updateField('strengths', v)}
                />
                <MeetingTextField
                  label="Слабые стороны"
                  value={meeting.weaknesses ?? ''}
                  editable={canEdit('weaknesses')}
                  onChange={(v) => updateField('weaknesses', v)}
                />
              </div>

              <MeetingTextField
                label={<span>План действий <span className="text-red-400">*</span></span>}
                value={meeting.action_plan ?? ''}
                editable={canEdit('action_plan')}
                onChange={(v) => updateField('action_plan', v)}
              />

              <MeetingTextField
                label="Сценарий следующей встречи"
                value={meeting.next_scenario ?? ''}
                editable={canEdit('next_scenario')}
                markdown={!canEdit('next_scenario')}
                richMarkdownEdit={canEdit('next_scenario')}
                onChange={(v) => updateField('next_scenario', v)}
              />

              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Диагностика и межсессионный фокус
                </h4>
                <MeetingTextField
                  label="Установки консультанта (тезис | комментарий | статус)"
                  value={formatInstallations(meeting.diagnostic_extension?.installations)}
                  editable={canEdit('diagnostic_extension')}
                  onChange={(v) => updateDiagnosticExtension({ installations: parseInstallations(v) })}
                  rows={4}
                />
                <MeetingTextField
                  label="Паттерны поведения (название | механика | статус)"
                  value={formatPatterns(meeting.diagnostic_extension?.behavior_patterns)}
                  editable={canEdit('diagnostic_extension')}
                  onChange={(v) => updateDiagnosticExtension({ behavior_patterns: parsePatterns(v) })}
                  rows={4}
                />
                <MeetingTextField
                  label="Маркеры регресса (по строке)"
                  value={(meeting.diagnostic_extension?.regression_markers ?? []).join('\n')}
                  editable={canEdit('diagnostic_extension')}
                  onChange={(v) => updateDiagnosticExtension({ regression_markers: splitLines(v) })}
                  rows={3}
                />
                <MeetingTextField
                  label="Гипотезы для проверки (по строке)"
                  value={(meeting.diagnostic_extension?.verification_hypotheses ?? []).join('\n')}
                  editable={canEdit('diagnostic_extension')}
                  onChange={(v) => updateDiagnosticExtension({ verification_hypotheses: splitLines(v) })}
                  rows={3}
                />
                <MeetingTextField
                  label="Структурированные договорённости (текст | дедлайн | статус)"
                  value={formatCommitments(meeting.diagnostic_extension?.commitments)}
                  editable={canEdit('diagnostic_extension')}
                  onChange={(v) => updateDiagnosticExtension({ commitments: parseCommitments(v) })}
                  rows={4}
                />
              </div>

              {meeting.status === 'closed' && isAssistant && (
                <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/25 px-4 py-3 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    При закрытии встречи трек v1 на вкладке «Трек» обновляется автоматически. Если после закрытия
                    менялись расшифровка или поля анализа — запустите повторную синхронизацию.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-violet-300 text-violet-900 dark:text-violet-100"
                    disabled={trackResyncing}
                    onClick={handleForceTrackSync}
                  >
                    {trackResyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                    Повторить синхронизацию трека
                  </Button>
                </div>
              )}
            </>
          )}

          <Separator />

          {/* Comments */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Комментарии</h4>
            <CommentsList
              targetType="meeting"
              targetId={meeting.id}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatInstallations(
  installations?: Array<{ thesis?: string; notes?: string; follow_up_status?: string }>
): string {
  if (!installations?.length) return '';
  return installations
    .map((item) => [item.thesis, item.notes, item.follow_up_status].filter(Boolean).join(' | '))
    .join('\n');
}

function parseInstallations(value: string): Array<{ id: string; thesis: string; notes?: string; follow_up_status?: string }> {
  return splitLines(value).map((line, i) => {
    const [thesis = '', notes = '', followUp = ''] = line.split('|').map((part) => part.trim());
    return {
      id: `inst-${i + 1}`,
      thesis,
      notes: notes || undefined,
      follow_up_status: followUp || undefined,
    };
  });
}

function formatPatterns(
  patterns?: Array<{ name?: string; mechanics?: string; status?: string }>
): string {
  if (!patterns?.length) return '';
  return patterns
    .map((item) => [item.name, item.mechanics, item.status].filter(Boolean).join(' | '))
    .join('\n');
}

function parsePatterns(value: string): Array<{ id: string; name: string; mechanics: string; status: string }> {
  return splitLines(value).map((line, i) => {
    const [name = '', mechanics = '', status = ''] = line.split('|').map((part) => part.trim());
    return {
      id: `pat-${i + 1}`,
      name,
      mechanics,
      status,
    };
  });
}

function formatCommitments(
  commitments?: Array<{ text?: string; due?: string; status?: string }>
): string {
  if (!commitments?.length) return '';
  return commitments
    .map((item) => [item.text, item.due, item.status].filter(Boolean).join(' | '))
    .join('\n');
}

function parseCommitments(value: string): Array<{ text: string; due?: string; status?: string }> {
  return splitLines(value).map((line) => {
    const [text = '', due = '', status = ''] = line.split('|').map((part) => part.trim());
    return {
      text,
      due: due || undefined,
      status: status || undefined,
    };
  });
}

const COLLAPSE_THRESHOLD = 300;

interface ExpandableFieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  placeholder?: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

function ExpandableField({ label, hint, placeholder, value, editable = false, onChange }: ExpandableFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = value.length > COLLAPSE_THRESHOLD;
  const resolvedPlaceholder = placeholder ?? 'Текст контекста из предыдущих встреч…';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</Label>
        {needsCollapse && !editable && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors shrink-0"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" />Свернуть</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" />Развернуть</>
            )}
          </button>
        )}
      </div>
      {hint ? <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed -mt-0.5">{hint}</p> : null}
      {editable && onChange ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="text-sm resize-y min-h-[120px] font-mono"
          placeholder={resolvedPlaceholder}
        />
      ) : (
        <>
          <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap relative ${needsCollapse && !expanded ? 'max-h-24 overflow-hidden' : ''}`}>
            {value || '—'}
            {needsCollapse && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50 dark:from-gray-800 to-transparent rounded-b-lg" />
            )}
          </div>
          {needsCollapse && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-0.5"
            >
              Показать полностью
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface MeetingTextFieldProps {
  label: React.ReactNode;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  rows?: number;
  aiButton?: React.ReactNode;
  markdown?: boolean;
  /** В режиме редактирования: сначала форматированный просмотр, кнопка переключает на сырой Markdown */
  richMarkdownEdit?: boolean;
}

function MarkdownView({ value }: { value: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-table:text-sm prose-th:border prose-td:border prose-table:border-collapse">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}

function MeetingTextField({
  label,
  value,
  editable,
  onChange,
  rows = 4,
  aiButton,
  markdown = false,
  richMarkdownEdit = false,
}: MeetingTextFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const [rawMarkdownEdit, setRawMarkdownEdit] = useState(false);

  useEffect(() => {
    if (!editable) setRawMarkdownEdit(false);
  }, [editable]);

  const useRichToggle = Boolean(editable && richMarkdownEdit);
  const showFormattedWhileEditing = useRichToggle && !rawMarkdownEdit && value.trim().length > 0;
  const needsCollapse = !editable && value.length > COLLAPSE_THRESHOLD;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label && <Label className="text-sm font-medium text-gray-700">{label}</Label>}
        <div className="flex items-center gap-2">
          {needsCollapse && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="w-3.5 h-3.5" />Свернуть</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" />Развернуть</>
              )}
            </button>
          )}
          {aiButton}
        </div>
      </div>
      {editable && showFormattedWhileEditing ? (
        <div className="space-y-2">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 min-h-[60px]">
            <MarkdownView value={value} />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRawMarkdownEdit(true)}>
            Редактировать (Markdown)
          </Button>
        </div>
      ) : null}
      {editable && (!showFormattedWhileEditing) ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="text-sm resize-y font-mono"
            placeholder="Текст в формате Markdown…"
          />
          {useRichToggle && value.trim().length > 0 ? (
            <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={() => setRawMarkdownEdit(false)}>
              Просмотр с форматированием
            </Button>
          ) : null}
        </div>
      ) : null}
      {!editable ? (
        value ? (
          <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 relative ${needsCollapse && !expanded ? 'max-h-24 overflow-hidden' : 'min-h-[60px]'} ${markdown ? '' : 'whitespace-pre-wrap'}`}>
            {markdown ? <MarkdownView value={value} /> : value}
            {needsCollapse && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50 dark:from-gray-800 to-transparent rounded-b-lg" />
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">—</p>
        )
      ) : null}
      {needsCollapse && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-0.5"
        >
          Показать полностью
        </button>
      )}
    </div>
  );
}
