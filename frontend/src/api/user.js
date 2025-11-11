import axios from "axios";
import config from "../core/config";

const UserApiClient = axios.create({
  baseURL: `${config.backend_url}/api/v1/user/`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const createUser = async ({ name, avatar_url }) => {
  try {
    const response = await UserApiClient.post("/create", {
      name,
      avatar_url,
    });

    return response.data;
  } catch (error) {
    console.error(
      "❌ Failed to create user:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const addMovieToHistory = async ({
  user_id,
  movie_id,
  translator_id,
  action,
  season_id,
  episode_id,
}) => {
  try {
    const response = await UserApiClient.post(
      `/add_movie_to_history`,
      {
        movie_id,
        translator_id,
        action,
        season: season_id,
        episode: episode_id,
      },
      {
        params: { user_id },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to add movie to history:", error);
    throw error;
  }
};
