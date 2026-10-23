/**
 * Extract test result (pass or fail) from provider stdout.
 */
export function parseTestResultOutput(stdout: string): "pass" | "fail" | null {
  const lower = stdout.trim().toLowerCase();
  if (/\bpass\b/.test(lower)) return "pass";
  if (/\bfail\b/.test(lower)) return "fail";
  return null;
}
