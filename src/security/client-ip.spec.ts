import type { Request } from 'express';
import {
  resolveAccountTracker,
  resolveClientIp,
  resolveIpTracker,
  resolveThrottleTracker,
} from './client-ip';

describe('client-ip', (): void => {
  const request = (headers: Record<string, string>, ip?: string): Request =>
    ({
      headers,
      ip,
      socket: { remoteAddress: '10.0.0.1' },
    }) as unknown as Request;

  const jwtWithEmail = (email: string): string => {
    const payload: string = Buffer.from(JSON.stringify({ email })).toString(
      'base64url',
    );

    return `header.${payload}.signature`;
  };

  describe('resolveClientIp', (): void => {
    it('should prefer the address forwarded by the frontend proxy', (): void => {
      const ip: string = resolveClientIp(
        request({
          'x-client-ip': '203.0.113.10',
          'cf-connecting-ip': '172.71.172.187',
        }),
      );

      expect(ip).toBe('203.0.113.10');
    });

    it('should fall back to the Cloudflare header', (): void => {
      const ip: string = resolveClientIp(
        request({ 'cf-connecting-ip': '172.71.172.187' }),
      );

      expect(ip).toBe('172.71.172.187');
    });

    it('should ignore a forwarded value that is not an address', (): void => {
      const ip: string = resolveClientIp(
        request({ 'x-client-ip': 'unknown' }, '192.0.2.5'),
      );

      expect(ip).toBe('192.0.2.5');
    });

    it('should fall back to the socket address', (): void => {
      const ip: string = resolveClientIp(request({}));

      expect(ip).toBe('10.0.0.1');
    });
  });

  describe('resolveThrottleTracker', (): void => {
    it('should count a logged-in user by their account', (): void => {
      const tracker: string = resolveThrottleTracker(
        request({ cookie: `access-token=${jwtWithEmail('user@test.com')}` }),
      );

      expect(tracker.startsWith('user:')).toBe(true);
      expect(tracker).not.toContain('user@test.com');
    });

    it('should count a guest by their session', (): void => {
      const tracker: string = resolveThrottleTracker(
        request({ cookie: 'guest-session=secret-token' }),
      );

      expect(tracker.startsWith('guest:')).toBe(true);
      expect(tracker).not.toContain('secret-token');
    });

    it('should count an anonymous device by its identifier', (): void => {
      const tracker: string = resolveThrottleTracker(
        request({ cookie: 'fd_device=device-1' }),
      );

      expect(tracker.startsWith('device:')).toBe(true);
    });

    it('should fall back to the address when there are no cookies', (): void => {
      const tracker: string = resolveThrottleTracker(
        request({ 'x-client-ip': '203.0.113.10' }),
      );

      expect(tracker).toBe('ip:203.0.113.10');
    });

    it('should give the same tracker for the same guest session', (): void => {
      const first: string = resolveThrottleTracker(
        request({ cookie: 'guest-session=secret-token' }),
      );
      const second: string = resolveThrottleTracker(
        request({ cookie: 'guest-session=secret-token' }),
      );

      expect(first).toBe(second);
    });
  });

  describe('resolveIpTracker', (): void => {
    it('should always count by address', (): void => {
      const tracker: string = resolveIpTracker(
        request({ cookie: 'guest-session=secret-token' }),
      );

      expect(tracker).toBe('ip:10.0.0.1');
    });
  });

  describe('resolveAccountTracker', (): void => {
    it('should count by the account from the request body', (): void => {
      const req: Request = {
        headers: {},
        body: { email: 'User@Test.com' },
      } as unknown as Request;

      const tracker: string = resolveAccountTracker(req);

      expect(tracker.startsWith('account:')).toBe(true);
      expect(tracker).not.toContain('user@test.com');
    });

    it('should fall back to the address without an email', (): void => {
      const req: Request = {
        headers: {},
        body: {},
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      expect(resolveAccountTracker(req)).toBe('ip:10.0.0.1');
    });
  });
});
