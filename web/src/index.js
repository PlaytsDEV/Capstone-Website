import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./shared/lib/queryClient";
import "./index.css";
import "./shared/styles/notification.css";
import App from "./App";
// Make all date/time input fields trigger their native picker when clicked anywhere on the field
if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      !target.disabled &&
      !target.readOnly &&
      (target.type === "date" ||
        target.type === "time" ||
        target.type === "datetime-local" ||
        target.type === "month")
    ) {
      if (typeof target.showPicker === "function") {
        try {
          target.showPicker();
        } catch (_) {
          // Ignored if showPicker is unsupported or already open
        }
      }
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

