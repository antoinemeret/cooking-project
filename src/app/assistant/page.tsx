import { ChatInterface } from "@/components/chat/ChatInterface"

export default function AssistantPage() {
  return (
    <div className="h-screen max-h-screen flex flex-col">
      <ChatInterface className="flex-1 min-h-0" />
    </div>
  )
} 