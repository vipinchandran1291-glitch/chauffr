/** Fastify replies with `statusCode` and `message` when a handler throws one of these. */
export function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
