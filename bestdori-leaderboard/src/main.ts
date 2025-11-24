import app from "./app.ts";

Deno.serve({ port: 8787 }, app.fetch);
