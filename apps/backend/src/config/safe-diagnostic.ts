export function safeStartupDiagnostic(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('Invalid configuration: ')) {
    const setting = error.message.slice('Invalid configuration: '.length).match(/^[A-Z0-9_]+/)?.[0];
    return setting ? `Invalid configuration: ${setting}` : 'Invalid configuration';
  }
  return 'Backend startup failed';
}
