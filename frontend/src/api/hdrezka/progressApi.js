import axios from "axios";
import config from "../../core/config";

const ProgressApi = axios.create({
  baseURL: `${config.backend_url}/api/v1/rezka/`, // ← перевір префікс
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/** GET /progress?user_id=…&movie_id=…&season=&episode= */
export const getProgress = (params) =>
  ProgressApi.get("progress", { params }).then((r) => r.data);

/** PUT /progress */
export const saveProgress = (body) =>
  ProgressApi.put("progress", body).catch(console.error);
