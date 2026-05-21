export default async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const questUrl = url.searchParams.get('quest');

  if (!questUrl) {
    return new Response(JSON.stringify({ error: 'Missing quest parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const proxyResponse = await fetch(questUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5',
        'Referer': questUrl
      },
      redirect: 'follow'
    });

    const body = await proxyResponse.text();

    return new Response(body, {
      status: proxyResponse.status,
      headers: {
        'Content-Type': proxyResponse.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}