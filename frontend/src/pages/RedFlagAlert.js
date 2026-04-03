import React, { useState } from 'react';

const RedFlagAlert = ({ record, onDismiss }) => {
  const [expanded, setExpanded] = useState(true);
  if (!record || !expanded) return null;

  return (
    <div className="redflag-overlay">
      <div className="redflag-modal">
        <div className="redflag-header">
          <span className="redflag-icon">🚨</span>
          <h2>Account Flagged — RED FLAG</h2>
        </div>

        <div className="redflag-body">
          <p className="redflag-intro">
            Our AI Defense Engine has detected suspicious activity on your account.
        