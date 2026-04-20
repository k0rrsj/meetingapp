// ============================================================
// Meeting Intelligence App — TypeScript Types
// ============================================================

export type UserRole = 'consultant' | 'assistant';
export type CompanyStatus = 'active' | 'completed';
export type ManagerStatus = 'in_progress' | 'completed';
export type WorkType = 'one_to_one' | 'diagnostics';
export type MeetingStatus = 'preparation' | 'conducted' | 'processed' | 'closed';
export type MeetingType = 'one_to_one' | 'diagnostics';
export type FirstMeetingScenarioMode = 'manual' | 'ai';
export type CommentTarget = 'manager' | 'meeting';

// Status transition order
export const MEETING_STATUS_ORDER: MeetingStatus[] = [
  'preparation',
  'conducted',
  'processed',
  'closed',
];

export function getNextMeetingStatus(current: MeetingStatus): MeetingStatus | null {
  const idx = MEETING_STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === MEETING_STATUS_ORDER.length - 1) return null;
  return MEETING_STATUS_ORDER[idx + 1];
}

// ============================================================
// Database entities
// ============================================================

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

export interface Manager {
  id: string;
  company_id: string;
  name: string;
  position: string | null;
  role_in_team: string | null;
  context: string | null;
  director_request: string | null;
  strengths: string | null;
  weaknesses: string | null;
  work_type: WorkType;
  status: ManagerStatus;
  consultant_comments: string | null;
  ai_rules: string | null;
  dynamics_snapshot: DynamicsSnapshot | null;
  dynamics_snapshot_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CommitmentStatus = 'promised' | 'completed' | 'postponed' | 'ignored';

export interface DynamicsSnapshot {
  installations?: Array<{
    meeting_number?: number;
    thesis?: string;
    status?: string;
    evidence?: string;
  }>;
  patterns?: Array<{
    name?: string;
    mechanics?: string;
    was?: string;
    became?: string;
    dynamics?: string;
    evidence?: string;
  }>;
  commitments?: Array<{
    text: string;
    status: CommitmentStatus;
    source_meeting?: number;
    due?: string;
    comment?: string;
  }>;
  summary?: Partial<Record<CommitmentStatus, number>>;
}

export interface PreviousContextJson {
  meetingId: string;
  meetingNumber: number;
  date: string | null;
  conclusions: string | null;
  actionPlan: string | null;
  problemsSignals: string | null;
  consultantComments: string[];
  managerProfileComments: string[];
}

export type InstallationStatus =
  | 'accepted_intellectually'
  | 'applied_in_action'
  | 'normalized'
  | 'not_accepted';

export type BehaviorPatternDynamics = 'strengthened' | 'weakened' | 'counterexample' | 'unchanged';

export interface DiagnosticInstallation {
  id: string;
  thesis: string;
  notes?: string;
  follow_up_status?: InstallationStatus;
}

export interface DiagnosticBehaviorPattern {
  id: string;
  name: string;
  mechanics: string;
  status: string;
}

export interface DiagnosticCommitment {
  text: string;
  due?: string;
  status?: 'promised' | 'completed' | 'postponed' | 'ignored';
}

export interface DiagnosticExtension {
  installations?: DiagnosticInstallation[];
  behavior_patterns?: DiagnosticBehaviorPattern[];
  regression_markers?: string[];
  verification_hypotheses?: string[];
  commitments?: DiagnosticCommitment[];
  installation_followups?: Array<{ installation_id: string; status: InstallationStatus }>;
  pattern_dynamics?: Array<{
    pattern_name: string;
    was: string;
    became: string;
    dynamics: BehaviorPatternDynamics;
  }>;
}

export interface Meeting {
  id: string;
  manager_id: string;
  meeting_number: number;
  date: string | null;
  type: MeetingType;
  status: MeetingStatus;
  previous_context_text: string | null;
  previous_context_json: PreviousContextJson | null;
  context_from_unclosed: boolean;
  scenario: string | null;
  scenario_approved_at: string | null;
  first_meeting_scenario_mode: FirstMeetingScenarioMode | null;
  transcription_prompt: string | null;
  transcription_text: string | null;
  transcription_file_url: string | null;
  key_facts: string | null;
  problems_signals: string | null;
  conclusions: string | null;
  strengths: string | null;
  weaknesses: string | null;
  action_plan: string | null;
  next_scenario: string | null;
  diagnostic_extension: DiagnosticExtension | null;
  conducted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  target_type: CommentTarget;
  target_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  user_profile?: UserProfile;
}

export interface AiSettings {
  id: string;
  user_id: string;
  preferred_model: string;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 'track' | 'roadmap' | 'chronology' | 'other';
export type DocumentOwner = 'company' | 'manager';

export interface Document {
  id: string;
  company_id: string | null;
  manager_id: string | null;
  title: string;
  content: string;
  type: DocumentType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  manager_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export type InterimEventSource = 'app' | 'telegram';

export interface InterimEvent {
  id: string;
  manager_id: string;
  text: string;
  source: InterimEventSource;
  created_by: string | null;
  created_at: string;
}

export type GoalStatus = 'planned' | 'in_progress' | 'completed';

export interface Goal {
  id: string;
  manager_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  children?: Goal[];
}

// ============================================================
// UI aggregates (with computed metrics)
// ============================================================

export interface CompanyWithMetrics extends Company {
  active_managers_count: number;
  last_meeting_date: string | null;
  total_meetings_count: number;
  closed_meetings_count: number;
}

export interface ManagerWithMetrics extends Manager {
  meetings_count: number;
  last_meeting_date: string | null;
}

export interface ManagerWithMeetings extends Manager {
  meetings: Pick<Meeting, 'id' | 'meeting_number' | 'date' | 'status'>[];
  meetings_count: number;
  last_meeting_date: string | null;
}

// ============================================================
// API request / response types
// ============================================================

export interface CreateCompanyRequest {
  name: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  status?: CompanyStatus;
}

export interface CreateManagerRequest {
  name: string;
  position?: string;
  role_in_team?: string;
  context?: string;
  director_request?: string;
  strengths?: string;
  weaknesses?: string;
  work_type?: WorkType;
}

export interface UpdateManagerRequest {
  name?: string;
  position?: string;
  role_in_team?: string;
  context?: string;
  director_request?: string;
  strengths?: string;
  weaknesses?: string;
  status?: ManagerStatus;
  consultant_comments?: string;
  ai_rules?: string;
}

export interface UpdateMeetingRequest {
  date?: string;
  scenario?: string;
  transcription_prompt?: string;
  transcription_text?: string;
  key_facts?: string;
  problems_signals?: string;
  conclusions?: string;
  strengths?: string;
  weaknesses?: string;
  action_plan?: string;
  next_scenario?: string;
  scenario_approved_at?: string | null;
  first_meeting_scenario_mode?: FirstMeetingScenarioMode | null;
  diagnostic_extension?: DiagnosticExtension | null;
}

export interface UpdateMeetingStatusRequest {
  status: MeetingStatus;
}

export interface CreateCommentRequest {
  target_type: CommentTarget;
  target_id: string;
  text: string;
}

export interface UpdateCommentRequest {
  text: string;
}

export interface AiGenerateRequest {
  meeting_id: string;
}

export interface AiSettingsUpdateRequest {
  preferred_model: string;
  telegram_chat_id?: string | null;
}

export interface AvailableModel {
  id: string;
  name: string;
  context_length: number;
}

export interface ApiError {
  error: string;
  missing_fields?: string[];
}
