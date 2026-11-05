import { findPluginSources, getPlaybackState, resolvePluginSource, savePlaybackVoice } from "../api/plugins";
import { isDone, orderVoices, planEpisode, seasonListOf } from "./playbackPlan";

const MAX_ATTEMPTS = 3;

// Знаходить, що вмикати, і повертає state для плеєра. null — плагіни нічого не дали.
export async function preparePlayback({
  query, movieId, userId, seasons, season = null, episode = null,
  voice = null, explicitVoice = false, startAt = null, quality = null, subtitleLang = null,
}) {
  const isTv = query.media_type === "tv";
  const prefs = userId
    ? await getPlaybackState(userId, movieId).catch(() => ({}))
    : {};

  if (isTv && (season == null || episode == null)) {
    const plan = planEpisode(prefs.last_watch, seasonListOf(seasons));
    if (!plan) return null;
    season = plan.season;
    episode = plan.episode;
  }

  const { sources = [] } = await findPluginSources({
    ...query,
    season: isTv ? season : undefined,
    episode: isTv ? episode : undefined,
  });
  const playable = sources.filter((s) => s.kind === "direct" || s.kind === "hls");
  const ordered = orderVoices(playable, {
    wanted: voice, titleVoice: prefs.title_voice, lastVoice: prefs.last_voice,
  });

  for (const source of ordered.slice(0, MAX_ATTEMPTS)) {
    let resolved;
    try {
      resolved = await resolvePluginSource(source.plugin_id, source.id);
    } catch {
      continue;
    }
    if (!resolved?.streams?.length) continue;

    const name = source.voice || source.title;
    if (userId) {
      savePlaybackVoice({ user_id: userId, movie_id: movieId, voice: name, explicit: explicitVoice && name === voice })
        .catch(() => {});
    }
    const last = prefs.last_watch;
    const sameEpisode = !isTv || (last?.season === season && last?.episode === episode);
    return {
      sources: resolved.streams,
      movie_url: resolved.streams[resolved.streams.length - 1].url,
      subtitles: (resolved.subtitles || []).map((s) => ({ lang: s.label || s.lang, url: s.url })),
      selectedSeason: isTv ? season : null,
      selectedEpisode: isTv ? episode : null,
      startAt,
      // Нативний плеєр ТВ не читає прогрес сам, тому передаємо йому позицію.
      resumeAt: last && sameEpisode && !isDone(last) ? last.position_seconds : 0,
      plugin: {
        query, movieId, seasons: seasonListOf(seasons),
        voices: [...new Set(playable.map((s) => s.voice || s.title))],
        voice: name, quality, subtitleLang,
      },
    };
  }
  return null;
}
