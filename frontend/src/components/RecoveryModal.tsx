import React from 'react';

interface RecoveryModalProps {
  onResolve: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({ onResolve }) => {
  return (
    <div className="recovery-modal">
      <h3>Missed Session Recovery</h3>
      <p>I noticed you missed a planned study session. No judgment—life happens. Let's get back on track together!</p>
      <button onClick={onResolve} className="resolve-btn">
        Reschedule / Keep Going
      </button>
    </div>
  );
};
