import React from "react";

const LogItem = ({ log }) => {
  return (
    <div className="log-item">
      <span className="log-timestamp">{log.timestamp}</span>
      <span className="log-user">{log.user}</span>
      <span className="log-action">{log.action}</span>
      <span className="log-details">{log.details}</span>
    </div>
  );
};

export default LogItem;
