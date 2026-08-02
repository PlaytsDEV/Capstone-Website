import { useState } from "react";
import { createRoot } from "react-dom/client";
import PasswordVisibilityButton from "../shared/components/PasswordVisibilityButton";

function PasswordField({ testId, value, onChange }) {
  const [visible, setVisible] = useState(false);

  return (
    <div data-testid={testId}>
      <input
        aria-label={testId}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
      />
      <PasswordVisibilityButton
        visible={visible}
        onToggle={() => setVisible((current) => !current)}
      />
    </div>
  );
}

function Harness() {
  const [password, setPassword] = useState("Secret-123!");
  const [confirmation, setConfirmation] = useState("Secret-123!");
  const [errors, setErrors] = useState(0);
  const [submits, setSubmits] = useState(0);

  return (
    <form
      data-testid="form"
      data-submits={submits}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmits((count) => count + 1);
      }}
    >
      <PasswordField testId="password" value={password} onChange={setPassword} />
      <PasswordField testId="confirmation" value={confirmation} onChange={setConfirmation} />
      <button type="button" data-testid="validation" onClick={() => setErrors((count) => count + 1)}>
        Validate
      </button>
      <output data-testid="errors">{errors}</output>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
