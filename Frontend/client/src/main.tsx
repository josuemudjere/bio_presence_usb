import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Point d'entrée unique du client React injecté dans la racine Vite.
createRoot(document.getElementById("root")!).render(<App />);
