const landingLoginBtn = document.getElementById('landing-login-btn');
const landingGetStartedBtn = document.getElementById('landing-getstarted-btn');
const landingHeroGetStarted = document.getElementById('landing-hero-getstarted');
const landingHeroLogin = document.getElementById('landing-hero-login');
const loginBackBtn = document.getElementById('login-back-btn');

function openAuth(tab) {
  showLogin();
  switchAuthTab(tab);
}

if (landingLoginBtn) landingLoginBtn.addEventListener('click', () => openAuth('signin'));
if (landingHeroLogin) landingHeroLogin.addEventListener('click', () => openAuth('signin'));
if (landingGetStartedBtn) landingGetStartedBtn.addEventListener('click', () => openAuth('signup'));
if (landingHeroGetStarted) landingHeroGetStarted.addEventListener('click', () => openAuth('signup'));
if (loginBackBtn) loginBackBtn.addEventListener('click', () => showLanding());sss