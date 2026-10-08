import React from "react";
import ReactDOM from "react-dom/client";
import SEMAIApp, { SUPABASE_URL, SUPABASE_ANON_KEY } from "./App.jsx";
import { ErrorBoundary, installErrorLogging } from "./errorLogging.jsx";

installErrorLogging({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SEMAIApp />
    </ErrorBoundary>
  </React.StrictMode>
);
