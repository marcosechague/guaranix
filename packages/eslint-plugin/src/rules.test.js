import parser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import plugin from './index.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const { rules } = plugin;

tester.run('no-literal-ui-text', rules['no-literal-ui-text'], {
  valid: [
    "<p>{t('member.home.greeting')}</p>",
    '<p>{count} · {total}</p>',
    '<Brodi alt="" />',
    '<TextField label={t(\'auth.login.email\')} type="email" />',
    '<div className="flex gap-2" data-testid="card" />',
  ],
  invalid: [
    { code: '<p>Reservá tu clase</p>', errors: [{ messageId: 'literal' }] },
    { code: '<Button aria-label="Cerrar" />', errors: [{ messageId: 'literal' }] },
    { code: '<TextField label="Email" />', errors: [{ messageId: 'literal' }] },
    { code: "<p>{ok ? 'Listo' : t('x')}</p>", errors: [{ messageId: 'literal' }] },
    { code: '<input placeholder={`Buscar`} />', errors: [{ messageId: 'literal' }] },
  ],
});

tester.run('no-emoji', rules['no-emoji'], {
  valid: ['const label = "₲ 300.000";', '<p>© GuaraniX</p>'],
  invalid: [
    { code: '<p>🔥</p>', errors: [{ messageId: 'emoji' }] },
    { code: 'const icon = "💪";', errors: [{ messageId: 'emoji' }] },
    { code: 'const done = `✅ ${name}`;', errors: [{ messageId: 'emoji' }] },
  ],
});

tester.run('no-raw-colors', rules['no-raw-colors'], {
  valid: [
    '<div className="bg-surface text-accent" />',
    "document.getElementById('root');",
    "const anchor = '#section-title';",
  ],
  invalid: [
    { code: '<div className="bg-[#0E0F11]" />', errors: [{ messageId: 'raw' }] },
    { code: "const color = '#fff';", errors: [{ messageId: 'raw' }] },
    { code: "const shadow = 'rgba(0, 0, 0, 0.4)';", errors: [{ messageId: 'raw' }] },
    { code: '<path fill="#EA4335" />', errors: [{ messageId: 'raw' }] },
  ],
});

tester.run('no-arbitrary-tailwind', rules['no-arbitrary-tailwind'], {
  valid: [
    '<div className="mx-auto max-w-md gap-4 p-5" />',
    "<div className={classNames('flex', open && 'opacity-100')} />",
    "const id = 'value-[x]';",
  ],
  invalid: [
    { code: '<div className="w-[13px]" />', errors: [{ messageId: 'arbitrary' }] },
    { code: '<div className="md:hover:bg-[#fff] p-2" />', errors: [{ messageId: 'arbitrary' }] },
    {
      code: "<div className={classNames('flex', open ? 'top-[3.5rem]' : '')} />",
      errors: [{ messageId: 'arbitrary' }],
    },
    { code: "cn('p-(--gap)')", errors: [{ messageId: 'arbitrary' }] },
  ],
});

tester.run('icon-button-label', rules['icon-button-label'], {
  valid: [
    "<Button aria-label={t('common.close')}><X /></Button>",
    "<Button><Plus />{t('member.home.bookClass')}</Button>",
    '<button><X /><span className="sr-only">{t(\'common.close\')}</span></button>',
    '<Button {...props}><X /></Button>',
  ],
  invalid: [
    { code: '<Button><X /></Button>', errors: [{ messageId: 'missing' }] },
    { code: '<a href="/settings"><Settings /></a>', errors: [{ messageId: 'missing' }] },
  ],
});

tester.run('prefer-ui-components', rules['prefer-ui-components'], {
  valid: ['<Button>{label}</Button>', '<TextField label={label} />', '<section className="p-4" />'],
  invalid: [
    { code: '<button>{label}</button>', errors: [{ messageId: 'raw' }] },
    { code: '<input type="text" />', errors: [{ messageId: 'raw' }] },
    { code: '<div style={{ padding: 4 }} />', errors: [{ messageId: 'style' }] },
  ],
});
