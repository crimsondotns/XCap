import { createFileRoute } from "@tanstack/react-router";

// The app itself is mounted by __root; each route only claims its URL.
export const Route = createFileRoute("/")({ component: () => null });
