// src/api/hdrezka/getMovieStreamUrl.js
import { getSource } from "../hdrezka";

export const getMovieSources = async ({
  seasonId,
  episodeId,
  movieId,
  translatorId,
  action,
}) => {
  try {
    const data = await getSource(
      seasonId,
      episodeId,
      movieId,
      translatorId,
      action
    );

    let sourcesArray = [];

    if (Array.isArray(data)) {
      sourcesArray = data;
    } else if (Array.isArray(data.source)) {
      sourcesArray = data.source;
    } else if (Array.isArray(data.sources)) {
      sourcesArray = data.sources;
    } else {
      console.error("Неизвестный формат источников:", data);
      return [];
    }

    const selectedTranslate = sourcesArray.find(
      (translate) => translate.translate_id === String(translatorId)
    );

    if (!selectedTranslate) {
      console.error("Не найден переводчик:", translatorId);
      return [];
    }

    // тут уже масив { quality, url }
    return selectedTranslate.source_links || [];
  } catch (error) {
    console.error("Ошибка при получении источников:", error);
    return [];
  }
};
