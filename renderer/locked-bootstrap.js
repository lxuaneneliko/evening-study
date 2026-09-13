// Runs before the app renderer so script/preload/state failures never leave
// an empty page. Native Escape remains available even if this script fails.
window.lockedFailure = () => {
  const target = document.querySelector('#locked .locked-center');
  if (target) target.textContent = '專注畫面載入失敗，正在返回桌面。也可以按 Esc 離開。';
  window.planner?.lockFailed().catch(() => {});
};
window.addEventListener('error', window.lockedFailure);
window.addEventListener('unhandledrejection', window.lockedFailure);
document.addEventListener('click', event => {
  if (event.target.closest('[data-action="exit"]')) window.planner?.unlock().catch(window.lockedFailure);
});
