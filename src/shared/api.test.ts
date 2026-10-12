import { describe, expect, it } from 'vitest';
import type { InitResponse } from './api.js';

describe('Shared API types', () => {
  it('validates InitResponse structure', () => {
    const response: InitResponse = {
      type: 'init',
      postId: 't3_12345',
      count: 0,
      username: 'test_user',
    };
    expect(response.type).toBe('init');
    expect(response.postId).toBe('t3_12345');
    expect(response.count).toBe(0);
  });
});
