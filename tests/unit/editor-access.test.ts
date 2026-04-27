import { describe, it, expect } from 'vitest';
import { isEditorAuthorized } from '../../src/editor/access';

const TOKEN = 'super-secret-123';

describe('isEditorAuthorized (F11.1.x, SEC-7)', () => {
  it('accepts the matching token with editor=1', () => {
    expect(isEditorAuthorized(`?editor=1&token=${TOKEN}`, TOKEN)).toBe(true);
  });

  it('accepts when token comes before editor in the query string', () => {
    expect(isEditorAuthorized(`?token=${TOKEN}&editor=1`, TOKEN)).toBe(true);
  });

  it('rejects when editor flag is missing', () => {
    expect(isEditorAuthorized(`?token=${TOKEN}`, TOKEN)).toBe(false);
  });

  it('rejects when editor=0', () => {
    expect(isEditorAuthorized(`?editor=0&token=${TOKEN}`, TOKEN)).toBe(false);
  });

  it('rejects when token is missing', () => {
    expect(isEditorAuthorized('?editor=1', TOKEN)).toBe(false);
  });

  it('rejects when token is wrong', () => {
    expect(isEditorAuthorized('?editor=1&token=wrong', TOKEN)).toBe(false);
  });

  it('rejects when token is the empty string', () => {
    expect(isEditorAuthorized('?editor=1&token=', TOKEN)).toBe(false);
  });

  it('rejects when expectedToken is undefined (env var not set)', () => {
    expect(isEditorAuthorized(`?editor=1&token=${TOKEN}`, undefined)).toBe(false);
  });

  it('rejects when expectedToken is empty (SEC-7 — empty token does not unlock)', () => {
    expect(isEditorAuthorized('?editor=1&token=', '')).toBe(false);
  });

  it('rejects when search is empty', () => {
    expect(isEditorAuthorized('', TOKEN)).toBe(false);
  });

  it('is case-sensitive on the token', () => {
    expect(isEditorAuthorized(`?editor=1&token=${TOKEN.toUpperCase()}`, TOKEN)).toBe(false);
  });
});
