import { buildAdminEmailSet, DEFAULT_ADMIN_EMAILS, isConfiguredAdminEmail } from './adminEmails';

describe('adminEmails', () => {
  it('defaults to gvc1990 only — admin@aycindustries.com must not be admin', () => {
    expect(DEFAULT_ADMIN_EMAILS).toEqual(['gvc1990@gmail.com']);
    const set = buildAdminEmailSet();
    expect(isConfiguredAdminEmail('gvc1990@gmail.com', set)).toBe(true);
    expect(isConfiguredAdminEmail('admin@aycindustries.com', set)).toBe(false);
    expect(isConfiguredAdminEmail('GVC1990@GMAIL.COM', set)).toBe(true);
  });

  it('merges optional REACT_APP_* CSV lists without restoring removed default', () => {
    const set = buildAdminEmailSet('ops@example.com');
    expect(set.has('ops@example.com')).toBe(true);
    expect(set.has('admin@aycindustries.com')).toBe(false);
  });
});
