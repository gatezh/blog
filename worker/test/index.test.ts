import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Contact Form Worker', () => {
  it('should handle OPTIONS request (CORS preflight)', async () => {
    const request = new Request('http://localhost/', {
      method: 'OPTIONS',
    });

    const env = {
      AIRTABLE_API_KEY: 'test-key',
      AIRTABLE_BASE_ID: 'test-base',
      AIRTABLE_TABLE_NAME: 'test-table',
    } as Env;

    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('should return 404 for GET requests', async () => {
    const request = new Request('http://localhost/', {
      method: 'GET',
    });

    const env = {
      AIRTABLE_API_KEY: 'test-key',
      AIRTABLE_BASE_ID: 'test-base',
      AIRTABLE_TABLE_NAME: 'test-table',
    } as Env;

    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'Not found');
  });

  it('should validate form data', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '',
        email: 'invalid-email',
        subject: '',
        message: '',
      }),
    });

    const env = {
      AIRTABLE_API_KEY: 'test-key',
      AIRTABLE_BASE_ID: 'test-base',
      AIRTABLE_TABLE_NAME: 'test-table',
    } as Env;

    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should require Airtable configuration', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message',
      }),
    });

    const env = {
      AIRTABLE_API_KEY: '',
      AIRTABLE_BASE_ID: '',
      AIRTABLE_TABLE_NAME: '',
    } as Env;

    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'Server configuration error. Please contact the administrator.');
  });
});
