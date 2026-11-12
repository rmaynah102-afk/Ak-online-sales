// AK Sale Cloudflare Worker backend scaffold.
// This endpoint is intentionally health-only until Firebase Auth + Firestore
// operations are migrated and security-tested. It does not replace Firebase Functions.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Cache-Control": "no-store"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
        service: "ak-sale-backend",
        status: "scaffold-only",
        message: "Firebase callable functions have not yet been migrated."
      }, { headers: cors });
    }
    return Response.json({
      ok: false,
      error: "not_implemented",
      message: "This AK Sale endpoint is not available until backend migration and security testing are complete."
    }, { status: 501, headers: cors });
  }
};
