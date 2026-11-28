import { dataImportSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, respond } from '../../lib/service-route';
import { aiImportStatus } from '../../services/ai-import';
import { commitImport, getImport, listImports, previewImport } from '../../services/data-imports';
import { MANAGERS } from './roles';

const imports = createBoxRouter();

imports.get('/', MANAGERS, (context) =>
  respond(context, async (service) => ({ imports: await listImports(service) })),
);

imports.get('/ai-status', MANAGERS, (context) =>
  respond(context, async (service) => ({ status: await aiImportStatus(service) })),
);

// A POST because the rows travel in the body; it writes nothing.
imports.post('/preview', MANAGERS, (context) =>
  respond(context, async (service) => ({
    analysis: await previewImport(service, await parseBody(context, dataImportSchema)),
  })),
);

imports.post('/', MANAGERS, (context) =>
  respond(
    context,
    async (service) => commitImport(service, await parseBody(context, dataImportSchema)),
    201,
  ),
);

imports.get('/:importId', MANAGERS, (context) =>
  respond(context, async (service) => ({
    import: await getImport(service, idParam(context, 'importId', 'data_import')),
  })),
);

export const importRoutes = imports.router;
