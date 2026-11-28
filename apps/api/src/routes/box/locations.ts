import { createLocationSchema, updateLocationSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, respond } from '../../lib/service-route';
import { createLocation, listLocations, updateLocation } from '../../services/locations';
import { wallQrFor } from '../../services/wall-qr';
import { ANY_ROLE, MANAGERS } from './roles';

const locations = createBoxRouter();

locations.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({ locations: await listLocations(service) })),
);

locations.post('/', MANAGERS, (context) =>
  respond(
    context,
    async (service) => ({
      location: await createLocation(service, await parseBody(context, createLocationSchema)),
    }),
    201,
  ),
);

locations.patch('/:locationId', MANAGERS, (context) =>
  respond(context, async (service) => {
    const locationId = idParam(context, 'locationId', 'location');
    const input = await parseBody(context, updateLocationSchema);
    return { location: await updateLocation(service, locationId, input) };
  }),
);

/** The printable poster's QR for the wall check-in. */
locations.get('/:locationId/wall-qr', MANAGERS, (context) =>
  respond(context, async (service) => ({
    poster: await wallQrFor(
      service,
      context.env.AUTH_SECRET,
      context.env.MEMBER_APP_URL,
      idParam(context, 'locationId', 'location'),
    ),
  })),
);

export const locationRoutes = locations.router;
