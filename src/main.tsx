import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // Fail silently in dev or unsupported environments
      });
  });
}