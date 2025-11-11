import { getSource } from "../api/hdrezka";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

const useMovieSource = () => {
  const playMovieSource = async ({
    seasonId,
    episodeId,
    movieId,
    translatorId,
    action,
    meta, // { link, originName, title, image, userId }
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
        console.error("Отримані дані не містять масив джерел:", data);
        return false;
      }

      const selectedTranslate = sourcesArray.find(
        (translate) => translate.translate_id === String(translatorId)
      );

      if (!selectedTranslate) {
        console.error("Джерело для обраної озвучки не знайдено:", translatorId);
        return false;
      }

      if (
        selectedTranslate.source_links &&
        selectedTranslate.source_links.length > 0
      ) {
        const lastSource =
          selectedTranslate.source_links[
            selectedTranslate.source_links.length - 1
          ];
        if (lastSource && lastSource.url) {
          const ok = await nestifyPlayerClient.playOnTv({
            streamUrl: lastSource.url,
            link: meta?.link || null,
            originName: meta?.originName || null,
            title: meta?.title || null,
            image: meta?.image || null,
            movieId,
            season: action === "get_stream" ? seasonId : null,
            episode: action === "get_stream" ? episodeId : null,
            userId: meta?.userId ?? null,
          });

          return ok;
        } else {
          console.error("URL не знайдено в останньому джерелі", lastSource);
          return false;
        }
      } else {
        console.error("Для обраної озвучки немає доступних посилань");
        return false;
      }
    } catch (error) {
      console.error("Помилка при отриманні джерела:", error);
      return false;
    }
  };

  return { playMovieSource };
};

export default useMovieSource;
