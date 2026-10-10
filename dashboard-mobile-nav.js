 
(() => {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('mobileMenuToggle');
  if (!sidebar || !toggle) return;
  const close = () => {
    sidebar.classList.remove('mobile-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    const label = toggle.querySelector('.mobile-menu-label');
    if (label) label.textContent = 'Menu';
  };
  const open = () => {
    sidebar.classList.add('mobile-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation menu');
    const label = toggle.querySelector('.mobile-menu-label');
    if (label) label.textContent = 'Close';
  };
  toggle.addEventListener('click', () =>
    sidebar.classList.contains('mobile-open') ? close() : open()
  );
  sidebar.addEventListener('click', event => {
    if (event.target.closest('.navitem')) close();
  });
  document.addEventListener('click', event => {
    if (sidebar.classList.contains('mobile-open') && !sidebar.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
      close();
      toggle.focus();
    }
  });
  window.matchMedia('(min-width:701px)').addEventListener('change', close);
})();
