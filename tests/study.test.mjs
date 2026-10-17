import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS,
  SCENARIO_QUESTIONS,
  THEMES,
} from "../src/content/questions.ts";
import {
  INTERVIEW_PROMPTS,
  LISTENING,
  READINGS,
  SPEAKING_DRILLS,
  WRITING_PROMPTS,
} from "../src/content/exercises.ts";
import {
  createCivicExam,
  chooseSpeechService,
  scoreAnswer,
  scoreExam,
  phraseMatch,
  createScenarioPractice,
  summarizeProgress,
} from "../src/lib/study.ts";

test("civic answer scoring accepts only the keyed choice", () => {
  const question = QUESTIONS[0];
  assert.equal(scoreAnswer(question, question.answer), true);
  assert.equal(
    scoreAnswer(question, (question.answer + 1) % question.options.length),
    false,
  );
});

test("civic mock matches the official knowledge and situation question counts", () => {
  const exam = createCivicExam(QUESTIONS, SCENARIO_QUESTIONS, () => 0.37);
  assert.equal(exam.length, 40);
  assert.equal(
    exam.filter((question) => question.type === "knowledge").length,
    28,
  );
  assert.equal(
    exam.filter((question) => question.type === "scenario").length,
    12,
  );
  assert.deepEqual(
    THEMES.map(
      (theme) =>
        exam.filter(
          (question) =>
            question.theme === theme && question.type === "knowledge",
        ).length,
    ),
    [5, 6, 5, 8, 4],
  );
  assert.deepEqual(
    THEMES.map(
      (theme) =>
        exam.filter(
          (question) =>
            question.theme === theme && question.type === "scenario",
        ).length,
    ),
    [6, 0, 6, 0, 0],
  );
});

test("scenario practice presents all 12 original cases for immediate review", () => {
  const practice = createScenarioPractice(SCENARIO_QUESTIONS, () => 0.37);
  assert.equal(practice.length, 12);
  assert.deepEqual(
    new Set(practice.map((question) => question.id)),
    new Set(SCENARIO_QUESTIONS.map((question) => question.id)),
  );
  assert.ok(
    practice.every(
      (question) => question.type === "scenario" && !question.officialStem,
    ),
  );
});

test("exam score reports the 32 out of 40 passing threshold", () => {
  const exam = createCivicExam(QUESTIONS, SCENARIO_QUESTIONS, () => 0.37);
  const answers = Object.fromEntries(
    exam.map((question, index) => [
      question.id,
      index < 32 ? question.answer : -1,
    ]),
  );
  assert.deepEqual(scoreExam(exam, answers), {
    correct: 32,
    total: 40,
    passed: true,
  });
});

test("phrase match ignores punctuation and case but catches missing words", () => {
  assert.equal(
    phraseMatch("Liberté, Égalité, Fraternité !", "liberté égalité fraternité")
      .accuracy,
    1,
  );
  assert.equal(
    phraseMatch("La France est une république", "La France est république")
      .accuracy,
    0.8,
  );
});

test("progress summary totals completed attempts by skill", () => {
  assert.deepEqual(
    summarizeProgress([
      { skill: "civics", correct: 4, total: 5 },
      { skill: "civics", correct: 3, total: 5 },
      { skill: "speaking", correct: 0, total: 0 },
    ]),
    {
      civics: { correct: 7, total: 10, percent: 70 },
      speaking: { correct: 0, total: 0, percent: 0 },
    },
  );
});

test("first study set covers all exam areas and planned starter activities", () => {
  assert.equal(QUESTIONS.length, 40);
  assert.equal(SCENARIO_QUESTIONS.length, 12);
  assert.equal(
    new Set(QUESTIONS.map((question) => question.theme)).size,
    THEMES.length,
  );
  for (const theme of THEMES)
    assert.equal(
      QUESTIONS.filter((question) => question.theme === theme).length,
      8,
    );
  for (const question of QUESTIONS) {
    assert.equal(question.options.length, 4);
    assert.equal(question.officialStem, true);
    assert.ok(
      question.source.url.startsWith(
        "https://www.immigration.interieur.gouv.fr/",
      ),
    );
  }
  for (const question of SCENARIO_QUESTIONS) {
    assert.equal(question.type, "scenario");
    assert.equal(question.officialStem, false);
    assert.equal(question.options.length, 4);
  }
  assert.deepEqual(
    new Set(SCENARIO_QUESTIONS.map((question) => question.answer)),
    new Set([0, 1, 2, 3]),
  );
  assert.equal(LISTENING.length, 10);
  assert.equal(READINGS.length, 10);
  assert.equal(WRITING_PROMPTS.length, 6);
  assert.equal(SPEAKING_DRILLS.length, 10);
  assert.equal(INTERVIEW_PROMPTS.length, 15);
});

test("starter writing and speaking drills match the TCF IRN task limits", () => {
  assert.deepEqual(
    WRITING_PROMPTS.slice(0, 3).map(({ minWords, maxWords }) => [
      minWords,
      maxWords,
    ]),
    [
      [30, 60],
      [40, 90],
      [40, 90],
    ],
  );
  assert.deepEqual(
    SPEAKING_DRILLS.slice(0, 3).map(({ examTask, durationSeconds }) => [
      examTask,
      durationSeconds,
    ]),
    [
      [1, 180],
      [2, 210],
      [3, 210],
    ],
  );
});

test("recorded speech stays local until the learner opts into a transcription service", () => {
  assert.equal(
    chooseSpeechService({
      azureAvailable: true,
      azureConsent: false,
      browserAvailable: true,
      browserConsent: false,
    }),
    "local",
  );
  assert.equal(
    chooseSpeechService({
      azureAvailable: true,
      azureConsent: true,
      browserAvailable: true,
      browserConsent: true,
    }),
    "azure",
  );
  assert.equal(
    chooseSpeechService({
      azureAvailable: false,
      azureConsent: false,
      browserAvailable: true,
      browserConsent: true,
    }),
    "browser",
  );
  assert.equal(
    chooseSpeechService({
      azureAvailable: false,
      azureConsent: false,
      browserAvailable: false,
      browserConsent: true,
    }),
    "local",
  );
});
