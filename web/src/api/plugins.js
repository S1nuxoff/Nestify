import axios from "axios";
import config from "../core/config";
import { getAuthToken } from "../core/session";

const v4 = axios.create({
  baseURL: `${config.backend_url}/api/v4`,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

v4.interceptors.request.use((request) => {
  const token = getAuthToken();
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

// Запитує всі увімкнені плагіни. Повертає { sources, errors }.
export const findPluginSources = async (query) => {
  const res = await v4.post("/sources", query);
  return res.data;
};

// Отримує посилання на відео прямо перед запуском.
export const resolvePluginSource = async (pluginId, sourceId) => {
  const res = await v4.post("/resolve", { plugin_id: pluginId, source_id: sourceId });
  return res.data;
};

// Озвучки профілю й останній перегляд цього тайтлу.
export const getPlaybackState = async (userId, movieId) => {
  const res = await v4.get("/playback", { params: { user_id: userId, movie_id: movieId } });
  return res.data;
};

export const savePlaybackVoice = (body) => v4.put("/playback/voice", body);

// Сторінка «Розширення».
export const getExtensions = async () => {
  const res = await v4.get("/extensions");
  return res.data;
};

export const setExtensionInstalled = (id, installed) => v4.put(`/extensions/${id}`, { installed });

export const addExtensionByLink = (manifestUrl, token) =>
  v4.post("/plugins", { manifest_url: manifestUrl, token: token || undefined });
