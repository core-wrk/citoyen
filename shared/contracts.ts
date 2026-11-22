import { z } from "zod";

export const skillSchema = z.enum([
  "civics",
  "listening",
  "reading",
  "writing",
  "speaking",
  "interview",
]);
export type Skill = z.infer<typeof skillSchema>;
export type Page = Skill | "home";
export const feedbackSchema = z.object({
  correctedText: z.string().max(10000).optional(),
  summary: z.string().max(3000),
  relevance: z.string().max(2000).optional(),
  improvements: z.array(z.string().max(1500)).max(10),
  local: z.boolean().optional(),
});
export type Feedback = z.infer<typeof feedbackSchema>;
export const pronunciationSchema = z.object({
  accuracy: z.number().min(0).max(100).optional(),
  fluency: z.number().min(0).max(100).optional(),
  transcriptionMatch: z.number().min(0).max(100).optional(),
  missing: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});
export type Pronunciation = z.infer<typeof pronunciationSchema>;
export const attemptSchema = z.object({
  id: z.string().min(1).max(100),
  skill: skillSchema,
  title: z.string().min(1).max(300),
  correct: z.number().min(0),
  total: z.number().min(0),
  at: z.iso.datetime(),
  transcript: z.string().max(5000).optional(),
  text: z.string().max(5000).optional(),
  feedback: feedbackSchema.optional(),
  pronunciation: pronunciationSchema.optional(),
});
export type Attempt = z.infer<typeof attemptSchema>;
export const studyDataSchema = z.object({
  attempts: z.array(attemptSchema).max(200),
  drafts: z.record(z.string().max(100), z.string().max(5000)),
  updatedAt: z.iso.datetime().nullable(),
});
export type StudyData = z.infer<typeof studyDataSchema>;
// The first local build saved null pronunciation and failed feedback objects.
// Normalize only those known legacy optional fields; retain the learner's answers.
export function parseSavedStudyData(value: unknown): StudyData {
  if (
    !value ||
    typeof value !== "object" ||
    !("attempts" in value) ||
    !Array.isArray(value.attempts)
  )
    return studyDataSchema.parse(value);
  const attempts = value.attempts.map((item) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...item } as Record<string, unknown>;
    if (next.pronunciation === null) delete next.pronunciation;
    if (
      next.feedback &&
      typeof next.feedback === "object" &&
      "error" in next.feedback
    )
      delete next.feedback;
    return next;
  });
  return studyDataSchema.parse({ ...value, attempts });
}
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(1000),
});
export const progressRequestSchema = z.object({ data: studyDataSchema });
export const feedbackRequestSchema = z.object({
  kind: z.enum(["writing", "speaking"]),
  text: z.string().trim().min(1).max(5000),
  prompt: z.string().trim().max(1200),
});
export interface AppConfig {
  localMode: boolean;
  authConfigured: boolean;
  appReady: boolean;
  speechConfigured: boolean;
  languageFeedbackConfigured: boolean;
  monthlyRequestAllowance: number;
}
export interface Question {
  id: string;
  theme: string;
  type: string;
  question: string;
  optionsLabel: string;
  options: string[];
  answer: number;
  explanation: string;
  source?: { url: string; title?: string };
}
export const emptyData = (): StudyData => ({
  attempts: [],
  drafts: {},
  updatedAt: null,
});
