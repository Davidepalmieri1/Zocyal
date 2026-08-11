export type CompatibilityAnswers = {
  participant_id?: string
  question_1?: string | null
  question_2?: string | null
  question_3?: string | null
  question_4?: string | null
  question_5?: string | null
  question_6?: string | null
  question_7?: string | null
  question_8?: string | null
  question_9?: string | null
  question_10?: string | null
  question_11?: string | null
  question_12?: string | null
}

const QUESTIONS: Array<keyof CompatibilityAnswers> = [
  "question_1", "question_2", "question_3", "question_4",
  "question_5", "question_6", "question_7", "question_8",
  "question_9", "question_10", "question_11", "question_12",
]

export function calculateCompatibility(
  first: CompatibilityAnswers,
  second: CompatibilityAnswers
) {
  const equalAnswers = QUESTIONS.filter(
    (question) =>
      first[question] &&
      second[question] &&
      first[question] === second[question]
  ).length

  return Math.round((equalAnswers / QUESTIONS.length) * 100)
}
