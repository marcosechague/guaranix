import guaranix from '@guaranix/eslint-plugin';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const APPS = ['apps/member', 'apps/admin', 'apps/platform'];
const APP_SOURCES = APPS.map((app) => `${app}/src/**/*.{ts,tsx}`);
const UI_SOURCES = [...APP_SOURCES, 'packages/ui/src/**/*.{ts,tsx}'];
const TESTS = ['**/*.test.{ts,tsx}', '**/__tests__/**', 'apps/api/src/testing/**'];
const SERVER_SOURCES = [
  'apps/api/src/**/*.ts',
  'packages/*/src/**/*.ts',
  'packages/*/scripts/**/*.ts',
];

// Routes that are public on purpose (login, health). Anything else uses createBoxRouter().
const PUBLIC_ROUTE_FILES = [
  'apps/api/src/app.ts',
  'apps/api/src/middleware/box-scope.ts',
  'apps/api/src/middleware/platform-scope.ts',
  'apps/api/src/middleware/account-scope.ts',
  'apps/api/src/routes/auth-*.ts',
  'apps/api/src/routes/health.ts',
  // Called by Telegram's servers; authenticated by the webhook secret header.
  'apps/api/src/routes/telegram-webhook.ts',
];
// Code allowed to read the request directly: the Zod helpers, and the Google callback's OAuth params.
const RAW_INPUT_FILES = [
  'apps/api/src/lib/http.ts',
  'apps/api/src/lib/service-route.ts',
  'apps/api/src/routes/auth-google.ts',
];
// Code allowed to skip Row Level Security. Each one authorizes on its own (login, sessions, rate limits).
const SYSTEM_SCOPE_FILES = [
  'apps/api/src/services/sessions.ts',
  'apps/api/src/services/google-auth.ts',
  'apps/api/src/services/password-auth.ts',
  'apps/api/src/services/rate-limit.ts',
  // Superadmin: requires users.is_platform_admin and audits every change to a box.
  'apps/api/src/middleware/platform-scope.ts',
  // Creating a box: the caller has no box yet; services touch only what they create.
  'apps/api/src/middleware/account-scope.ts',
  // Cron: lists the boxes to visit, then works inside each box's own scope.
  'apps/api/src/jobs/upcoming-classes.ts',
  // AI import: reads the platform's provider key and fills in the tokens of the box's own use row.
  'apps/api/src/services/ai-import.ts',
  // Notification queue consumer and crons: push subscriptions, Telegram links and
  // preferences belong to a person, not a box. Every query names the box or user.
  'apps/api/src/services/notifications/expand.ts',
  'apps/api/src/services/notifications/deliver.ts',
  'apps/api/src/services/notifications/targets.ts',
  'apps/api/src/services/notifications/telegram-webhook.ts',
  'apps/api/src/jobs/notification-sweeper.ts',
  'apps/api/src/jobs/notifying-boxes.ts',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.wrangler/**',
      '**/dev-dist/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: [
      'apps/member/**/*.tsx',
      'apps/admin/**/*.tsx',
      'apps/platform/**/*.tsx',
      'packages/ui/**/*.tsx',
    ],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Design and reuse rules from CLAUDE.md ("Diseño", "Reglas de código"), for the three apps and packages/ui.
  {
    files: UI_SOURCES,
    ignores: TESTS,
    plugins: { guaranix },
    rules: {
      'guaranix/no-literal-ui-text': 'error',
      'guaranix/no-emoji': 'error',
      'guaranix/no-raw-colors': 'error',
      'guaranix/icon-button-label': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML abre la puerta a XSS. Renderizá texto o componentes.',
        },
      ],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // The tokens are where raw colors are allowed to live.
    files: ['packages/ui/src/tokens/**'],
    rules: { 'guaranix/no-raw-colors': 'off' },
  },
  {
    // Apps compose screens from packages/ui; anything new and reusable is built there.
    files: APP_SOURCES,
    ignores: TESTS,
    rules: {
      'guaranix/no-arbitrary-tailwind': 'error',
      'guaranix/prefer-ui-components': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@radix-ui/*'],
              message:
                'Radix se usa solo dentro de packages/ui. Importá el componente de @guaranix/ui.',
            },
            {
              group: ['@guaranix/ui/src/*', '**/packages/ui/src/*'],
              message: 'Importá desde @guaranix/ui (o sus entradas públicas), no desde src/.',
            },
          ],
        },
      ],
    },
  },
  // Security rules from CLAUDE.md ("Seguridad") for the API and the server-side packages.
  {
    files: SERVER_SOURCES,
    ignores: TESTS,
    plugins: { guaranix },
    rules: {
      'guaranix/no-raw-sql': 'error',
      'guaranix/no-sensitive-logging': 'error',
      'guaranix/secure-cookie': 'error',
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [...TESTS, ...SYSTEM_SCOPE_FILES],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@guaranix/db',
              importNames: ['withSystemScope'],
              message:
                'withSystemScope se saltea el aislamiento por box_id. Usá el transaction de createBoxRouter(); si de verdad hace falta, agregá el archivo a SYSTEM_SCOPE_FILES en eslint.config.js y registrá audit_logs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [...TESTS, ...PUBLIC_ROUTE_FILES],
    rules: { 'guaranix/no-unguarded-router': 'error' },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [...TESTS, ...RAW_INPUT_FILES],
    rules: { 'guaranix/no-unvalidated-input': 'error' },
  },
);
