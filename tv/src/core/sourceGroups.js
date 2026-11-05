// Перетворює джерела плагінів на формат вікна вибору торрентів.

const LANGUAGES = ["uk", "ru", "en", "pl"];

export function groupTorrentSources(sources = []) {
  const groups = { uk: [], ru: [], en: [], pl: [], embed: null };
  for (const source of sources) {
    const extra = source.extra || {};
    if (source.kind === "embed") {
      groups.embed = groups.embed || extra.embed || null;
      continue;
    }
    if (source.kind !== "torrent" || !extra.magnet) continue;
    const language = LANGUAGES.includes(source.language) ? source.language : "en";
    groups[language].push({
      voices: [], videotype: "", peers: 0, pub_date: "", tracker: "",
      ...extra,
      title: source.title,
      quality: source.quality ?? null,
      size: source.size_bytes || 0,
      seeders: source.seeders || 0,
    });
  }
  return groups;
}

// Чи можна вірити відповіді: плагін є і не впав. Інакше — старий вбудований пошук.
export function shouldUseLegacySearch(response) {
  if (!response || !response.providers) return true;
  return !response.sources?.length && response.errors?.length > 0;
}
