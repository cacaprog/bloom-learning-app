import { useState } from 'react';
import { OnboardingChat } from './components/OnboardingChat';
import { ProfileSummary } from './components/ProfileSummary';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { ReflectionPrompt } from './components/ReflectionPrompt';
import { RecoveryModal } from './components/RecoveryModal';
import { CalendarSyncConfirmation } from './components/CalendarSyncConfirmation';

interface CalendarSyncData {
  weeklyGoal: string;
  totalSessions: number;
  syncedCount: number;
  sessions: { topic: string; scheduledAt: string; synced: boolean }[];
}

function App() {
  const [userId, setUserId] = useState<string>('');
  const [view, setView] = useState<'onboarding' | 'summary' | 'planner'>('onboarding');
  const [showReflection, setShowReflection] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [calendarSync, setCalendarSync] = useState<CalendarSyncData | null>(null);
  const [reflectionPromptText] = useState('What went well in this session? What made starting feel easy?');

  const [chatMessages, setChatMessages] = useState<any[]>(() => [
    { sender: 'coach', text: "Welcome to Bloom! I'm here to support your self-directed learning. Let's start by learning about your goals. Ready to begin?" }
  ]);
  const [chatState, setChatState] = useState<string>('ONBOARDING_S1');

  const handleOnboardingComplete = (nextState?: string) => {
    if (nextState === 'ACTIVE_WEEK') {
      setView('planner');
    } else {
      setView('summary');
    }
  };

  const sendChatTurn = async (message: string) => {
    setChatMessages((prev) => [...prev, { sender: 'user', text: message }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message, state: chatState }),
      });
      const data = await response.json();

      if (data.userId) {
        setUserId(data.userId);
      }

      const wasOnboarding = chatState.startsWith('ONBOARDING_');
      const priorState = chatState;

      setChatMessages((prev) => [...prev, { sender: 'coach', text: data.response }]);
      setChatState(data.state);

      if (data.calendarSync) {
        setCalendarSync(data.calendarSync);
      }

      if ((wasOnboarding && data.state === 'PLANNING') || (priorState === 'PLANNING' && data.state === 'ACTIVE_WEEK')) {
        handleOnboardingComplete(data.state);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages((prev) => [...prev, { sender: 'coach', text: "Sorry, I encountered an issue. Let's try that again." }]);
    }
  };

  const handleConfirmProfile = async () => {
    setView('onboarding');
    await sendChatTurn('Yes, I confirm my profile.');
  };

  const handleBackToChat = () => {
    setView('onboarding');
  };

  const triggerReflection = () => {
    setShowReflection(true);
  };

  const triggerRecovery = () => {
    setShowRecovery(true);
  };

  const handleReflectionSubmit = async (responseText: string) => {
    if (!userId) return alert('Please start onboarding first to generate a user profile.');
    try {
      await fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          triggerType: 'session_completed',
          promptText: reflectionPromptText,
          responseText,
          skipped: false,
        }),
      });
      alert('Reflection saved successfully!');
      setShowReflection(false);
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

  const handleReflectionSkip = async () => {
    if (!userId) return setShowReflection(false);
    try {
      await fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          triggerType: 'session_completed',
          promptText: reflectionPromptText,
          responseText: '',
          skipped: true,
        }),
      });
      alert('Reflection skipped.');
      setShowReflection(false);
    } catch (error) {
      console.error('Error skipping reflection:', error);
    }
  };

  const handleRecoveryResolve = async () => {
    if (!userId) return setShowRecovery(false);
    try {
      setChatState('RECOVERY_INITIATE');
      setChatMessages((prev) => [
        ...prev,
        { sender: 'coach', text: "It looks like you missed your scheduled session. Showing up after a miss is what consistency actually looks like. Let me know what got in the way so we can adjust." }
      ]);
      setView('onboarding');
      setShowRecovery(false);
      alert('Recovery flow initiated! Go ahead and let the coach know what got in the way of your session.');
    } catch (error) {
      console.error('Error initiating recovery:', error);
    }
  };

  const handleReset = () => {
    setUserId('');
    setChatMessages([
      { sender: 'coach', text: "Welcome to Bloom! I'm here to support your self-directed learning. Let's start by learning about your goals. Ready to begin?" }
    ]);
    setChatState('ONBOARDING_S1');
    setView('onboarding');
    setShowRecovery(false);
    setShowReflection(false);
    setCalendarSync(null);
  };

  return (
    <div className="app-workspace">
      {/* Sidebar Controls */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Bloom.</h2>
          <p className="subtitle">AI Coaching Companion</p>
        </div>

        <div className="sidebar-section">
          <h3>Session Management</h3>
          <div className="session-info">
            <p><strong>User ID:</strong> <span className="mono">{userId || 'None (Start onboarding)'}</span></p>
            <p><strong>View:</strong> <span className="mono">{view.toUpperCase()}</span></p>
          </div>
          {userId && (
            <button onClick={handleReset} className="reset-btn">
              Reset Onboarding
            </button>
          )}
        </div>

        <div className="sidebar-section">
          <h3>Simulation Tools</h3>
          <button onClick={triggerReflection} className="simulation-btn flex-btn" disabled={!userId}>
            <span>Simulate Session Completed</span>
          </button>
          <button onClick={triggerRecovery} className="simulation-btn flex-btn" disabled={!userId}>
            <span>Simulate Missed Session</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="main-content">
        {showReflection && (
          <div className="modal-overlay">
            <ReflectionPrompt
              promptText={reflectionPromptText}
              onSubmit={handleReflectionSubmit}
              onSkip={handleReflectionSkip}
            />
          </div>
        )}

        {showRecovery && (
          <div className="modal-overlay">
            <RecoveryModal onResolve={handleRecoveryResolve} />
          </div>
        )}

        {calendarSync && (
          <div className="modal-overlay">
            <CalendarSyncConfirmation
              weeklyGoal={calendarSync.weeklyGoal}
              totalSessions={calendarSync.totalSessions}
              syncedCount={calendarSync.syncedCount}
              sessions={calendarSync.sessions}
              onContinue={() => setCalendarSync(null)}
            />
          </div>
        )}

        {view === 'onboarding' && (
          <div className="chat-view">
            <div className="view-header">
              <h1>Coaching Chat</h1>
              <p>Onboard and plan your learning goals with your AI companion.</p>
            </div>
            <OnboardingChat
              messages={chatMessages}
              onSendMessage={sendChatTurn}
            />
          </div>
        )}

        {view === 'summary' && (
          <div className="summary-view">
            <ProfileSummary onConfirm={handleConfirmProfile} />
          </div>
        )}

        {view === 'planner' && (
          <div className="planner-view">
            <WeeklyPlanner userId={userId} onBackToChat={handleBackToChat} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
