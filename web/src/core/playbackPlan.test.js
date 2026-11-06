// node --test src/core/playbackPlan.test.js
import assert from "node:assert/strict";
import { test } from "node:test";
import { isDone, latestPerTitle, nextEpisode, orderVoices, planEpisode, seasonListOf } from "./playbackPlan.js";

const seasons = seasonListOf([
  { season_number: 2, episode_count: 3 },
  { season_number: 0, episode_count: 5 },
  { season_number: 1, episode_count: 2 },
  { season_number: 3, episode_count: 0 },
]);
const voice = (name) => ({ id: name, voice: name, title: name });

test("history keeps only the newest entry of each title", () => {
  const rows = [
    { movie_id: "tv_1", episode: 7 }, { movie_id: "movie_2" }, { movie_id: "tv_1", episode: 6 }, { movie_id: "tv_1", episode: 5 },
  ];
  assert.deepEqual(latestPerTitle(rows), [{ movie_id: "tv_1", episode: 7 }, { movie_id: "movie_2" }]);
  assert.deepEqual(latestPerTitle(null), []);
});

test("specials and empty seasons are skipped, seasons are sorted", () => {
  assert.deepEqual(seasons.map((s) => s.season_number), [1, 2]);
});

test("next episode moves within a season, then to the next one, then stops", () => {
  assert.deepEqual(nextEpisode(seasons, 1, 1), { season: 1, episode: 2 });
  assert.deepEqual(nextEpisode(seasons, 1, 2), { season: 2, episode: 1 });
  assert.equal(nextEpisode(seasons, 2, 3), null);
  assert.equal(nextEpisode(seasons, 9, 1), null);
});

test("a watch counts as done from 90%", () => {
  assert.equal(isDone({ position_seconds: 89, duration: 100 }), false);
  assert.equal(isDone({ position_seconds: 90, duration: 100 }), true);
  assert.equal(isDone({ position_seconds: 90 }), false);
  assert.equal(isDone(null), false);
});

test("a new series starts from the first episode", () => {
  assert.deepEqual(planEpisode(null, seasons), { season: 1, episode: 1 });
  assert.deepEqual(planEpisode({ season: null, episode: null, position_seconds: 5 }, seasons), { season: 1, episode: 1 });
  assert.equal(planEpisode(null, []), null);
});

test("an unfinished episode continues, a finished one moves on", () => {
  assert.deepEqual(planEpisode({ season: 1, episode: 2, position_seconds: 10, duration: 100 }, seasons), { season: 1, episode: 2 });
  assert.deepEqual(planEpisode({ season: 1, episode: 2, position_seconds: 95, duration: 100 }, seasons), { season: 2, episode: 1 });
});

test("the last episode stays when there is nothing after it", () => {
  assert.deepEqual(planEpisode({ season: 2, episode: 3, position_seconds: 99, duration: 100 }, seasons), { season: 2, episode: 3 });
});

test("voice order: wanted, title, profile, then site order with original last", () => {
  const all = ["Оригинал (+субтитры)", "Амедиа", "LostFilm", "Дубляж"].map(voice);
  const names = (prefs) => orderVoices(all, prefs).map((s) => s.voice);
  assert.deepEqual(names(), ["Амедиа", "LostFilm", "Дубляж", "Оригинал (+субтитры)"]);
  assert.equal(names({ lastVoice: "Дубляж" })[0], "Дубляж");
  assert.equal(names({ titleVoice: "LostFilm", lastVoice: "Дубляж" })[0], "LostFilm");
  assert.equal(names({ wanted: "Оригинал (+субтитры)", titleVoice: "LostFilm" })[0], "Оригинал (+субтитры)");
});

test("a remembered voice that is missing falls through, and nothing is lost or repeated", () => {
  const all = ["Амедиа", "LostFilm"].map(voice);
  const order = orderVoices(all, { titleVoice: "Нет такой", lastVoice: "LostFilm" });
  assert.deepEqual(order.map((s) => s.voice), ["LostFilm", "Амедиа"]);
  assert.equal(orderVoices([voice("Оригинал")])[0].voice, "Оригинал");
});
