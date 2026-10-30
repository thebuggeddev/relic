import type { ComparableParallel } from "@/types/artifact";

/**
 * Queries reputable Open-Access Museum Collection APIs (The Metropolitan Museum of Art
 * and the Art Institute of Chicago) for verified surviving archaeological parallels.
 * Never fabricates accession numbers or URLs.
 */
export async function searchOpenAccessMuseumParallels(
  queries: string[],
  maxResults = 4
): Promise<ComparableParallel[]> {
  const results: ComparableParallel[] = [];
  const seenUrls = new Set<string>();

  const cleanQueries = queries
    .map((q) => q.trim())
    .filter((q) => q.length >= 3)
    .slice(0, 2);

  // 1. Art Institute of Chicago Open Access API (fast single-roundtrip search)
  for (const query of cleanQueries) {
    if (results.length >= maxResults) break;
    try {
      const aicUrl = new URL("https://api.artic.edu/api/v1/artworks/search");
      aicUrl.searchParams.set("q", query);
      aicUrl.searchParams.set("limit", "3");
      aicUrl.searchParams.set(
        "fields",
        "id,title,date_display,place_of_origin,medium_display,main_reference_number,is_public_domain"
      );

      const res = await fetch(aicUrl.toString(), {
        headers: { "AIC-User-Agent": "RelicRebornArchaeologyExhibit/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        for (const item of items) {
          if (!item?.id || !item?.title) continue;
          const url = `https://www.artic.edu/artworks/${item.id}`;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          results.push({
            name: String(item.title),
            museum: "The Art Institute of Chicago",
            date: String(item.date_display || "Ancient period"),
            accessionNumber: item.main_reference_number
              ? String(item.main_reference_number)
              : undefined,
            url,
            relevance: [item.place_of_origin, item.medium_display]
              .filter(Boolean)
              .join(" · ") || "Documented museum collection parallel",
          });
          if (results.length >= maxResults) break;
        }
      }
    } catch {
      // Non-blocking fallback if museum API times out
    }
  }

  // 2. The Metropolitan Museum of Art Open Access Collection API
  for (const query of cleanQueries) {
    if (results.length >= maxResults) break;
    try {
      const searchUrl = new URL(
        "https://collectionapi.metmuseum.org/public/collection/v1/search"
      );
      searchUrl.searchParams.set("hasImages", "true");
      searchUrl.searchParams.set("q", query);

      const searchRes = await fetch(searchUrl.toString(), {
        signal: AbortSignal.timeout(6000),
      });
      if (!searchRes.ok) continue;
      const searchJson = await searchRes.json();
      const objectIds: number[] = Array.isArray(searchJson?.objectIDs)
        ? searchJson.objectIDs.slice(0, 3)
        : [];

      const details = await Promise.all(
        objectIds.map(async (id) => {
          try {
            const objRes = await fetch(
              `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (!objRes.ok) return null;
            return await objRes.json();
          } catch {
            return null;
          }
        })
      );

      for (const obj of details) {
        if (!obj?.objectURL || !obj?.title) continue;
        if (seenUrls.has(obj.objectURL)) continue;
        seenUrls.add(obj.objectURL);
        results.push({
          name: String(obj.title),
          museum: "The Metropolitan Museum of Art",
          date: String(obj.objectDate || obj.period || "Ancient period"),
          accessionNumber: obj.accessionNumber
            ? String(obj.accessionNumber)
            : undefined,
          url: String(obj.objectURL),
          relevance:
            [obj.culture, obj.medium, obj.department]
              .filter(Boolean)
              .join(" · ") || "Metropolitan Museum documented parallel",
        });
        if (results.length >= maxResults) break;
      }
    } catch {
      // Non-blocking
    }
  }

  return results;
}
