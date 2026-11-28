import { describe, expect, it } from 'vitest';
import { boxSlugSchema, slugFromName } from './box';

describe('slugFromName', () => {
  it.each([
    ['Ñu Guasú Training', 'nu-guasu-training'],
    ['  CrossFit  Lambaré!! ', 'crossfit-lambare'],
    ['Bx', 'box-bx'],
    ['???', 'box-nuevo'],
    [
      'Un nombre larguísimo para un box de entrenamiento funcional en Asunción',
      'un-nombre-larguisimo-para-un-box-de-entr',
    ],
  ])('turns %s into %s', (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
    expect(boxSlugSchema.safeParse(slugFromName(name)).success).toBe(true);
  });
});
