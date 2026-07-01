import React from 'react';

interface ProfileSummaryProps {
  onConfirm: () => void;
}

export const ProfileSummary: React.FC<ProfileSummaryProps> = ({ onConfirm }) => {
  return (
    <div className="profile-summary-container">
      <h2>Profile Confirmed</h2>
      <p>Your learning profile has been ratified and saved. You're ready to plan your first week!</p>
      <div className="actions">
        <button onClick={onConfirm} className="confirm-btn">
          Go to Weekly Planner
        </button>
      </div>
    </div>
  );
};
