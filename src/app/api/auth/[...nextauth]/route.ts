/**
 * Rota de handlers do Auth.js v5.
 * Delega GET e POST ao handler central configurado em src/auth.ts.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
