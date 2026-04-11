import axios from "axios";
import config from "../core/config";
import { getAuthToken } from "../core/session";

const client = axios.create({
  baseURL: `${config.backend_url}/api/v1/admin`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

function withAuth() {
  const token = getAuthToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export const getAdminSettings = () =>
  client.get("/settings", withAuth()).then((r) => r.data);

export const patchAdminSettings = (updates) =>
  client.patch("/settings", { updates }, withAuth()).then((r) => r.data);
