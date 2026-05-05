/**
 * Cloudflare Worker — Tessitura CORS Proxy
 *
 * Forwards requests to the Tessitura API and adds CORS headers
 * so the GitHub Pages custom screen can call it from the browser.
 *
 * Deploy:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this script and deploy
 *   3. Note your worker URL (e.g. https://tessitura-proxy.YOUR_NAME.workers.dev)
 *   4. Use that URL as the `base` param in the GitHub Pages URL
 */

const TESSITURA_BASE = "https://infra-pushbutton-z41v94p.tessituranetworkdev.com";
const ALLOWED_ORIGIN = "https://paulkappel.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Build the upstream Tessitura URL, preserving the path and query string
    const incoming = new URL(request.url);
    const upstream = new URL(incoming.pathname + incoming.search, TESSITURA_BASE);

    console.log("[proxy] →", upstream.toString());

    // Forward auth header from the original request
    const auth = request.headers.get("Authorization");
    const headers = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = auth;

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream.toString(), { headers });
    } catch (err) {
      console.error("[proxy] fetch failed:", err.message);
      return new Response(JSON.stringify({ error: "Upstream fetch failed", detail: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const body = await upstreamRes.text();
    console.log("[proxy] ←", upstreamRes.status, body.slice(0, 200));

    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json",
        ...corsHeaders(origin),
      },
    });
  },
};
