import type { Message } from "../types/assessment";

export function ChatBubble({ message }: { message: Message }) {
  if (message.senderType === "typing") {
    return (
      <div className="typing" aria-label="对方正在输入">
        <span />
        <span />
        <span />
      </div>
    );
  }

  const isSystem = message.senderType === "system" || (message.senderName ?? "").includes("评估系统");
  if (isSystem) {
    return (
      <div className="observe">
        <span className="who">系统观察</span>
        <p>{message.content}</p>
      </div>
    );
  }

  const isUser = message.senderType === "user";
  return (
    <article className={`msg ${isUser ? "user" : "npc"}`}>
      <span className="who">
        {isUser ? message.senderName : `${message.senderName}${message.senderRole ? ` · ${message.senderRole}` : ""}`}
      </span>
      <div className="bubble">{message.content}</div>
    </article>
  );
}
