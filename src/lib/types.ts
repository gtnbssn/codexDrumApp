export type Category = 'Rudiments' | 'Timing' | 'Coordination' | 'Endurance';

export interface Drill {
  id: string;
  name: string;
  category: Category;
  description: string;
  focus: string;
  level: 'Foundation' | 'Intermediate';
  bpm: number;
  minutes: number;
  subdivision: number;
  sticking: string[];
  accents: number[];
  instructions: string[];
  gapBars?: boolean;
  tempoLadder?: boolean;
}

export interface TimingResult {
  score: number;
  matched: number;
  expected: number;
  extra: number;
  meanOffsetMs: number;
  meanErrorMs: number;
  consistencyMs: number;
  offsets: number[];
}

export interface Session {
  /** Compensation used for this result; older sessions may not have recorded it. */
  latencyMs?: number;
  id: string;
  drillId: string;
  drillName: string;
  startedAt: string;
  seconds: number;
  bpm: number;
  endBpm: number;
  completed: boolean;
  notes: string;
  timing: TimingResult | null;
}

export interface PlanItem {
  id: string;
  drillId: string;
  day: number;
  minutes: number;
  bpm: number;
}

export interface PracticeData {
  version: 1;
  sessions: Session[];
  plan: PlanItem[];
  weeklyGoal: number;
}

export type Page = 'practice' | 'library' | 'progress' | 'planner';
