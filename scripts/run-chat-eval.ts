/**
 * Runs the eval set of the chat assistant.
 *
 * The script is opt-in: it is started by hand, because it reads the live
 * Qdrant and spends the Gemini quota. It only reads the database, it never
 * writes anything.
 *
 * Run:
 *   $env:EVAL_USER_ID = 1
 *   $env:EVAL_USER_ROLE = 'CUSTOMER'
 *   npm run eval:chat
 *
 * Metrics:
 * - the number of LLM calls per question (the main economy metric);
 * - hit@5: whether a relevant chunk was found in the knowledge base in the
 *   language of the question;
 * - whether the injection protection fired.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/chat/chat.service';
import { AiService } from '../src/ai/ai.service';
import { ChatLogService } from '../src/chat/chat-log.service';
import { ChatLogKind } from '../src/chat/enums/chat-log-kind.enum';
import { EmbeddingsService } from '../src/embeddings/embeddings.service';
import { VectorStorageService } from '../src/vector-storage/vector-storage.service';
import { Role } from '../src/users/enums/role.enum';
import { Lang } from '../src/chat/locales/lang';
import {
  EVAL_QUESTIONS,
  EvalQuestion,
} from '../src/chat/eval/chat-eval.questions';

const USER_ID: number = Number(process.env.EVAL_USER_ID ?? 1);
const USER_ROLE: Role = (process.env.EVAL_USER_ROLE ?? 'CUSTOMER') as Role;

/** Relevance threshold of a chunk for hit@5. */
const HIT_THRESHOLD = 0.3;

interface EvalRow {
  id: string;
  lang: Lang;
  question: string;
  llmCalls: number;
  kind: ChatLogKind | 'ERROR';
  hit: boolean | null;
  ok: boolean;
  problems: string[];
  answer: string;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const chatService = app.get(ChatService);
  const aiService = app.get(AiService);
  const chatLogService = app.get(ChatLogService);
  const embeddingsService = app.get(EmbeddingsService);
  const vectorStorageService = app.get(VectorStorageService);

  const rows: EvalRow[] = [];

  for (const item of EVAL_QUESTIONS) {
    const question: EvalQuestion = item;

    // Every question starts with a clean history: otherwise the previous
    // question changes the processing path and the metric stops being
    // comparable.
    chatService.clearHistory(USER_ID);
    aiService.resetCallCount();

    let answer = '';
    let error: string | null = null;

    try {
      answer = await chatService.generateResponse(
        question.question,
        USER_ID,
        USER_ROLE,
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const llmCalls: number = aiService.getCallCount();

    // The branch the request took is taken from the chat log: it is more
    // reliable than parsing the answer text.
    const recentLogs = await chatLogService.findRecent(USER_ID, 1);
    const kind: ChatLogKind | 'ERROR' =
      error !== null
        ? 'ERROR'
        : (recentLogs[0]?.kind ?? ChatLogKind.NO_ANSWER);

    let hit: boolean | null = null;

    if (question.expectKnowledge && error === null) {
      hit = await measureHit(
        embeddingsService,
        vectorStorageService,
        question.question,
        USER_ROLE,
        question.lang,
      );
    }

    rows.push({
      id: question.id,
      lang: question.lang,
      question: question.question,
      llmCalls,
      kind,
      hit,
      ok: false,
      problems: checkExpectations(question, llmCalls, kind, hit),
      answer: answer.slice(0, 120).replace(/\n/g, ' | '),
    });
  }

  printReport(rows);

  await app.close();

  if (rows.some((row: EvalRow): boolean => !row.ok)) {
    process.exitCode = 1;
  }
}

/**
 * Checks the question against the expectations of the eval set.
 */
function checkExpectations(
  question: EvalQuestion,
  llmCalls: number,
  kind: ChatLogKind | 'ERROR',
  hit: boolean | null,
): string[] {
  const problems: string[] = [];

  if (kind === 'ERROR') {
    problems.push('error');

    return problems;
  }

  if (
    question.maxLlmCalls !== null &&
    llmCalls > question.maxLlmCalls
  ) {
    problems.push(`llm calls ${llmCalls} > ${question.maxLlmCalls}`);
  }

  if (question.expectBlocked && kind !== ChatLogKind.BLOCKED) {
    problems.push('not blocked');
  }

  if (question.expectLiveData && kind !== ChatLogKind.LIVE) {
    problems.push('not live data');
  }

  if (
    question.expectKnowledge &&
    kind !== ChatLogKind.KNOWLEDGE &&
    kind !== ChatLogKind.NO_ANSWER
  ) {
    problems.push('not knowledge base');
  }

  if (question.expectKnowledge && kind === ChatLogKind.NO_ANSWER) {
    problems.push('no chunk found');
  }

  if (hit === false) {
    problems.push('hit@5 missed');
  }

  return problems;
}

/**
 * Searches the knowledge base in the language of the question and reports
 * whether a relevant chunk was found.
 */
async function measureHit(
  embeddingsService: EmbeddingsService,
  vectorStorageService: VectorStorageService,
  question: string,
  role: Role,
  lang: Lang,
): Promise<boolean> {
  const vectors: number[][] = await embeddingsService.generateEmbeddings([
    question,
  ]);

  const chunks = await vectorStorageService.getRelevantChunkByAccess(
    vectors[0],
    undefined,
    role,
    lang,
  );

  if (chunks.length === 0) {
    return false;
  }

  const top: number = Math.max(
    ...chunks.map((chunk): number => chunk.score ?? 0),
  );

  return top >= HIT_THRESHOLD;
}

function printReport(rows: EvalRow[]): void {
  console.log('\n=== Eval: chat assistant ===\n');
  console.log(
    'id'.padEnd(26) +
      'lang'.padEnd(6) +
      'calls'.padEnd(7) +
      'kind'.padEnd(12) +
      'hit'.padEnd(6) +
      'result',
  );
  console.log('-'.repeat(110));

  for (const row of rows) {
    console.log(
      row.id.padEnd(26) +
        row.lang.padEnd(6) +
        String(row.llmCalls).padEnd(7) +
        row.kind.padEnd(12) +
        (row.hit === null ? '-' : row.hit ? 'yes' : 'no').padEnd(6) +
        (row.problems.length === 0 ? 'ok' : row.problems.join(', ')),
    );
  }

  const byLang = new Map<Lang, { total: number; calls: number; failed: number }>();

  for (const row of rows) {
    const entry = byLang.get(row.lang) ?? { total: 0, calls: 0, failed: 0 };
    entry.total += 1;
    entry.calls += row.llmCalls;

    if (row.problems.length > 0) {
      entry.failed += 1;
    }

    byLang.set(row.lang, entry);
  }

  console.log('\nLLM calls per question on average:');
  for (const [lang, entry] of byLang.entries()) {
    console.log(
      `  ${lang}: ${(entry.calls / entry.total).toFixed(2)} ` +
        `(questions: ${entry.total}, with problems: ${entry.failed})`,
    );
  }

  console.log(
    `\nQuestions with problems: ${rows.filter((row: EvalRow): boolean => row.problems.length > 0).length}`,
  );
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exit(1);
});
