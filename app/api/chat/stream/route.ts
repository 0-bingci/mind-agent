import { askAgent } from "@/app/actions/chat";

export async function POST(req: Request) {
  try {
    const { input } = await req.json();
    const readableStream = await askAgent(input);

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Stream failed" }), { status: 500 });
  }
}