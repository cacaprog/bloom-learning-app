import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: 'user' | 'coach';
  text: string;
}

interface OnboardingChatProps {
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
}

export const OnboardingChat: React.FC<OnboardingChatProps> = ({ messages, onSendMessage }) => {
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
    setLoading(true);
    try {
      await onSendMessage(userMsg);
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
