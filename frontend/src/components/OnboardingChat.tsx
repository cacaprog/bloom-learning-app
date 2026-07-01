import React, { useState } from 'react';

interface Message {
  sender: 'user' | 'coach';
  text: string;
}

interface OnboardingChatProps {
  userId: string;
  setUserId: (id: string) => void;
  onOnboardingComplete: () => void;
}

export const OnboardingChat: React.FC<OnboardingChatProps> = ({
  userId,
  setUserId,
  onOnboardingComplete,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'coach', text: "Welcome to Bloom! I'm here to support your self-directed learning. Let's start by learning about your goals. Ready to begin?" },
  ]);
  const [input, setInput] = useState('');
  const [state, setState] = useState('ONBOARDING_S1');
  const [loading, setLoading] = useState(false);

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

      setMessages((prev) => [...prev, { sender: 'coach', text: data.response }]);
      setState(data.state);

      if (data.state === 'PLANNING') {
        onOnboardingComplete();
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
