import type { Message } from "../../types/assessment";
import { ChatBubble } from "../ChatBubble";

export function SessionReplay({ messages }: { messages: Message[] }) {
  return (
    <div className="session-replay">
      {messages.map((message) => (
        <ChatBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
