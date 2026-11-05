// node --test src/core/sourceGroups.test.js
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupTorrentSources, shouldUseLegacySearch } from "./sourceGroups.js";

const torrent = (language, extra = {}) => ({
  id: "m", kind: "torrent", title: "T", language, quality: "1080p", size_bytes: 5, seeders: 2,
  extra: { magnet: "magnet:x", voices: ["V"], ...extra },
});

test("torrents get the shape the picker already uses", () => {
  const { uk } = groupTorrentSources([torrent("uk", { tracker: "toloka", videotype: "sdr" })]);
  assert.deepEqual(uk[0], {
    voices: ["V"], videotype: "sdr", peers: 0, pub_date: "", tracker: "toloka",
    magnet: "magnet:x", title: "T", quality: "1080p", size: 5, seeders: 2,
  });
});

test("each language goes to its tab and an unknown one goes to English", () => {
  const groups = groupTorrentSources(["uk", "ru", "pl", "de", undefined].map((l) => torrent(l)));
  assert.deepEqual([groups.uk.length, groups.ru.length, groups.en.length, groups.pl.length], [1, 1, 2, 1]);
});

test("the embed is kept separately", () => {
  const embed = { embed_url: "u", hls: "h" };
  const groups = groupTorrentSources([{ id: "e", kind: "embed", title: "E", extra: { embed } }, torrent("en")]);
  assert.deepEqual(groups.embed, embed);
  assert.equal(groups.en.length, 1);
});

test("sources without a magnet and other kinds are skipped", () => {
  const groups = groupTorrentSources([
    { id: "a", kind: "torrent", title: "no magnet", language: "uk" },
    { id: "b", kind: "direct", title: "video", language: "uk", extra: { magnet: "magnet:x" } },
  ]);
  assert.equal(groups.uk.length, 0);
  assert.equal(groups.embed, null);
});

test("empty input gives empty groups", () => {
  assert.deepEqual(groupTorrentSources(), { uk: [], ru: [], en: [], pl: [], embed: null });
});

test("legacy search is used only when there is no working plugin", () => {
  assert.equal(shouldUseLegacySearch(null), true);
  assert.equal(shouldUseLegacySearch({ providers: 0, sources: [], errors: [] }), true);
  assert.equal(shouldUseLegacySearch({ providers: 1, sources: [], errors: [{ plugin_id: "torrents" }] }), true);
  assert.equal(shouldUseLegacySearch({ providers: 1, sources: [torrent("uk")], errors: [{}] }), false);
  // The plugin worked and found nothing, or this account removed it.
  assert.equal(shouldUseLegacySearch({ providers: 1, sources: [], errors: [] }), false);
});
