import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./auth/session";
import { ActionError } from "./services/actions";
import { ImportError } from "./import/parse";
import { LiveAiUnavailable } from "./ai/openai";

/** Wrap a route handler: consistent JSON errors, no stack traces to the browser. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A) => {
    try {
      const r = await fn(...args);
      return r instanceof Response ? r : NextResponse.json(r);
    } catch (e) {
      if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
      if (e instanceof LiveAiUnavailable) return NextResponse.json({ error: e.message, code: "live_ai_unavailable" }, { status: 503 });
      if (e instanceof ActionError || e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function jsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ActionError("Invalid request.");
  }
}
