// Cloudflare Pages Function: /api/stream
// 1. ?url=<social_url> -> Resolves direct MP4 URL + duration from Cobalt / Piped / Invidious APIs
// 2. ?proxy=<mp4_url>  -> Proxies binary MP4 bytes with Access-Control-Allow-Origin: * so HTML5 <canvas> can encode GIFs

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

function extractYouTubeId(rawUrl) {
  const m = rawUrl.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
  return m ? m[1] : null;
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const reqUrl = new URL(request.url);
  const proxyTarget = reqUrl.searchParams.get('proxy');
  const targetUrl = reqUrl.searchParams.get('url');

  // MODE A: Binary Video Stream CORS Proxy (?proxy=https://...)
  if (proxyTarget) {
    try {
      const rangeHeader = request.headers.get('Range');
      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };
      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }

      const upstream = await fetch(proxyTarget, {
        headers: fetchHeaders,
        redirect: 'follow',
      });

      const respHeaders = new Headers(CORS_HEADERS);
      respHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');
      if (upstream.headers.get('Content-Length')) {
        respHeaders.set('Content-Length', upstream.headers.get('Content-Length'));
      }
      if (upstream.headers.get('Content-Range')) {
        respHeaders.set('Content-Range', upstream.headers.get('Content-Range'));
      }
      respHeaders.set('Accept-Ranges', 'bytes');

      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', details: err.message }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // MODE B: Social Video URL Resolver (?url=https://...)
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 1. Direct MP4 / WebM / MOV link
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(targetUrl)) {
    return new Response(
      JSON.stringify({
        streamUrl: `/api/stream?proxy=${encodeURIComponent(targetUrl)}`,
        rawStreamUrl: targetUrl,
        title: 'Direct Video Stream',
        source: 'direct',
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const ytId = extractYouTubeId(targetUrl);

  // 2. Try Piped & Invidious instances on the server side (No browser CORS block)
  if (ytId) {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://pipedapi.drgns.space',
      'https://api.piped.private.coffee',
      'https://pipedapi.ducks.party',
    ];

    for (const host of pipedInstances) {
      try {
        const res = await fetch(`${host}/streams/${ytId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GifWorkshop/2.0)' },
        });
        if (res.ok) {
          const data = await res.json();
          const streams = data.videoStreams || [];
          const mp4 =
            streams.find((s) => s.format === 'MPEG_4' && s.videoOnly === false && (s.quality === '360p' || s.quality === '480p' || s.quality === '720p')) ||
            streams.find((s) => s.format === 'MPEG_4' && s.videoOnly === false) ||
            streams.find((s) => s.format === 'MPEG_4');

          if (mp4 && mp4.url) {
            return new Response(
              JSON.stringify({
                streamUrl: `/api/stream?proxy=${encodeURIComponent(mp4.url)}`,
                rawStreamUrl: mp4.url,
                title: data.title || `YouTube Video (${ytId})`,
                duration: data.duration || 60,
                youtubeId: ytId,
                source: host,
              }),
              { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (_) {}
    }

    const invidiousInstances = [
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://invidious.jing.rocks',
      'https://invidious.privacyredirect.com',
    ];

    for (const host of invidiousInstances) {
      try {
        const res = await fetch(`${host}/api/v1/videos/${ytId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GifWorkshop/2.0)' },
        });
        if (res.ok) {
          const data = await res.json();
          const fmt = (data.formatStreams || []).find((s) => (s.container || '').includes('mp4') || (s.type || '').includes('mp4'));
          if (fmt && fmt.url) {
            return new Response(
              JSON.stringify({
                streamUrl: `/api/stream?proxy=${encodeURIComponent(fmt.url)}`,
                rawStreamUrl: fmt.url,
                title: data.title || `YouTube Video (${ytId})`,
                duration: data.lengthSeconds || 60,
                youtubeId: ytId,
                source: host,
              }),
              { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (_) {}
    }
  }

  // 3. Return YouTube ID metadata so client can activate Live YouTube IFrame Player + Real Duration
  return new Response(
    JSON.stringify({
      youtubeId: ytId,
      error: 'Direct MP4 stream protected; switching to Live Embedded Video Player',
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
}
