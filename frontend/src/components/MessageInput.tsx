import { type FormEvent, useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit: (content: string) => Promise<void>;
  timeRemaining: number;
  timeWarning: boolean;
}

const TURN_TIME_LIMIT = 240;

export function MessageInput({ disabled, onSubmit, timeRemaining, timeWarning }: Props) {
  const [content, setContent] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent || disabled) return;
    setContent("");
    await onSubmit(cleanContent);
  }

  const barPercent = Math.round((timeRemaining / TURN_TIME_LIMIT) * 100);

  return (
    <form className="composer glass" onSubmit={handleSubmit}>
      <textarea
        value={content}
        disabled={disabled}
        onChange={(event) => setContent(event.target.value)}
        aria-label="输入本轮评估回应"
        placeholder="输入你的回应。说明你先处理什么、怎么沟通、边界在哪、依据是什么。"
      />
      <div className="composer-foot">
        <div className="timer">
          <div className="timer-track">
            <div className="timer-fill" style={{ width: `${barPercent}%` }} />
          </div>
          <div className="timer-lg">
            本轮剩余 <b>{timeRemaining}s</b>
          </div>
        </div>
        <button className="btn btn-gold" disabled={disabled || !content.trim()} type="submit">
          发送
        </button>
      </div>
    </form>
  );
}
