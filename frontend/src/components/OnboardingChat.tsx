import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: 'user' | 'coach';
  text: string;
}

interface OnboardingChatProps {
  userId: string;
  setUserId: (id: string) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  state: string;
  setState: React.Dispatch<React.SetStateAction<string>>;
  onOnboardingComplete: (nextState?: string) => void;
}

export const OnboardingChat: React.FC<OnboardingChatProps> = ({
  userId,
  setUserId,
  messages,
  setMessages,
  state,
  setState,
  onOnboardingComplete,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: userMsg, state }),
      });
      const data = await response.json();

      if (data.userId) {
        setUserId(data.userId);
      }

      const wasOnboarding = state.startsWith('ONBOARDING_');

      setMessages((prev) => [...prev, { sender: 'coach', text: data.response }]);
      setState(data.state);

      if ((wasOnboarding && data.state === 'PLANNING') || (state === 'PLANNING' && data.state === 'ACTIVE_WEEK')) {
        onOnboardingComplete(data.state);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [...prev, { sender: 'coach', text: "Sorry, I encountered an issue. Let's try that again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.map((msg, i) => (
          <div key={i} className={`message-bubble ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {loading && <div className="message-bubble coach typing">...</div>}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>
    </div>
  );
};
