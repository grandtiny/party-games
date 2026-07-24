import {
  GomokuPosition,
  createGomokuExerciseState,
  gomokuLessons,
  playGomokuMove,
  type GomokuLesson,
  type GomokuLessonExercise,
  type GomokuPoint
} from "@party-games/gomoku";
import { Check, ChevronLeft, ChevronRight, GraduationCap, RotateCcw } from "lucide-react";
import { useState } from "react";
import { syncGomokuProgress } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { GomokuBoard } from "./Board";
import {
  gomokuProgressItems,
  loadGomokuProgress,
  saveGomokuProgress,
  type GomokuLocalProgress
} from "./storage";

export function GomokuLearnPanel() {
  const { status: accountStatus } = useAccount();
  const [lessonIndex, setLessonIndex] = useState(0);
  const lesson = gomokuLessons[lessonIndex] ?? gomokuLessons[0];
  if (!lesson) return null;
  return (
    <LessonWorkspace
      key={lesson.id}
      lesson={lesson}
      lessonIndex={lessonIndex}
      syncAccount={Boolean(accountStatus?.authenticated)}
      onLesson={(index) => setLessonIndex(Math.max(0, Math.min(gomokuLessons.length - 1, index)))}
    />
  );
}

function LessonWorkspace({
  lesson,
  lessonIndex,
  onLesson,
  syncAccount
}: {
  lesson: GomokuLesson;
  lessonIndex: number;
  onLesson: (index: number) => void;
  syncAccount: boolean;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = lesson.exercises[exerciseIndex] ?? lesson.exercises[0];
  const [state, setState] = useState(() => exercise ? createGomokuExerciseState(exercise) : undefined);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [progress, setProgress] = useState<GomokuLocalProgress>(() => loadGomokuProgress());
  if (!exercise || !state) return null;

  const initialMoveCount = exercise.black.length + exercise.white.length;
  const playAt = (point: GomokuPoint) => {
    const correct = exercise.correctMoves.some((candidate) => candidate.x === point.x && candidate.y === point.y);
    if (!correct) {
      const analysis = GomokuPosition.fromMoves(state.moves).analyzePlacement(point, state.currentPlayer, state.ruleSet);
      setNotice(!analysis.legal && analysis.forbidden ? "这是黑方禁手，换一个合法落点" : "再观察当前课程强调的棋形");
      return;
    }
    const result = playGomokuMove(state, point, state.currentPlayer);
    if (!result.ok) return;
    setState(result.state);
    setSuccess(true);
    setNotice(exercise.success);
    setProgress((current) => {
      const next = { ...current, lessons: { ...current.lessons, [exercise.id]: true as const } };
      saveGomokuProgress(next);
      if (syncAccount) {
        void syncGomokuProgress({ items: gomokuProgressItems(next) }).catch(() => undefined);
      }
      return next;
    });
  };

  const reset = () => {
    setState(createGomokuExerciseState(exercise));
    setSuccess(false);
    setNotice(undefined);
  };

  const switchLesson = (next: number) => {
    setExerciseIndex(0);
    onLesson(next);
  };

  const switchExercise = (nextIndex: number) => {
    const next = lesson.exercises[nextIndex];
    if (!next) return;
    setExerciseIndex(nextIndex);
    setState(createGomokuExerciseState(next));
    setSuccess(false);
    setNotice(undefined);
  };

  return (
    <div className="gomoku-learn-layout">
      <aside className="gomoku-lesson-list">
        {gomokuLessons.map((candidate, index) => {
          const completed = candidate.exercises.every((item) => progress.lessons[item.id]);
          return (
            <button type="button" className={candidate.id === lesson.id ? "is-active" : ""} onClick={() => switchLesson(index)} key={candidate.id}>
              <span>{candidate.number}</span>
              <strong>{candidate.title}</strong>
              {completed ? <Check size={16} /> : null}
            </button>
          );
        })}
      </aside>

      <section className="gomoku-lesson-main">
        <header className="gomoku-content-heading">
          <div>
            <span className="eyebrow">课程 {lesson.number}/8</span>
            <h1>{lesson.title}</h1>
          </div>
          <GraduationCap size={28} />
        </header>
        <div className="gomoku-lesson-copy">
          <p>{lesson.concept}</p>
          <ul>{lesson.points.map((point) => <li key={point}>{point}</li>)}</ul>
        </div>
        <div className="gomoku-exercise-heading">
          <span>练习 {exerciseIndex + 1}/{lesson.exercises.length}</span>
          <strong>{exercise.prompt}</strong>
        </div>
        <div className="gomoku-board-frame">
          <GomokuBoard state={state} forbiddenPoints={[]} initialMoveCount={initialMoveCount} disabled={success} onPoint={playAt} />
        </div>
        {notice ? <p className={`gomoku-lesson-feedback ${success ? "is-success" : ""}`}>{notice}</p> : null}
        <div className="gomoku-lesson-actions">
          <button className="secondary-button" type="button" onClick={reset}><RotateCcw size={17} /> 重做</button>
          <div>
            {lesson.exercises.map((item, index) => (
              <button type="button" className={index === exerciseIndex ? "is-active" : ""} onClick={() => switchExercise(index)} aria-label={`练习 ${index + 1}`} key={item.id}>{index + 1}</button>
            ))}
          </div>
        </div>
      </section>

      <aside className="gomoku-lesson-nav">
        <span>课程进度</span>
        <strong>{Object.keys(progress.lessons).length} / {gomokuLessons.reduce((total, item) => total + item.exercises.length, 0)}</strong>
        <div>
          <button className="icon-button" type="button" disabled={lessonIndex === 0} onClick={() => switchLesson(lessonIndex - 1)} aria-label="上一课" title="上一课"><ChevronLeft size={19} /></button>
          <button className="icon-button" type="button" disabled={lessonIndex === gomokuLessons.length - 1} onClick={() => switchLesson(lessonIndex + 1)} aria-label="下一课" title="下一课"><ChevronRight size={19} /></button>
        </div>
      </aside>
    </div>
  );
}
