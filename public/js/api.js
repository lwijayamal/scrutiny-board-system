const Auth = {
  get token() { return localStorage.getItem('token'); },
  get user() { try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; } },
  save(token, user) { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('token'); localStorage.removeItem('user'); }
};

async function api(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  const res = await fetch(API_BASE_URL + path, {
    method: method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }
  if (res.status === 401 && Auth.token) {          // session expired
    Auth.clear();
    location.href = 'index.html';
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Error ' + res.status);
  return data;
}
