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

export const getMovie = async (filmLink) => {
  try {
    const response = await apiClient.get("get_movie", {
      params: { link: filmLink },
    });
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
