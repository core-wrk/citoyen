import type { Question } from "../../shared/contracts";

export function chooseSpeechService({
  azureAvailable,
  azureConsent,
  browserAvailable,
  browserConsent,
}: {
  azureAvailable: boolean;
  azureConsent: boolean;
  browserAvailable: boolean;
  browserConsent: boolean;
}) {
  if (azureAvailable && azureConsent) return "azure";
  if (browserAvailable && browserConsent) return "browser";
  return "local";
}

export function scoreAnswer(
  question: Pick<Question, "answer">,
  answer: number | undefined,
) {
  return Number.isInteger(answer) && answer === question.answer;
}

export function shuffle<T>(items: T[], random: () => number = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createCivicExam(
  questions: Question[],
  scenarios: Question[],
  random = Math.random,
) {
  const themes = [...new Set(questions.map((question) => question.theme))];
  const knowledgeCounts = [5, 6, 5, 8, 4];
  const scenarioCounts = [6, 0, 6, 0, 0];
  if (themes.length !== knowledgeCounts.length)
    throw new Error("The civic mock needs the five official themes in order.");
  const knowledge = themes.flatMap((theme, index) => {
    const group = questions.filter((question) => question.theme === theme);
    if (group.length < knowledgeCounts[index])
      throw new Error(
        `Need at least ${knowledgeCounts[index]} knowledge questions for ${theme}`,
      );
    return shuffle(group, random).slice(0, knowledgeCounts[index]);
  });
  const situations = themes.flatMap((theme, index) => {
    const count = scenarioCounts[index];
    if (!count) return [];
    const group = scenarios.filter((question) => question.theme === theme);
    if (group.length < count)
      throw new Error(
        `Need at least ${count} practice situations for ${theme}`,
      );
    return shuffle(group, random).slice(0, count);
  });
  return shuffle([...knowledge, ...situations], random);
}

export function createScenarioPractice(
  scenarios: Question[],
  random = Math.random,
) {
  if (
    scenarios.length !== 12 ||
    scenarios.some((question) => question.type !== "scenario")
  ) {
    throw new Error(
      "Situation practice needs the 12 original practice scenarios.",
    );
  }
  return shuffle(scenarios, random);
}

export function scoreExam(
  questions: Question[],
  answers: Record<string, number>,
) {
  const correct = questions.reduce(
    (total, question) =>
      total + Number(scoreAnswer(question, answers[question.id])),
    0,
  );
  return {
    correct,
    total: questions.length,
    passed: questions.length > 0 && correct / questions.length >= 0.8,
  };
}

function words(text: string) {
  return text
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function phraseMatch(expectedText: string, spokenText: string) {
  const expected = words(expectedText);
  const spoken = words(spokenText);
  if (!expected.length) return { accuracy: 0, missing: [], extra: spoken };
  const table = Array.from({ length: expected.length + 1 }, () =>
    Array(spoken.length + 1).fill(0),
  );
  for (let i = 1; i <= expected.length; i += 1) {
    for (let j = 1; j <= spoken.length; j += 1) {
      table[i][j] =
        expected[i - 1] === spoken[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const matched = table[expected.length][spoken.length];
  const missing: string[] = [];
  const extra: string[] = [];
  let i = expected.length;
  let j = spoken.length;
  while (i > 0 && j > 0) {
    if (expected[i - 1] === spoken[j - 1]) {
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      missing.unshift(expected[--i]);
    } else {
      extra.unshift(spoken[--j]);
    }
  }
  while (i > 0) missing.unshift(expected[--i]);
  while (j > 0) extra.unshift(spoken[--j]);
  return { accuracy: matched / expected.length, missing, extra };
}

export function summarizeProgress(
  attempts: { skill: string; correct: number; total: number }[],
) {
  return attempts.reduce<
    Record<string, { correct: number; total: number; percent: number }>
  >((summary, attempt) => {
    const skill = attempt.skill || "other";
    summary[skill] ??= { correct: 0, total: 0, percent: 0 };
    summary[skill].correct += Number(attempt.correct) || 0;
    summary[skill].total += Number(attempt.total) || 0;
    summary[skill].percent = summary[skill].total
      ? Math.round((summary[skill].correct / summary[skill].total) * 100)
      : 0;
    return summary;
  }, {});
}
