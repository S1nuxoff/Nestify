import { getSource } from "../hdrezka";

export const getMovieStreamUrl = async ({
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
      return null;
    }

    const selectedTranslate = sourcesArray.find(
      (translate) => translate.translate_id === String(translatorId)
    );

    if (!selectedTranslate) {
      console.error("Не найден переводчик:", translatorId);
      return null;
    }

    const lastSource =
      selectedTranslate.source_links?.[
        selectedTranslate.source_links.length - 1
      ];

    return lastSource?.url || null;
  } catch (error) {
    console.error("Ошибка при получении ссылки на просмотр:", error);
    return null;
  }
};
