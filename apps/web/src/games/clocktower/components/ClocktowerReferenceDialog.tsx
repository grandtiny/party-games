import {
  TROUBLE_BREWING_REFERENCE_ROLES,
  TROUBLE_BREWING_RULES_REFERENCE,
  type RoleType
} from "@party-games/clocktower";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { RulesAnswerResponse } from "@party-games/shared";
import { askClocktowerRules } from "../../../api";

const ROLE_TYPES: Array<{ type: RoleType; label: string }> = [
  { type: "townsfolk", label: "镇民" },
  { type: "outsider", label: "外来者" },
  { type: "minion", label: "爪牙" },
  { type: "demon", label: "恶魔" }
];

export function ClocktowerReferenceButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="reference-button"
        type="button"
        aria-label="规则与角色资料"
        title="规则与角色资料"
        onClick={() => dialogRef.current?.showModal()}
      >
        <BookOpen size={19} />
        <span>资料</span>
      </button>
      <ClocktowerReferenceDialog dialogRef={dialogRef} />
    </>
  );
}

function ClocktowerReferenceDialog({
  dialogRef
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [mode, setMode] = useState<"roles" | "rules" | "qa">("roles");
  const [roleType, setRoleType] = useState<RoleType>("townsfolk");
  const [selectedRoleId, setSelectedRoleId] = useState("washerwoman");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RulesAnswerResponse>();
  const [questionError, setQuestionError] = useState<string>();
  const [asking, setAsking] = useState(false);
  const roles = useMemo(
    () => TROUBLE_BREWING_REFERENCE_ROLES.filter((role) => role.type === roleType),
    [roleType]
  );
  const selectedRole =
    TROUBLE_BREWING_REFERENCE_ROLES.find((role) => role.id === selectedRoleId) ?? roles[0];

  const selectType = (type: RoleType) => {
    setRoleType(type);
    const firstRole = TROUBLE_BREWING_REFERENCE_ROLES.find((role) => role.type === type);
    if (firstRole) setSelectedRoleId(firstRole.id);
  };

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2 || asking) return;
    setAsking(true);
    setQuestionError(undefined);
    try {
      setAnswer(await askClocktowerRules({ question: trimmed }));
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "规则问答失败");
    } finally {
      setAsking(false);
    }
  };

  return (
    <dialog
      className="reference-dialog"
      ref={dialogRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="reference-dialog__frame">
        <header className="reference-dialog__header">
          <span>
            <BookOpen size={21} />
            <strong>暗流涌动资料</strong>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭资料"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} />
          </button>
        </header>

        <div className="reference-tabs" role="tablist" aria-label="资料类型">
          <button
            className={mode === "roles" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "roles"}
            onClick={() => setMode("roles")}
          >
            角色
          </button>
          <button
            className={mode === "rules" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "rules"}
            onClick={() => setMode("rules")}
          >
            规则
          </button>
          <button
            className={mode === "qa" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "qa"}
            onClick={() => setMode("qa")}
          >
            问答
          </button>
        </div>

        <div className="reference-dialog__body">
          {mode === "roles" ? (
            <>
              <div className="role-type-tabs" role="tablist" aria-label="角色类型">
                {ROLE_TYPES.map((item) => (
                  <button
                    className={roleType === item.type ? `is-active type-${item.type}` : ""}
                    type="button"
                    role="tab"
                    aria-selected={roleType === item.type}
                    onClick={() => selectType(item.type)}
                    key={item.type}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="role-reference-layout">
                <nav className="role-reference-list" aria-label="角色列表">
                  {roles.map((role) => (
                    <button
                      className={role.id === selectedRole?.id ? "is-active" : ""}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      key={role.id}
                    >
                      <strong>{role.name}</strong>
                      <small>{role.englishName}</small>
                    </button>
                  ))}
                </nav>

                {selectedRole ? (
                  <article className={`role-reference-detail type-${selectedRole.type}`}>
                    <div className="role-reference-detail__heading">
                      <span className="role-type-label">{roleTypeLabel(selectedRole.type)}</span>
                      <small>{selectedRole.englishName}</small>
                      <h2>{selectedRole.name}</h2>
                      <p>{selectedRole.guide.overview}</p>
                    </div>

                    <section className="role-ability-block">
                      <span>角色能力</span>
                      <p>{selectedRole.ability}</p>
                    </section>

                    <section className="reference-section">
                      <h3>行动时机</h3>
                      <p>{selectedRole.guide.timing}</p>
                    </section>
                    <section className="reference-section">
                      <h3>规则说明</h3>
                      <ul>
                        {selectedRole.guide.rules.map((rule) => <li key={rule}>{rule}</li>)}
                      </ul>
                    </section>
                    <section className="reference-section">
                      <h3>注意事项</h3>
                      <ul>
                        {selectedRole.guide.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    </section>
                  </article>
                ) : null}
              </div>
            </>
          ) : mode === "rules" ? (
            <div className="rules-reference-list">
              {TROUBLE_BREWING_RULES_REFERENCE.map((section) => (
                <section className="reference-section" key={section.id}>
                  <h2>{section.title}</h2>
                  <p>{section.summary}</p>
                  {section.ordered ? (
                    <ol>
                      {section.points.map((point) => <li key={point}>{point}</li>)}
                    </ol>
                  ) : (
                    <ul>
                      {section.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="rules-question-panel">
              <form onSubmit={askQuestion}>
                <label htmlFor="rules-question">规则问题</label>
                <div>
                  <input
                    id="rules-question"
                    value={question}
                    maxLength={300}
                    placeholder="例如：死亡玩家还能投票吗"
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <button className="primary-button" type="submit" disabled={asking || question.trim().length < 2}>
                    {asking ? "查询中" : "提问"}
                  </button>
                </div>
              </form>
              {questionError ? <p className="form-error">{questionError}</p> : null}
              {answer ? (
                <article className="rules-answer" aria-live="polite">
                  <header>
                    <strong>规则答复</strong>
                    <span>{answer.source === "model" ? "大模型 · 本地资料约束" : "本地资料"}</span>
                  </header>
                  {answer.answer.split("\n").map((paragraph, index) =>
                    paragraph ? <p key={`${paragraph}-${index}`}>{paragraph}</p> : <br key={`break-${index}`} />
                  )}
                </article>
              ) : null}
            </div>
          )}
        </div>

        <footer className="reference-dialog__footer">
          <span>资料已随网页保存在本地</span>
          <a
            href="https://wiki.bloodontheclocktower.com/Trouble_Brewing"
            target="_blank"
            rel="noreferrer"
          >
            官方资料 <ExternalLink size={14} />
          </a>
        </footer>
      </div>
    </dialog>
  );
}

function roleTypeLabel(type: RoleType): string {
  return ROLE_TYPES.find((item) => item.type === type)?.label ?? type;
}
