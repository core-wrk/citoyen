import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ApiClient } from "./lib/client";
import type { AppConfig } from "../shared/contracts";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
fetch("/api/config")
  .then(async (response) => {
    if (!response.ok) throw new Error();
    const config: AppConfig = await response.json();
    root.render(<App client={new ApiClient(config)} />);
  })
  .catch(() =>
    root.render(
      <main className="standalone">
        <h1>Your study space could not connect.</h1>
        <p>Check your connection and try again.</p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>,
    ),
  );
