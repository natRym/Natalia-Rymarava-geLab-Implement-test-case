export function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        "Copy .env.example to .env and provide a value.",
    );
  }

  return value;
}