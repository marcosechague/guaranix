import { describe, expect, it } from 'vitest';
import { routeFor } from './routing';

describe('routeFor', () => {
  it('sends /api and everything under it to the API without the prefix', () => {
    expect(routeFor('POST', '/api/auth/login')).toEqual({ kind: 'api', path: '/auth/login' });
    expect(routeFor('GET', '/api')).toEqual({ kind: 'api', path: '/' });
    expect(routeFor('GET', '/api/')).toEqual({ kind: 'api', path: '/' });
  });

  it('does not treat a path that only starts with "api" as the API', () => {
    expect(routeFor('GET', '/apis')).toEqual({ kind: 'app', indexPath: '/' });
  });

  it('serves each prefixed app its own index for client-side routes', () => {
    expect(routeFor('GET', '/panel/alumnos/123')).toEqual({ kind: 'app', indexPath: '/panel/' });
    expect(routeFor('GET', '/plataforma/boxes')).toEqual({
      kind: 'app',
      indexPath: '/plataforma/',
    });
  });

  it('adds the trailing slash to a bare prefix', () => {
    expect(routeFor('GET', '/panel')).toEqual({ kind: 'redirect', location: '/panel/' });
  });

  it('sends every other route to the member app', () => {
    expect(routeFor('GET', '/reset-password')).toEqual({ kind: 'app', indexPath: '/' });
    expect(routeFor('HEAD', '/wod')).toEqual({ kind: 'app', indexPath: '/' });
    // Not a prefix match: a member route that happens to start with "panel".
    expect(routeFor('GET', '/panelista')).toEqual({ kind: 'app', indexPath: '/' });
  });

  it('answers 404 for missing files and for writes outside the API', () => {
    expect(routeFor('GET', '/assets/index-old.js')).toEqual({ kind: 'not_found' });
    expect(routeFor('GET', '/panel/assets/missing.css')).toEqual({ kind: 'not_found' });
    expect(routeFor('POST', '/panel/alumnos')).toEqual({ kind: 'not_found' });
  });
});
