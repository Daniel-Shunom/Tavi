import { expect, it } from 'vitest';
import { performableExpressions } from '../shared/capabilities';
import { expressionIds, expressions } from '../shared/expressions';
import { systemPrompt } from '../server/ai/prompt';
import { decisionJsonSchema } from '../shared/decision';
import { catalog } from '../src/renderer/characters/registry';

it('offers every performable library expression to the AI automatically', () => {
  for (const character of Object.values(catalog)) {
    const performable = performableExpressions(character);
    const prompt = systemPrompt({
      persona: {
        name: 'Tavi',
        attitude: 'cheeky',
        initiative: 'occasional',
        personality: 'cozy',
        energy: 40,
        chatEngagement: 20,
      },
      character,
    });
    for (const id of performable) expect(prompt, id).toContain(`- ${id} [`);
    expect(decisionJsonSchema(character).properties.beats.items.properties.expression.enum).toEqual(
      performable,
    );
    // Every selectable library expression is either performable or resolvable/droppable.
    expect(performable.length).toBeGreaterThan(0);
  }
  expect(expressionIds.filter((id) => expressions[id].selectable).length).toBeGreaterThan(40);
});
