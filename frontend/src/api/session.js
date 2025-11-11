import config from "../core/config";

export const createSession = async (userId, payload) => {
  return fetch(`${config.backend_url}/api/v1/session/add?user_id=${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const deleteSession = async (userId) => {
  return fetch(
    `${config.backend_url}/api/v1/session/remove?user_id=${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
