import { extractStructured } from '@guaranix/ai';
import { type SchemaDatabase, withBoxScope } from '@guaranix/db';
import {
  type BrodiAnswer,
  type BrodiOverview,
  type BrodiQuestion,
  brodiQuestionSchema,
} from '@guaranix/shared';
import { z } from 'zod';
import { callProvider } from '../ai-runtime';
import { completeAiUse, forBoxStaff, loadPlatformProvider, reserveAiUse } from '../ai-usage';
import { assertRole, MANAGER_ROLES, type ServiceAuth, type ServiceContext } from '../context';
import type { AiRuntime } from '../platform-ai';
import {
  brodiUsage,
  latestWeeklySummary,
  ownMessages,
  saveExchange,
  toBrodiMessage,
  VISIBLE_MESSAGES,
} from './conversation';
import { BRODI_INSTRUCTIONS, brodiParts } from './prompt';
import { boxSnapshot } from './snapshot';

/** A short answer; the instructions ask for two to five sentences. */
const MAX_OUTPUT_TOKENS = 1_500;
/** Enough context for "¿y el mes pasado?" without resending the whole conversation. */
const HISTORY_TURNS = 6;

const answerSchema = z.object({ answer: z.string().trim().min(1).max(3000) });

/** Brodi is for the people who see the box's money: owners and administrators. */
export async function brodiOverview(context: ServiceContext): Promise<BrodiOverview> {
  assertRole(context.auth.role, MANAGER_ROLES);
  return {
    usage: await brodiUsage(context),
    messages: (await ownMessages(context, VISIBLE_MESSAGES)).map(toBrodiMessage),
    latestSummary: await latestWeeklySummary(context),
  };
}

export interface BrodiDependencies {
  database: SchemaDatabase;
  auth: ServiceAuth;
  now: Date;
  ai: AiRuntime;
}

const inBox = <T>(
  { database, auth, now }: BrodiDependencies,
  work: (context: ServiceContext) => Promise<T>,
) =>
  withBoxScope(database, { boxId: auth.boxId, userId: auth.userId }, (transaction) =>
    work({ transaction, auth, now }),
  );

/**
 * Answers a question from a snapshot of the asker's own box. It reads and
 * stores the conversation, nothing else: Brodi v1 cannot change box data.
 * No transaction stays open while the provider works.
 */
export async function askBrodi(
  dependencies: BrodiDependencies,
  request: BrodiQuestion,
): Promise<BrodiAnswer> {
  try {
    return await ask(dependencies, request);
  } catch (error) {
    throw forBoxStaff(error, 'brodi_unavailable');
  }
}

async function ask(dependencies: BrodiDependencies, request: BrodiQuestion): Promise<BrodiAnswer> {
  const { database, auth, now, ai } = dependencies;
  assertRole(auth.role, MANAGER_ROLES);
  const { question } = brodiQuestionSchema.parse(request);
  const provider = await loadPlatformProvider(database, ai);
  const usageId = await reserveAiUse(database, auth, now, 'brodi', provider);
  const { snapshot, history } = await inBox(dependencies, async (context) => ({
    snapshot: await boxSnapshot(context),
    history: await ownMessages(context, HISTORY_TURNS),
  }));
  const result = await callProvider(() =>
    extractStructured(
      provider,
      {
        instructions: BRODI_INSTRUCTIONS,
        parts: brodiParts(snapshot, history, question),
        schemaName: 'brodi_answer',
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      answerSchema,
    ),
  );
  await completeAiUse(database, usageId, result);
  return inBox(dependencies, async (context) => {
    const [asked, answered] = await saveExchange(context, [
      { role: 'user', content: question },
      { role: 'assistant', content: result.data.answer },
    ]);
    if (!asked || !answered) throw new Error('Brodi exchange was not saved');
    return {
      question: toBrodiMessage(asked),
      answer: toBrodiMessage(answered),
      usage: await brodiUsage(context),
    };
  });
}
