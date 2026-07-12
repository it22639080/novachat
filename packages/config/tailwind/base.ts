import type { Config } from "tailwindcss";

export const sharedTailwindContent = [
  "../../packages/ui/src/**/*.{ts,tsx}",
  "./src/**/*.{ts,tsx}"
] satisfies Config["content"];
