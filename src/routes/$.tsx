import { createFileRoute } from "@tanstack/react-router";

// A result URL (/<pool address>, /currencies/<slug>). XCapApp in __root reads
// the path and runs the scan; this route only makes the server answer it.
export const Route = createFileRoute("/$")({ component: () => null });
