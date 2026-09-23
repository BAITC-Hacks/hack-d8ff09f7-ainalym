import { readArtifact } from "@/ai/drafting";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const artifact = readArtifact(id);
  if (!artifact) return Response.json({ ok: false, code: "not_found", message: "Artifact not found" }, { status: 404 });
  return new Response(artifact.markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${id}.md"` },
  });
}
