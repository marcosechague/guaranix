import iconButtonLabel from './rules/icon-button-label.js';
import noArbitraryTailwind from './rules/no-arbitrary-tailwind.js';
import noEmoji from './rules/no-emoji.js';
import noLiteralUiText from './rules/no-literal-ui-text.js';
import noRawColors from './rules/no-raw-colors.js';
import noRawSql from './rules/no-raw-sql.js';
import noSensitiveLogging from './rules/no-sensitive-logging.js';
import noUnguardedRouter from './rules/no-unguarded-router.js';
import noUnvalidatedInput from './rules/no-unvalidated-input.js';
import preferUiComponents from './rules/prefer-ui-components.js';
import secureCookie from './rules/secure-cookie.js';

/** Rules that turn the design, code and security rules in CLAUDE.md into lint errors. */
export default {
  meta: { name: '@guaranix/eslint-plugin' },
  rules: {
    'icon-button-label': iconButtonLabel,
    'no-arbitrary-tailwind': noArbitraryTailwind,
    'no-emoji': noEmoji,
    'no-literal-ui-text': noLiteralUiText,
    'no-raw-colors': noRawColors,
    'prefer-ui-components': preferUiComponents,
    'no-raw-sql': noRawSql,
    'no-sensitive-logging': noSensitiveLogging,
    'no-unguarded-router': noUnguardedRouter,
    'no-unvalidated-input': noUnvalidatedInput,
    'secure-cookie': secureCookie,
  },
};
