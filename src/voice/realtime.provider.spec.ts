import { ConfigService } from '@nestjs/config';
import { RealtimeProvider } from './realtime.provider';

describe('Realtime provider (mocked HTTP, no API spend)', () => {
  const provider = new RealtimeProvider(new ConfigService({ OPENAI_API_KEY: 'unit-test-only' }));
  afterEach(() => jest.restoreAllMocks());
  it('creates a server-controlled session without input transcription or automatic responses during setup', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('answer', { status: 201, headers: { location: '/v1/realtime/calls/rtc_test' } }));
    expect(await provider.create('sdp', 'gpt-realtime-2.1-mini', 'marin', 'private teacher prompt', 'user')).toEqual({ callId: 'rtc_test', sdp: 'answer' });
    const form = fetchMock.mock.calls[0][1]?.body as FormData;
    const session = JSON.parse(form.get('session') as string) as Record<string, any>;
    expect(session.audio.input).toEqual({ transcription: null, turn_detection: null });
    expect(session.max_output_tokens).toBe(256); expect(session.tracing).toBeNull();
    expect(session.instructions).toBe('private teacher prompt'); expect(session.tools).toEqual([]);
  });
  it('uses actual provider hang-up and does not treat authentication/5xx errors as termination', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(provider.hangup('rtc_test')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/realtime/calls/rtc_test/hangup');
    await expect(provider.hangup('rtc_test')).rejects.toThrow(); await expect(provider.hangup('rtc_test')).rejects.toThrow();
    await expect(provider.hangup('rtc_test')).resolves.toBeUndefined();
  });
  it('does not retry ambiguous session creation', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connection lost'));
    await expect(provider.create('sdp', 'model', 'marin', 'prompt', 'user')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
