import React, { useState, useEffect } from 'react';

interface Session {
  id: string;
  topic: string;
  duration_minutes: number;
  scheduled_at: string;
  status: string;
}

interface WeeklyPlannerProps {
  userId: string;
  onBackToChat: () => void;
}

export const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId, onBackToChat }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/planning/latest?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch plan. Let\'s co-create one first.');
      }
      const data = await response.json();
      setPlan(data.plan);
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [userId]);

  if (loading) return <div className="loading">Loading your plan...</div>;

  return (
    <div className="weekly-planner">
      <h2>Weekly Planner</h2>
      {error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={onBackToChat}>Go back to chat to create a plan</button>
        </div>
      ) : (
        <div className="plan-details">
          <h3>Goal: {plan?.weekly_goal}</h3>
          <div className="sessions-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-item">
                <h4>{session.topic}</h4>
                <p>Scheduled: {new Date(session.scheduled_at).toLocaleString()}</p>
                <p>Duration: {session.duration_minutes} minutes</p>
                <p className={`status ${session.status}`}>Status: {session.status}</p>
              </div>
            ))}
          </div>
          <button onClick={onBackToChat} className="back-btn">Open Chat Coach</button>
        </div>
      )}
    </div>
  );
};
