import React from 'react';

interface CalendarSyncSession {
  topic: string;
  scheduledAt: string;
  synced: boolean;
}

interface CalendarSyncConfirmationProps {
  weeklyGoal: string;
  totalSessions: number;
  syncedCount: number;
  sessions: CalendarSyncSession[];
  onContinue: () => void;
}

export const CalendarSyncConfirmation: React.FC<CalendarSyncConfirmationProps> = ({
  weeklyGoal,
  totalSessions,
  syncedCount,
  sessions,
  onContinue,
}) => {
  const allSynced = syncedCount === totalSessions;
  const unsynced = sessions.filter((s) => !s.synced);

  return (
    <div className="calendar-sync-modal">
      <h3>Plan Confirmed</h3>
      <p>
        Your plan for "{weeklyGoal}" is set.{' '}
        {allSynced
          ? `${totalSessions} session${totalSessions !== 1 ? 's were' : ' was'} scheduled and added to your Bloom calendar.`
          : `${syncedCount} of ${totalSessions} sessions were scheduled and added to your Bloom calendar.`}
      </p>
      {!allSynced && unsynced.length > 0 && (
        <div className="calendar-sync-warning">
          <p>These sessions couldn't be added — you may need to add them yourself:</p>
          <ul>
            {unsynced.map((s, i) => (
              <li key={i}>
                {s.topic} — {new Date(s.scheduledAt).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button onClick={onContinue} className="confirm-btn">
          Continue
        </button>
      </div>
    </div>
  );
};
