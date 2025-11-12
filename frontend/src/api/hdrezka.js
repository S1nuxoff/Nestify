import axios from "axios";
import config from "../core/config";

const apiClient = axios.create({
  baseURL: `${config.backend_url}/api/v1/rezka/`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getPage = async (link) => {
  try {
    const response = await apiClient.get("get_page", {
      params: {
        link: link,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getMainPage = async () => {
  try {
    const response = await apiClient.get("get_main_page");
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getWatchHistory = async (user_id) => {
  try {
    const response = await apiClient.get("get_watch_history", {
      params: { user_id },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const search = async (query) => {
  try {
    const response = await apiClient.get("search", {
      params: { title: query },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * getMovie(filmLink, userId?)
 * filmLink — ссылка на фильм/сериал
 * userId   — id пользователя (опционально, но если есть — шлем user_id)
 */
export const getMovie = async (filmLink, userId) => {
  try {
    let uid = userId ?? null;

    // если не передали userId явно — пробуем достать из localStorage
    if (uid == null) {
      try {
        const raw = localStorage.getItem("current_user");
        uid = raw ? JSON.parse(raw)?.id : null;
      } catch (e) {
        console.error("bad current_user in localStorage", e);
      }
    }

    const params = { link: filmLink };
    // typeof === "number" — чтобы 0 тоже прошёл, если вдруг
    if (typeof uid === "number") {
      params.user_id = uid;
    }

    console.log("[getMovie] request params:", params);

    const response = await apiClient.get("get_movie", { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getSource = async (
  season_id,
  episode_id,
  movie_id,
  translator_id,
  action
) => {
  try {
    const response = await apiClient.get("get_source", {
      params: {
        film_id: movie_id,
        translator_id: translator_id,
        action: action,
        season_id: season_id,
        episode_id: episode_id,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getCategories = async () => {
  try {
    const response = await apiClient.get("get_categories", {
      params: { url: "https://rezka.ag/" }, // ← url, не link
    });
    return response.data;
  } catch (error) {
    console.error("getCategories error:", error?.response || error);
    throw error;
  }
};

export const getCollections = async (filmLink) => {
  try {
    const response = await apiClient.get("get_collections");
    return response.data;
  } catch (error) {
    throw error;
  }
};
