import axios from "axios";
import config from "../core/config";

const UtilsApiClient = axios.create({
  baseURL: `${config.backend_url}/api/v1/utils/`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAvatars = async () => {
  try {
    const response = await UtilsApiClient.get("avatars", {});
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getUsers = async () => {
  try {
    const response = await UtilsApiClient.get("/users");
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getFeatured = async () => {
  try {
    const response = await UtilsApiClient.get("/featured");
    return response.data;
  } catch (error) {
    throw error;
  }
};
