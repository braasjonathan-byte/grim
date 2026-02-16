import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme from localStorage before render
const storedTheme = localStorage.getItem("gymberget_theme");
const shouldBeDark = storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
if (shouldBeDark) {
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
} else {
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.add("light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#ffffff");
}

createRoot(document.getElementById("root")!).render(<App />);
