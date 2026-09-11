export function safeStartupDiagnostic(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('Invalid configuration: ')) return error.message;
  return 'Backend startup failed';
}
