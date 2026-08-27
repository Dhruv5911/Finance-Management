const GOOGLE_DEMO_EMAIL = 'demo.user@gmail.com';
const GOOGLE_DEMO_NAME  = 'Google User';

function continueWithGoogle() {
  const accounts = getAccounts();
  let account = accounts.find(a => a.email === GOOGLE_DEMO_EMAIL);

  if (!account) {
    account = { name: GOOGLE_DEMO_NAME, email: GOOGLE_DEMO_EMAIL, password: null };
    accounts.push(account);
    saveAccounts(accounts);
  }

  const user = { name: account.name, email: account.email };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  showToast('Signed In', 'Continued with Google (demo account).', 'success');
  enterApp(user);
}

const googleSigninBtn = document.getElementById('google-signin-btn');
const googleSignupBtn = document.getElementById('google-signup-btn');

if (googleSigninBtn) googleSigninBtn.addEventListener('click', continueWithGoogle);
if (googleSignupBtn) googleSignupBtn.addEventListener('click', continueWithGoogle);s