export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  const proxyStreamUrl = url.searchParams.get('proxy');
  const proxyImgUrl = url.searchParams.get('img');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // MODE 1: CORS Image Proxy for Storyboard/Keyframes
  if (proxyImgUrl) {
    try {
      const imgResp = await fetch(proxyImgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const respHeaders = new Headers(corsHeaders);
      respHeaders.set('Content-Type', imgResp.headers.get('Content-Type') || 'image/jpeg');
      respHeaders.set('Cache-Control', 'public, max-age=3600');
      return new Response(imgResp.body, {
        status: imgResp.status,
        headers: respHeaders
      });
    } catch (e) {
      return new Response('Image proxy failed', { status: 502, headers: corsHeaders });
    }
  }

  // MODE 2: Binary MP4 Stream Proxy (so HTML5 <video> + <canvas> never gets CORS-tainted)
  if (proxyStreamUrl) {
    try {
      const fetchHeaders = new Headers();
      fetchHeaders.set(
        'User-Agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      if (request.headers.has('Range')) {
        fetchHeaders.set('Range', request.headers.get('Range'));
      }

      const upstream = await fetch(proxyStreamUrl, {
        headers: fetchHeaders,
        redirect: 'follow'
      });

      const respHeaders = new Headers(corsHeaders);
      respHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');
      if (upstream.headers.has('Content-Length')) {
        respHeaders.set('Content-Length', upstream.headers.get('Content-Length'));
      }
      if (upstream.headers.has('Content-Range')) {
        respHeaders.set('Content-Range', upstream.headers.get('Content-Range'));
      }
      respHeaders.set('Accept-Ranges', 'bytes');

      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Stream proxy error', details: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // MODE 3: Resolve Social URL (YouTube, TikTok, X, Instagram, etc.) -> Direct MP4 Stream
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Direct MP4/WebM link
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(targetUrl)) {
    return new Response(
      JSON.stringify({
        streamUrl: `/api/stream?proxy=${encodeURIComponent(targetUrl)}`,
        rawStreamUrl: targetUrl,
        title: 'Direct Video Stream'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ytMatch = targetUrl.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
  );
  const ytId = ytMatch ? ytMatch[1] : null;

  // 1. Direct YouTube InnerTube API Extraction (IOS & ANDROID clients)
  if (ytId) {
    const clients = [
      {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '17.5.1.21F90',
        userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)'
      },
      {
        clientName: 'ANDROID',
        clientVersion: '19.29.37',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        userAgent: 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip'
      }
    ];

    for (const c of clients) {
      try {
        const ytRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': c.userAgent
          },
          body: JSON.stringify({
            videoId: ytId,
            context: {
              client: {
                clientName: c.clientName,
                clientVersion: c.clientVersion,
                deviceMake: c.deviceMake,
                deviceModel: c.deviceModel,
                osName: c.osName,
                osVersion: c.osVersion,
                androidSdkVersion: c.androidSdkVersion,
                hl: 'en',
                gl: 'US'
              }
            },
            contentCheckOk: true,
            racyCheckOk: true
          })
        });

        if (ytRes.ok) {
          const data = await ytRes.json();
          const formats = [
            ...(data?.streamingData?.formats || []),
            ...(data?.streamingData?.adaptiveFormats || [])
          ];
          // Prefer combined mp4 or video mp4 <= 720p for fast GIF creation
          const mp4 =
            formats.find(
              (f) => f.url && f.mimeType && f.mimeType.includes('video/mp4') && f.height && f.height <= 480
            ) ||
            formats.find(
              (f) => f.url && f.mimeType && f.mimeType.includes('video/mp4')
            );

          if (mp4 && mp4.url) {
            return new Response(
              JSON.stringify({
                streamUrl: `/api/stream?proxy=${encodeURIComponent(mp4.url)}`,
                rawStreamUrl: mp4.url,
                title: data?.videoDetails?.title || `YouTube (${ytId})`,
                duration: Number(data?.videoDetails?.lengthSeconds || 0) || null
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (_) {}
    }
  }

  // 2. Try Cobalt social video extractor instances
  const cobaltInstances = [
    { url: 'https://api.cobalt.tools/', v: 10 },
    { url: 'https://cobalt-api.kwiatekmiki.com/', v: 10 },
    { url: 'https://cobalt.api.timelessnesses.me/', v: 10 },
    { url: 'https://co.wuk.sh/api/json', v: 7 }
  ];

  for (const inst of cobaltInstances) {
    try {
      const bodyPayload =
        inst.v === 10
          ? { url: targetUrl, videoQuality: '480', downloadMode: 'auto' }
          : { url: targetUrl, vQuality: '480' };

      const resp = await fetch(inst.url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (resp.ok) {
        const data = await resp.json();
        const extractedUrl = data.url || (data.picker && data.picker[0] && data.picker[0].url);
        if (extractedUrl) {
          return new Response(
            JSON.stringify({
              streamUrl: `/api/stream?proxy=${encodeURIComponent(extractedUrl)}`,
              rawStreamUrl: extractedUrl,
              title: data.filename || (ytId ? `YouTube (${ytId})` : 'Social Video')
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (_) {}
  }

  // 3. Try Invidious & Piped API pools
  if (ytId) {
    const invidiousApis = [
      `https://inv.tux.pizza/api/v1/videos/${ytId}`,
      `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
      `https://invidious.privacyredirect.com/api/v1/videos/${ytId}`,
      `https://vid.puffyan.us/api/v1/videos/${ytId}`,
      `https://invidious.jing.rocks/api/v1/videos/${ytId}`,
      `https://yt.artemislena.eu/api/v1/videos/${ytId}`
    ];

    for (const apiUrl of invidiousApis) {
      try {
        const resp = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (resp.ok) {
          const info = await resp.json();
          const fmt = (info.formatStreams || []).find(
            (s) => (s.container === 'mp4' || (s.type && s.type.includes('mp4'))) && s.url
          );
          if (fmt && fmt.url) {
            return new Response(
              JSON.stringify({
                streamUrl: `/api/stream?proxy=${encodeURIComponent(fmt.url)}`,
                rawStreamUrl: fmt.url,
                title: info.title || `YouTube (${ytId})`,
                duration: info.lengthSeconds || null
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (_) {}
    }

    const pipedApis = [
      `https://pipedapi.kavin.rocks/streams/${ytId}`,
      `https://pipedapi.adminforge.de/streams/${ytId}`,
      `https://pipedapi.drgns.space/streams/${ytId}`,
      `https://api.piped.private.coffee/streams/${ytId}`
    ];

    for (const apiUrl of pipedApis) {
      try {
        const resp = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (resp.ok) {
          const info = await resp.json();
          const mp4Stream =
            (info.videoStreams || []).find((s) => s.format === 'MPEG_4' && !s.videoOnly && s.url) ||
            (info.videoStreams || []).find((s) => s.format === 'MPEG_4' && s.url);
          if (mp4Stream && mp4Stream.url) {
            return new Response(
              JSON.stringify({
                streamUrl: `/api/stream?proxy=${encodeURIComponent(mp4Stream.url)}`,
                rawStreamUrl: mp4Stream.url,
                title: info.title || `YouTube (${ytId})`,
                duration: info.duration || null
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (_) {}
    }
  }

  return new Response(
    JSON.stringify({
      error: 'Could not extract raw MP4 stream from upstream servers',
      ytId
    }),
    { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
