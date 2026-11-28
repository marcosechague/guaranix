import { z } from 'zod';
import type { BrodiMessageRole, BrodiSummarySource } from '../domain/enums';

/** Long enough for any real question; anything longer is pasted text, not a question. */
export const MAX_BRODI_QUESTION_LENGTH = 500;

export const brodiQuestionSchema = z.object({
  question: z.string().trim().min(2).max(MAX_BRODI_QUESTION_LENGTH),
});

export type BrodiQuestion = z.input<typeof brodiQuestionSchema>;

export interface BrodiMessage {
  id: string;
  role: BrodiMessageRole;
  content: string;
  createdAt: string;
}

/** Numbers a weekly summary was written from; also shown next to its text. */
export interface BrodiWeeklyFigures {
  collectedGs: number;
  overdueGs: number;
  debtors: number;
  activeMembers: number;
  newMembers: number;
  lostMembers: number;
  classes: number;
  attended: number;
  occupancyRate: number | null;
  /** Active members who did not come in the summarized week. */
  absentMembers: number;
}

export interface BrodiWeeklySummary {
  weekStart: string;
  source: BrodiSummarySource;
  summary: string;
  figures: BrodiWeeklyFigures;
  createdAt: string;
}

export interface BrodiUsage {
  enabled: boolean;
  monthlyLimit: number | null;
  usedThisMonth: number;
}

/** What the Brodi screen loads: the person's own conversation, their box's last summary and the quota. */
export interface BrodiOverview {
  usage: BrodiUsage;
  messages: BrodiMessage[];
  latestSummary: BrodiWeeklySummary | null;
}

export interface BrodiAnswer {
  question: BrodiMessage;
  answer: BrodiMessage;
  usage: BrodiUsage;
}
