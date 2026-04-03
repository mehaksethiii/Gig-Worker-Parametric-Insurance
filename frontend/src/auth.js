export const saveAuth = (token, rider) => {
  localStorage.setItem('token', token);
  localStorage.setItem('riderData', JSON.stringify(rider));
};
export const getToken  = () => localStorage.getItem('token');
export const getRider  = () => { const d = localStorage.getItem('riderData'); return d ? JSON.parse(d) : null; };
export const isLoggedIn = () => !!getToken();
export const logout    = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('riderData');
  localStorage.removeItem('insuranceData');
};
