function LogItem({ log }) {
  return (
    <div className="log-item">
      <span className="log-time">{log.timestamp}</span>
      <span className="log-user">{log.user}</span>
      <span className="log-action">{log.action}</span>
    </div>
  );
}

export default LogItem;
