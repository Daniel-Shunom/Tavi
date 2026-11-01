export function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before starting the judging service.`);
  return value;
}
