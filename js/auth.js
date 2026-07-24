(function () {

  function getQueryParam(name) {
    var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  var tokenFromUrl = getQueryParam('token');
  if (tokenFromUrl) {
    API.setToken(tokenFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  var userData = null;

  function fetchCurrentUser() {
    return API.get('/auth/me').then(function (user) {
      userData = user;
      return user;
    });
  }

  function loginWithGoogle() {
    var base = API_BASE || (window.location.origin + '/api');
    window.location.href = base + '/auth/google';
  }

  function loginWithGithub() {
    var base = API_BASE || (window.location.origin + '/api');
    window.location.href = base + '/auth/github';
  }

  function logout() {
    API.setToken(null);
    userData = null;
    window.location.reload();
  }

  function getUser() {
    return userData;
  }

  function isAuthenticated() {
    return API.isLoggedIn();
  }

  window.Auth = {
    loginWithGoogle: loginWithGoogle,
    loginWithGithub: loginWithGithub,
    logout: logout,
    fetchCurrentUser: fetchCurrentUser,
    getUser: getUser,
    isAuthenticated: isAuthenticated,
  };
})();
