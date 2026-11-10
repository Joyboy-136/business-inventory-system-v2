(function () {
  const user = initLayout({ active: 'flow', roles: ['owner'] });
  if (!user) return;

  $('#nodeLogin').addEventListener('click', function (e) {
    e.preventDefault();
    Auth.logout();
  });
})();