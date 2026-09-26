import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../worker.js';

describe('Aetheria Worker Unit Test Suite', () => {
  const env = {
    ADMIN_SECRET_KEY: 'test-secret-key-12345',
    RCON_HOST: '127.0.0.1',
    RCON_PORT: 25575,
    RCON_PASSWORD: 'password'
  };

  describe('CORS and Preflight', () => {
    it('should return CORS headers on OPTIONS request', async () => {
      const req = new Request('https://worker.test/', { method: 'OPTIONS' });
      const res = await worker.fetch(req, env, {});
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Server Status Action', () => {
    it('should handle get_server_status GET request', async () => {
      const req = new Request('https://worker.test/?action=get_server_status', { method: 'GET' });
      const res = await worker.fetch(req, env, {});
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('online');
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should block unauthenticated requests exceeding max quota', async () => {
      const reqFactory = () => new Request('https://worker.test/api', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '192.168.1.100' },
        body: JSON.stringify({ action: 'ping' })
      });

      let lastRes;
      for (let i = 0; i < 32; i++) {
        lastRes = await worker.fetch(reqFactory(), env, {});
      }
      expect(lastRes.status).toBe(429);
      const body = await lastRes.json();
      expect(body.result).toBe('error');
    });
  });
});
