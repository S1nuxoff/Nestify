import { findPluginSources } from "../api/plugins";
import { searchTorrents } from "../api/v3";
import { groupTorrentSources, shouldUseLegacySearch } from "./sourceGroups";

// Шукає через плагін торрентів. Без робочого плагіна — через старий вбудований пошук.
export async function searchTorrentSources({ title, titleOriginal, titleEnglish, titlePolish, year, imdbId, tmdbId, mediaType }) {
  const parsedYear = year ? parseInt(year, 10) || undefined : undefined;
  const type = mediaType === "tv" ? "tv" : "movie";

  let response = null;
  try {
    response = await findPluginSources({
      kinds: ["torrent", "embed"],
      media_type: type,
      title: title || titleOriginal,
      original_title: titleOriginal || undefined,
      year: parsedYear,
      tmdb_id: tmdbId ? String(tmdbId) : undefined,
      imdb_id: imdbId || undefined,
      titles: { ...(titleEnglish ? { en: titleEnglish } : {}), ...(titlePolish ? { pl: titlePolish } : {}) },
    });
  } catch {
    response = null;
  }
  if (!shouldUseLegacySearch(response)) return groupTorrentSources(response.sources);

  return searchTorrents({
    q: title || titleOriginal || "",
    title,
    title_original: titleOriginal || title,
    title_en: titleEnglish || undefined,
    title_pl: titlePolish || undefined,
    year: parsedYear,
    imdb_id: imdbId,
    tmdb_id: tmdbId,
    media_type: mediaType || "movie",
  });
}
