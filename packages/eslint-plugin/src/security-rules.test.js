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

tester.run('no-unvalidated-input', rules['no-unvalidated-input'], {
  valid: [
    'const input = await parseBody(context, createMemberSchema);',
    'const query = startQuerySchema.safeParse(context.req.query());',
    'context.req.path;',
  ],
  invalid: [
    { code: 'const body = await context.req.json();', errors: [{ messageId: 'raw' }] },
    { code: "const id = c.req.param('id');", errors: [{ messageId: 'raw' }] },
  ],
});

tester.run('no-unguarded-router', rules['no-unguarded-router'], {
  valid: ["const routes = createBoxRouter(); routes.get('/', STAFF, handler);"],
  invalid: [
    { code: 'const app = new Hono();', errors: [{ messageId: 'bareHono' }] },
    { code: "routes.router.post('/', handler);", errors: [{ messageId: 'innerRouter' }] },
  ],
});

tester.run('no-raw-sql', rules['no-raw-sql'], {
  valid: [
    'transaction.execute(sql`select * from members where id = ${id}`);',
    "sql.raw('now()');",
    "db.query('select 1');",
  ],
  invalid: [
    { code: 'sql.raw(column);', errors: [{ messageId: 'raw' }] },
    {
      code: 'db.execute(`select * from members where id = ${id}`);',
      errors: [{ messageId: 'built' }],
    },
    { code: "client.query('delete from x where id = ' + id);", errors: [{ messageId: 'built' }] },
  ],
});

tester.run('no-sensitive-logging', rules['no-sensitive-logging'], {
  valid: [
    "console.error('Unhandled API error', { name: error.name, path: context.req.path });",
    "logger.info('Booking created', { bookingId });",
  ],
  invalid: [
    { code: "console.log('login', { email, password });", errors: [{ messageId: 'sensitive' }] },
    { code: 'console.info(`session ${session.token}`);', errors: [{ messageId: 'sensitive' }] },
    { code: "logger.warn('member', member.cedula);", errors: [{ messageId: 'sensitive' }] },
  ],
});

tester.run('secure-cookie', rules['secure-cookie'], {
  valid: [
    "setCookie(c, 'gx', v, { httpOnly: true, secure: isSecure(c), sameSite: 'Lax' });",
    'setCookie(c, name, v, options);',
  ],
  invalid: [
    { code: "setCookie(c, 'gx', v);", errors: [{ messageId: 'missing' }] },
    {
      code: "setCookie(c, 'gx', v, { httpOnly: false, secure: true, sameSite: 'Lax' });",
      errors: [{ messageId: 'disabled' }],
    },
    {
      code: "setCookie(c, 'gx', v, { secure: true });",
      errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
    },
  ],
});
