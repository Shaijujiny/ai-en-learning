"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { readApiData } from "@/lib/api";

type AssessmentQuestion = {
  key: string;
  order: number;
  category: string;
  title: string;
  prompt: string;
  placeholder: string;
  answer_type: string;
  min_length: number;
};

type AssessmentOverview = {
  status: string;
  current_level: string | null;
  questions: AssessmentQuestion[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ANALYSIS_AREAS = [
  {
    key: "grammar_accuracy",
    label: "Grammar accuracy",
    detail: "Sentence control, verb usage, and core structural correctness.",
    categories: ["past_experience", "roleplay", "follow_up", "grammar_vocabulary"],
    tips: [
      "Use clear past vs present tense choices.",
      "Avoid sentence fragments and missing subjects.",
      "Keep subject-verb agreement consistent.",
    ],
  },
  {
    key: "fluency",
    label: "Fluency",
    detail: "How naturally and consistently you can sustain written speaking-style answers.",
    categories: ["self_introduction", "daily_routine", "opinion", "roleplay"],
    tips: [
      "Write 4 to 6 connected sentences, not just one.",
      "Use transitions like because, however, for example.",
      "Keep the flow natural like spoken English.",
    ],
  },
  {
    key: "vocabulary_diversity",
    label: "Vocabulary diversity",
    detail: "Range of words, repetition control, and stronger word choice.",
    categories: ["grammar_vocabulary", "opinion", "roleplay"],
    tips: [
      "Avoid repeating the same basic verbs.",
      "Add one or two stronger adjectives per answer.",
      "Use specific nouns instead of generic words.",
    ],
  },
  {
    key: "confidence",
    label: "Confidence",
    detail: "Answer certainty, directness, and reduced filler-style phrasing.",
    categories: ["self_introduction", "roleplay", "follow_up"],
    tips: [
      "Use direct statements rather than hedging.",
      "Reduce fillers like 'maybe' or 'I think'.",
      "End your answer with a clear conclusion.",
    ],
  },
  {
    key: "sentence_complexity",
    label: "Sentence complexity",
    detail: "Use of richer sentence patterns instead of only short simple statements.",
    categories: ["past_experience", "opinion", "grammar_vocabulary"],
    tips: [
      "Combine ideas with because, although, while.",
      "Add one example sentence to each answer.",
      "Use a contrast or comparison at least once.",
    ],
  },
  {
    key: "answer_completeness",
    label: "Answer completeness",
    detail: "How fully you develop an answer instead of stopping too early.",
    categories: ["daily_routine", "past_experience", "follow_up"],
    tips: [
      "Answer with context, action, and result.",
      "Include one concrete detail per answer.",
      "Avoid stopping after a single sentence.",
    ],
  },
];

const COMPLEXITY_MARKERS = [
  "because",
  "although",
  "however",
  "while",
  "unless",
  "therefore",
  "instead",
  "which",
  "that",
  "since",
  "though",
];

const FILLER_MARKERS = [" um ", " uh ", " maybe ", " i think ", " sort of "];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function scoreLabel(score: number) {
  if (score >= 75) {
    return "Strong";
  }
  if (score >= 55) {
    return "Developing";
  }
  return "Weak";
}

function computeMetricScores(answers: Record<string, string>) {
  const answerValues = Object.values(answers);
  const combined = answerValues.join(" ").trim();
  const wordMatches = combined.match(/[a-zA-Z']+/g) ?? [];
  const sentenceMatches = combined.match(/[.!?]+/g) ?? [];
  const wordCount = wordMatches.length;
  const uniqueCount = new Set(wordMatches.map((word) => word.toLowerCase())).size;
  const sentenceCount = Math.max(sentenceMatches.length, 1);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const complexityMarkers = wordMatches.filter((word) =>
    COMPLEXITY_MARKERS.includes(word.toLowerCase()),
  ).length;
  const fillerCount = FILLER_MARKERS.reduce(
    (count, marker) => count + (combined.toLowerCase().includes(marker) ? 1 : 0),
    0,
  );
  const avgAnswerWords =
    answerValues.length > 0
      ? wordCount / answerValues.length
      : 0;

  const vocabularyDiversity = clampScore(
    (uniqueCount / Math.max(wordCount, 1)) * 120 + (wordCount > 80 ? 10 : 0),
  );
  const sentenceComplexity = clampScore(
    avgWordsPerSentence * 6 + complexityMarkers * 6,
  );
  const fluency = clampScore(
    avgWordsPerSentence * 7 + (wordCount > 120 ? 10 : 0) - fillerCount * 6,
  );
  const confidence = clampScore(
    70 + (wordCount > 90 ? 12 : 0) - fillerCount * 10,
  );
  const answerCompleteness = clampScore(avgAnswerWords * 6);
  const grammarAccuracy = clampScore(
    78 + sentenceCount * 3 - fillerCount * 5 - Math.max(0, 12 - avgWordsPerSentence) * 1.4,
  );

  return {
    grammar_accuracy: grammarAccuracy,
    fluency,
    vocabulary_diversity: vocabularyDiversity,
    confidence,
    sentence_complexity: sentenceComplexity,
    answer_completeness: answerCompleteness,
  };
}

function categoryLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function AssessmentPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState(ANALYSIS_AREAS[0].key);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadAssessment() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/assessment/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<AssessmentOverview>(response);

        if (data.status === "completed") {
          router.replace("/assessment/result");
          return;
        }

        if (data.status === "skipped") {
          router.replace("/portal");
          return;
        }

        setQuestions(data.questions);
        setAnswers(
          Object.fromEntries(data.questions.map((question) => [question.key, ""])),
        );
        setCurrentIndex(0);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load assessment.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAssessment();
  }, [router, token]);

  const currentQuestion = questions[currentIndex] ?? null;
  const metricScores = useMemo(() => computeMetricScores(answers), [answers]);
  const rankedMetrics = useMemo(() => {
    return ANALYSIS_AREAS.map((metric) => ({
      key: metric.key,
      label: metric.label,
      score: metricScores[metric.key as keyof typeof metricScores] ?? 0,
    })).sort((a, b) => a.score - b.score);
  }, [metricScores]);
  const weakestMetric = rankedMetrics[0];
  const strongestMetric = rankedMetrics[rankedMetrics.length - 1];

  const completedCount = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answers[question.key]?.trim() ?? "";
        return answer.length >= question.min_length;
      }).length,
    [answers, questions],
  );

  const progressPercent = questions.length
    ? Math.round((completedCount / questions.length) * 100)
    : 0;

  const isFormIncomplete = completedCount !== questions.length;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/assessment/onboarding/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            question_key: question.key,
            answer_text: answers[question.key] ?? "",
            answer_type: "text",
          })),
        }),
      });

      await readApiData(response);
      router.push("/assessment/result");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit assessment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/assessment/onboarding/skip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      await readApiData(response);
      router.push("/portal");
    } catch (skipError) {
      setError(
        skipError instanceof Error ? skipError.message : "Failed to skip assessment.",
      );
    } finally {
      setSkipping(false);
    }
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="glass-panel overflow-hidden rounded-[2rem] p-6 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(105,226,255,0.22),transparent_35%),linear-gradient(180deg,rgba(11,26,48,0.85),rgba(8,13,26,0.96))] p-6 md:p-8">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(167,243,208,0.12),transparent_58%)]" />
              <p className="relative text-xs uppercase tracking-[0.34em] text-cyan-300">
                Onboarding Assessment
              </p>
              <h1 className="display relative mt-4 max-w-4xl text-4xl font-semibold text-white md:text-6xl">
                Assess first, then practice with a profile that actually means something.
              </h1>
              <p className="relative mt-5 max-w-3xl text-sm leading-8 text-slate-300 md:text-base">
                This should feel like an English-learning studio, not a long raw form.
                Complete seven guided prompts, get a CEFR estimate, and unlock a first-week
                practice path tuned to your real starting point.
              </p>

              <div className="relative mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.3rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Time
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">3 min</p>
                  <p className="mt-1 text-sm text-slate-400">Short but structured</p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Coverage
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">7 prompts</p>
                  <p className="mt-1 text-sm text-slate-400">Opinion, roleplay, grammar</p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Output
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">A1-C2</p>
                  <p className="mt-1 text-sm text-slate-400">Level + next actions</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Progress signal
                  </p>
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
                    {progressPercent}% complete
                  </span>
                </div>
                <p className="mt-5 text-5xl font-semibold text-white">
                  {completedCount}
                  <span className="text-xl text-slate-500">/{questions.length || 7}</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Responses meeting the minimum quality threshold.
                </p>
                <div className="mt-5 h-3 rounded-full bg-white/8">
                  <div
                    className="h-3 rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)] transition-all"
                    style={{ width: `${Math.max(progressPercent, 8)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                  Result pack
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  <p>CEFR level estimate</p>
                  <p>Strongest and weakest skill</p>
                  <p>Recommended first scenario</p>
                  <p>7-day practice suggestion</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="glass-panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Question map
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Jump between prompts quickly. The active prompt is highlighted.
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-cyan-100">
              {completedCount} completed
            </div>
          </div>
          <div className="scrollbar-subtle mt-4 flex gap-3 overflow-x-auto pb-2">
            {questions.map((question, index) => {
              const answer = answers[question.key]?.trim() ?? "";
              const completed = answer.length >= question.min_length;
              const active = index === currentIndex;
              return (
                <button
                  key={question.key}
                  className={`min-w-[220px] rounded-[1.2rem] border px-4 py-3 text-left transition ${
                    active
                      ? "border-cyan-300/40 bg-cyan-400/10"
                      : completed
                        ? "border-emerald-300/30 bg-emerald-400/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                  onClick={() => setCurrentIndex(index)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Q{question.order}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {completed ? "Ready" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {question.title}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                    {categoryLabel(question.category)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="glass-panel rounded-[2rem] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Question map
              </p>
              <span className="text-xs text-slate-400">
                {currentIndex + 1}/{questions.length || 7}
              </span>
            </div>

            {loading ? (
              <p className="mt-5 text-sm text-slate-300">Loading prompts...</p>
            ) : (
              <div className="mt-5 space-y-3">
                {questions.map((question, index) => {
                  const answer = answers[question.key]?.trim() ?? "";
                  const completed = answer.length >= question.min_length;
                  const active = index === currentIndex;

                  const relatedMetric = ANALYSIS_AREAS.find(
                    (metric) => metric.key === selectedMetric,
                  );
                  const isRelated =
                    relatedMetric?.categories.includes(question.category) ?? false;

                  return (
                    <button
                      key={question.key}
                      className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition ${
                        active
                          ? "border-cyan-300/40 bg-cyan-400/10 shadow-[0_20px_40px_rgba(6,18,34,0.28)]"
                          : isRelated
                            ? "border-cyan-300/30 bg-cyan-400/5"
                            : "border-white/10 bg-slate-950/35 hover:border-white/20 hover:bg-white/6"
                      }`}
                      onClick={() => setCurrentIndex(index)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          Question {question.order}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                            completed
                              ? "bg-emerald-400/15 text-emerald-100"
                              : "bg-white/6 text-slate-400"
                          }`}
                        >
                          {completed ? "Ready" : "Draft"}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-white">
                        {question.title}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-cyan-300">
                        {categoryLabel(question.category)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="glass-panel rounded-[2rem] p-5 md:p-6">
            {currentQuestion ? (
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Active prompt
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                      {currentQuestion.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      Question {currentQuestion.order}
                    </span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
                      {categoryLabel(currentQuestion.category)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,34,0.7),rgba(7,10,20,0.94))] p-5 md:p-6">
                  <p className="text-sm leading-8 text-slate-300">
                    {currentQuestion.prompt}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                      Strongest now: {strongestMetric?.label ?? "TBD"}
                    </span>
                    <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-rose-100">
                      Weakest now: {weakestMetric?.label ?? "TBD"}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <textarea
                        className="min-h-[320px] w-full rounded-[1.5rem] border border-white/10 bg-slate-950/85 px-5 py-5 text-white outline-none transition focus:border-cyan-300/40"
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [currentQuestion.key]: event.target.value,
                          }))
                        }
                        placeholder={currentQuestion.placeholder}
                        value={answers[currentQuestion.key] ?? ""}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                          Focus metric
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">
                          {ANALYSIS_AREAS.find((metric) => metric.key === selectedMetric)
                            ?.label ?? "Grammar accuracy"}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {ANALYSIS_AREAS.find((metric) => metric.key === selectedMetric)
                            ?.detail}
                        </p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          Prompt intent
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                          Write as if you are responding naturally in a live English session,
                          not giving single-word notes.
                        </p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          Quality target
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-white">
                          {(answers[currentQuestion.key]?.trim() ?? "").length}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          characters written, minimum {currentQuestion.min_length}
                        </p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          Answer hint
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                          Aim for 3 to 6 complete sentences with one clear idea and at least
                          one supporting detail.
                        </p>
                      </div>
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          Writing tips
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          {ANALYSIS_AREAS.find((metric) => metric.key === selectedMetric)?.tips.map(
                            (tip) => (
                              <p key={tip}>{tip}</p>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((value) => Math.max(value - 1, 0))}
                      type="button"
                    >
                      Previous question
                    </button>
                    <button
                      className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                      disabled={currentIndex >= questions.length - 1}
                      onClick={() =>
                        setCurrentIndex((value) =>
                          Math.min(value + 1, Math.max(questions.length - 1, 0)),
                        )
                      }
                      type="button"
                    >
                      Next question
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                      disabled={loading || submitting || skipping}
                      onClick={() => void handleSkip()}
                      type="button"
                    >
                      {skipping ? "Skipping..." : "Skip for now"}
                    </button>
                    <button
                      className="rounded-[1.15rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      disabled={loading || submitting || isFormIncomplete}
                      onClick={() => void handleSubmit()}
                      type="button"
                    >
                      {submitting ? "Analyzing answers..." : "Complete assessment"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.7rem] border border-white/10 bg-slate-950/45 p-8">
                <p className="text-sm text-slate-300">Loading assessment question...</p>
              </div>
            )}

            {error ? (
              <p className="mt-4 rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
          </div>

          <aside className="space-y-5">
            <div className="glass-panel rounded-[2rem] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Analysis board
              </p>
              <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Live signal
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-300">
                    {ANALYSIS_AREAS.find((metric) => metric.key === selectedMetric)
                      ?.label ?? "Grammar accuracy"}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {scoreLabel(
                      metricScores[selectedMetric as keyof typeof metricScores] ?? 0,
                    )}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Weakest now</span>
                    <span className="text-rose-200">{weakestMetric?.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Strongest now</span>
                    <span className="text-emerald-200">{strongestMetric?.label}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {ANALYSIS_AREAS.map((item, index) => {
                  const score = metricScores[item.key as keyof typeof metricScores] ?? 0;
                  const active = selectedMetric === item.key;
                  return (
                    <button
                      key={item.label}
                      className={`w-full rounded-[1.35rem] border p-4 text-left transition ${
                        active
                          ? "border-cyan-300/40 bg-cyan-400/10"
                          : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] hover:border-white/20"
                      }`}
                      onClick={() => setSelectedMetric(item.key)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          0{index + 1}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        {item.detail}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Signal</span>
                        <span className="text-cyan-200">
                          {scoreLabel(score)} · {Math.round(score)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Exit paths
              </p>
              <div className="mt-4 space-y-3">
                <Link
                  className="block rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200 transition hover:border-white/20"
                  href="/portal"
                >
                  Return to portal
                </Link>
                <Link
                  className="block rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200 transition hover:border-white/20"
                  href="/dashboard"
                >
                  Open dashboard
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
