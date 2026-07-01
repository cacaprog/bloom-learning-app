import React, { useState } from 'react';

interface ReflectionPromptProps {
  promptText: string;
  onSubmit: (response: string) => void;
  onSkip: () => void;
}

export const ReflectionPrompt: React.FC<ReflectionPromptProps> = ({ promptText, onSubmit, onSkip }) => {
  const [response, setResponse] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(response);
  };

  return (
    <div className="reflection-prompt-card">
      <h3>Pause & Reflect</h3>
      <p className="prompt-text">{promptText}</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="How did it go? (Optional)"
          rows={3}
        />
        <div className="reflection-actions">
          <button type="submit" className="submit-btn" disabled={!response.trim()}>
            Save Reflection
          </button>
          <button type="button" className="skip-btn" onClick={onSkip}>
            Skip
          </button>
        </div>
      </form>
    </div>
  );
};
