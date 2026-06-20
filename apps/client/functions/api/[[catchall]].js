export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.protocol = "http:";
  url.hostname = "207.57.131.146";
  url.port = "50520";
  
  const proxyRequest = new Request(url.toString(), context.request);
  proxyRequest.headers.set("X-Forwarded-Proto", "https");
  proxyRequest.headers.set("X-Real-IP", context.request.headers.get("CF-Connecting-IP") || "");
  
  return fetch(proxyRequest);
}
