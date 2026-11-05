export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // If direct MP4 URL, proxy with CORS headers
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(targetUrl)) {
    return new Response(JSON.stringify({ streamUrl: targetUrl, title: 'Direct Video' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return new Response(JSON.stringify({ error: 'Use client resolver' }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' }
  });
}
