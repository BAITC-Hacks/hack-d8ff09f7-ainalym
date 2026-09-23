import { redirect } from "next/navigation";
/** Deep links from the earlier /* prefix keep working: /x?y → /x?y. */
export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { path = [] } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(v => query.append(key, v)); else if (value !== undefined) query.set(key, value);
  }
  const target = path.length ? `/${path.map(encodeURIComponent).join("/")}` : "/today";
  redirect(query.size ? `${target}?${query}` : target);
}
