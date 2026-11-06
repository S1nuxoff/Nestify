// Рішення для запуску однією кнопкою. Без мережі, щоб їх можна було тестувати окремо.

export const DONE_RATIO = 0.9;
const ORIGINAL_VOICE = /оригинал|оригінал|original/i;

export function isDone(watch) {
  if (!watch?.duration) return false;
  return (watch.position_seconds || 0) / watch.duration >= DONE_RATIO;
}

export function seasonListOf(seasons) {
  return (seasons || [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
}

export function nextEpisode(seasonList, season, episode) {
  const index = seasonList.findIndex((s) => s.season_number === Number(season));
  if (index < 0) return null;
  if (Number(episode) < seasonList[index].episode_count) {
    return { season: Number(season), episode: Number(episode) + 1 };
  }
  const following = seasonList[index + 1];
  return following ? { season: following.season_number, episode: 1 } : null;
}

// Яку серію вмикати: нову — з початку, почату — ту саму, досмотрену — наступну.
export function planEpisode(lastWatch, seasonList) {
  const first = seasonList[0] ? { season: seasonList[0].season_number, episode: 1 } : null;
  if (!lastWatch?.season || !lastWatch?.episode) return first;
  const current = { season: lastWatch.season, episode: lastWatch.episode };
  if (!isDone(lastWatch)) return current;
  return nextEpisode(seasonList, current.season, current.episode) || current;
}

// Озвучка цього тайтлу, потім останній вибір профілю, потім перша на сайті, але не оригінал.
export function orderVoices(sources, { wanted, titleVoice, lastVoice } = {}) {
  const preferred = [wanted, titleVoice, lastVoice].filter(Boolean);
  const rest = [
    ...sources.filter((s) => !ORIGINAL_VOICE.test(s.voice || s.title)),
    ...sources.filter((s) => ORIGINAL_VOICE.test(s.voice || s.title)),
  ];
  const ordered = [];
  for (const name of preferred) {
    ordered.push(...sources.filter((s) => (s.voice || s.title) === name));
  }
  ordered.push(...rest);
  return [...new Set(ordered)];
}

// Історія приходить від нових записів до старих. Для ряду «Продовжити перегляд» лишаємо
// по одному запису на фільм чи серіал: останню серію, яку дивилися.
export function latestPerTitle(history) {
  const seen = new Set();
  return (history || []).filter((item) => {
    if (seen.has(item.movie_id)) return false;
    seen.add(item.movie_id);
    return true;
  });
}
