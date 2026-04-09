import axios from "axios";
import config from "../core/config";
import { getAuthToken } from "../core/session";

const AuthApiClient = axios.create({
  baseURL: `${config.backend_url}/api/v1/auth`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

function withAuth() {
  const token = getAuthToken();
  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {};
}

export async function registerAccount(payload) {
  const response = await AuthApiClient.post("/register", payload);
  return response.data;
}

export async function loginAccount(payload) {
  const response = await AuthApiClient.post("/login", payload);
  return response.data;
}

export async function getMe() {
  const response = await AuthApiClient.get("/me", withAuth());
  return response.data;
}

export async function createProfile(payload) {
  const response = await AuthApiClient.post("/profiles", payload, withAuth());
  return response.data;
}

export async function updateProfile(profileId, payload) {
  const response = await AuthApiClient.patch(
    `/profiles/${profileId}`,
    payload,
    withAuth()
  );
  return response.data;
}

export async function deleteProfile(profileId) {
  const response = await AuthApiClient.delete(
    `/profiles/${profileId}`,
    withAuth()
  );
  return response.data;
}

export async function updateAccount(payload) {
  const response = await AuthApiClient.patch("/me", payload, withAuth());
  return response.data;
}
