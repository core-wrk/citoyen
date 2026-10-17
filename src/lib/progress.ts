import {
  emptyData,
  studyDataSchema,
  parseSavedStudyData,
  type StudyData,
} from "../../shared/contracts";

export const progressKey = (userId: string | null) =>
  userId ? `citoyen.progress.${userId}` : "citoyen.study.v1";
export function readProgress(
  storage: Pick<Storage, "getItem">,
  userId: string | null,
): StudyData {
  try {
    return parseSavedStudyData(
      JSON.parse(storage.getItem(progressKey(userId)) || "null"),
    );
  } catch {
    return emptyData();
  }
}
export function writeProgress(
  storage: Pick<Storage, "getItem" | "setItem">,
  userId: string | null,
  data: StudyData,
) {
  const existing = storage.getItem(progressKey(userId));
  if (existing) {
    // Preserve an unsupported existing record instead of silently replacing it.
    try {
      parseSavedStudyData(JSON.parse(existing));
    } catch {
      throw new Error(
        "The existing browser record needs recovery and has been preserved.",
      );
    }
  }
  storage.setItem(
    progressKey(userId),
    JSON.stringify(studyDataSchema.parse(data)),
  );
}
export function mergeProgress(local: StudyData, cloud: StudyData): StudyData {
  const latest =
    (local.updatedAt || "") >= (cloud.updatedAt || "") ? local : cloud;
  const older = latest === local ? cloud : local;
  const attempts = new Map(
    [...older.attempts, ...latest.attempts].map((item) => [item.id, item]),
  );
  return {
    attempts: [...attempts.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 200),
    drafts: { ...older.drafts, ...latest.drafts },
    updatedAt: latest.updatedAt,
  };
}
