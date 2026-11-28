import { describe, expect, it } from 'vitest';
import { buildRequest, draftFromProposal } from './import-draft';
import { sheetsAsText } from './prepare-ai-file';

describe('AI import draft', () => {
  it('turns proposed rows into a draft with the import fields as columns', () => {
    const draft = draftFromProposal('cuaderno.jpg', {
      members: [
        { fullName: 'Ana Gómez', balanceGs: '150.000' },
        { firstName: 'Luis', lastName: 'Benítez', planName: 'Pack 10' },
      ],
      plans: [],
    });
    expect(draft?.source).toBe('ai');
    expect(draft?.plans).toBeNull();
    if (!draft) return;
    const { request, lines } = buildRequest(draft, {
      balanceDescription: 'Saldo',
      skipInvalidRows: false,
    });
    expect(request.source).toBe('ai');
    expect(request.members).toEqual([
      { fullName: 'Ana Gómez', balanceGs: '150.000' },
      { firstName: 'Luis', lastName: 'Benítez', planName: 'Pack 10' },
    ]);
    // Numbered as the admin saw them in the AI review, from 1.
    expect(lines).toEqual([1, 2]);
  });

  it('has nothing to review when no member was found', () => {
    expect(
      draftFromProposal('foto.jpg', { members: [], plans: [{ name: 'Ilimitado' }] }),
    ).toBeNull();
  });

  it('sends every non-empty sheet as tab-separated text', () => {
    const text = sheetsAsText([
      {
        name: 'Socios',
        rows: [
          ['Nombre', 'Debe'],
          ['Ana', '150.000'],
        ],
      },
      { name: 'Vacía', rows: [['', '']] },
    ]);
    expect(text).toBe('# Socios\nNombre\tDebe\nAna\t150.000');
  });
});
