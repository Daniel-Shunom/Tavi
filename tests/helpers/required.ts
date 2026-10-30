export function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Required test fixture is missing');
  return value;
}
