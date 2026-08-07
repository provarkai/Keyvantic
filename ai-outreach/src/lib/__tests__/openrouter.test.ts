import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const schema = { type: 'object', properties: {}, required: [], additionalProperties: false };
const validator = z.object({ answer: z.string() });

type Body = { response_format?: { type: string }; plugins?: unknown };

function ok(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], model: 'test/model' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Reads the JSON request body out of a recorded `fetch` call. */
function bodyOf(call: unknown[] | undefined): Body {
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as Body;
}

async function load() {
  const { completeJson, OpenRouterError } = await import('../openrouter');
  return { completeJson, OpenRouterError };
}

const call = (overrides: Record<string, unknown> = {}) => ({
  model: 'test/model',
  schemaName: 'test',
  schema,
  validator,
  messages: [{ role: 'user' as const, content: 'hi' }],
  ...overrides,
});

describe('completeJson', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = 'test-key';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('returns validated data from a clean response', async () => {
    fetchMock.mockResolvedValueOnce(ok('{"answer":"yes"}'));

    const { completeJson } = await load();
    const result = await completeJson(call());

    expect(result.data).toEqual({ answer: 'yes' });
    expect(result.model).toBe('test/model');
    expect(bodyOf(fetchMock.mock.calls[0]).response_format?.type).toBe('json_schema');
  });

  it('sends the API key as a bearer token, never in the body', async () => {
    fetchMock.mockResolvedValueOnce(ok('{"answer":"yes"}'));

    const { completeJson } = await load();
    await completeJson(call());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(String(init.body)).not.toContain('test-key');
  });

  it('falls back to json_object when the model rejects json_schema', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(400, 'response_format json_schema is not supported by this model'))
      .mockResolvedValueOnce(ok('{"answer":"fallback"}'));

    const { completeJson } = await load();
    const result = await completeJson(call());

    expect(result.data).toEqual({ answer: 'fallback' });
    expect(bodyOf(fetchMock.mock.calls[1]).response_format?.type).toBe('json_object');
  });

  it('does not fall back for unrelated 400s', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, 'context length exceeded'));

    const { completeJson, OpenRouterError } = await load();
    await expect(completeJson(call())).rejects.toBeInstanceOf(OpenRouterError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-prompts once when the shape is wrong, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(ok('{"wrong":"shape"}'))
      .mockResolvedValueOnce(ok('{"answer":"repaired"}'));

    const { completeJson } = await load();
    const result = await completeJson(call());

    expect(result.data).toEqual({ answer: 'repaired' });
    // The repair turn carries the validation errors back to the model.
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(repairBody.messages.at(-1)?.content).toContain('did not match the required schema');
  });

  it('surfaces a 401 as an auth error', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(fail(401, 'no auth credentials found')));

    const { completeJson, OpenRouterError } = await load();
    await expect(completeJson(call())).rejects.toMatchObject({
      name: 'OpenRouterError',
      status: 401,
      message: expect.stringContaining('OPENROUTER_API_KEY'),
    });
    expect(OpenRouterError).toBeDefined();
  });

  it('surfaces a 402 as an out-of-credits error', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(fail(402, 'insufficient credits')));

    const { completeJson } = await load();
    await expect(completeJson(call())).rejects.toMatchObject({
      message: expect.stringContaining('out of credits'),
    });
  });

  it('treats a 200 with an error body as a failure', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: 'upstream provider is down' } }), { status: 200 })),
    );

    const { completeJson } = await load();
    await expect(completeJson(call())).rejects.toMatchObject({ message: 'upstream provider is down' });
  });

  it('reports a truncated response rather than parsing it', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"answer":"tru' }, finish_reason: 'length' }] }),
          { status: 200 },
        ),
      ),
    );

    const { completeJson } = await load();
    await expect(completeJson(call())).rejects.toMatchObject({
      message: expect.stringContaining('output limit'),
    });
  });

  it('attaches the web plugin only when asked', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(ok('{"answer":"yes"}')));

    const { completeJson } = await load();

    await completeJson(call());
    expect(bodyOf(fetchMock.mock.calls[0]).plugins).toBeUndefined();

    fetchMock.mockClear();
    await completeJson(call({ webSearch: true }));
    expect(bodyOf(fetchMock.mock.calls[0]).plugins).toEqual([{ id: 'web', max_results: 5 }]);
  });

  it('maps a network abort onto a timeout error', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const { completeJson } = await load();
    await expect(completeJson(call())).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining('too long'),
    });
  });
});
