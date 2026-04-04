// Central API base — uses Render backend on live site, localhost in dev
const BASE = process.env.REACT_APP_API_URL || '';
export const api = (path) => `${BASE}${path}`;
