import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import WorkbenchLaunchGate from "./workbench/WorkbenchLaunchGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkbenchLaunchGate><App /></WorkbenchLaunchGate>
  </StrictMode>,
);
