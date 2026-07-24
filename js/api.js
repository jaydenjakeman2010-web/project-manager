var API_BASE = (function () {
  var server = localStorage.getItem('pm-server') || '';
  return server.replace(/\/+$/, '') + '/api';
})();

var authToken = localStorage.getItem('pm-token');

var pending = {};

function camelize(str) {
  return str.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
}

function camelizeKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    var result = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[camelize(key)] = camelizeKeys(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

function apiFetch(path, options) {
  options = options || {};
  var url = API_BASE + path;
  var headers = options.headers || {};

  if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken;
  }

  var fetchOptions = {
    method: options.method || 'GET',
    headers: headers,
  };

  if (options.body !== undefined) {
    fetchOptions.body = options.body;
  }

  var cacheKey = options.method === 'GET' && path;
  if (cacheKey && pending[cacheKey]) {
    return pending[cacheKey];
  }

  var promise = fetch(url, fetchOptions).then(function (res) {
    if (res.status === 401) {
      setAuthToken(null);
      window.location.reload();
      throw new Error('Session expired');
    }
    if (!res.ok) {
      return res.json().then(function (body) {
        var err = new Error(body.error || 'Request failed');
        err.status = res.status;
        err.body = body;
        throw err;
      }, function () {
        var err = new Error(res.statusText || 'Request failed');
        err.status = res.status;
        throw err;
      });
    }
    return res.json().then(camelizeKeys);
  });

  if (cacheKey) {
    pending[cacheKey] = promise;
    promise.then(function () { delete pending[cacheKey]; }, function () { delete pending[cacheKey]; });
  }

  return promise;
}

function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('pm-token', token);
  } else {
    localStorage.removeItem('pm-token');
  }
}

function setServerUrl(url) {
  if (url) {
    localStorage.setItem('pm-server', url);
  } else {
    localStorage.removeItem('pm-server');
  }
}

function getAuthToken() {
  return authToken;
}

function isLoggedIn() {
  return !!authToken;
}

var API = {
  get: function (path) { return apiFetch(path, { method: 'GET' }); },
  post: function (path, body) { return apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); },
  patch: function (path, body) { return apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }); },
  del: function (path) { return apiFetch(path, { method: 'DELETE' }); },
  upload: function (path, formData) {
    return apiFetch(path, {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
  getSmtpConfig: function () { return apiFetch('/settings/smtp', { method: 'GET' }); },
  saveSmtpConfig: function (cfg) { return apiFetch('/settings/smtp', { method: 'PUT', body: JSON.stringify(cfg) }); },
  testSmtpConfig: function (cfg) { return apiFetch('/settings/smtp/test', { method: 'POST', body: JSON.stringify(cfg) }); },
  setToken: setAuthToken,
  getToken: getAuthToken,
  setServer: setServerUrl,
  isLoggedIn: isLoggedIn,
};
