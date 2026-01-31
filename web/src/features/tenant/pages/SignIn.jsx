import '../styles/tenant-signin.css';
import logoImage from '../../../landingpage-images/logo.png';
import backgroundImage from '../../../landingpage-images/gil-puyat-branch.png';

function SignIn() {
  return (
    <div className="tenant-signin-page">
      <div className="tenant-signin-card">
        <div className="tenant-signin-left" style={{ backgroundImage: `url(${backgroundImage})` }}>
          <div className="tenant-signin-overlay">
            <div className="tenant-signin-brand">
              <img src={logoImage} alt="Lilycrest" className="tenant-signin-logo" />
              <div className="tenant-signin-brand-text">
                <h2>Lilycrest</h2>
                <span>URBAN CO-LIVING</span>
                <span>GIL PUYAT • MAKATI</span>
              </div>
            </div>
            <div className="tenant-signin-welcome">
              <h3>Welcome to Lilycrest</h3>
              <p>Your Urban Co-Living Space</p>
            </div>
          </div>
        </div>

        <div className="tenant-signin-right">
          <h1 className="tenant-signin-title">Sign In</h1>
          <form className="tenant-signin-form">
            <input
              type="text"
              placeholder="Email/Phone"
              className="tenant-signin-input"
            />
            <input
              type="password"
              placeholder="Password"
              className="tenant-signin-input"
            />
            <button type="button" className="tenant-signin-submit">
              Login
            </button>
          </form>

          <div className="tenant-signin-divider">
            <span></span>
            <span className="tenant-signin-divider-text">Or</span>
            <span></span>
          </div>

          <div className="tenant-signin-social">
            <button type="button" className="tenant-signin-social-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <g clipPath="url(#clip0_5_656)">
                  <path d="M20 10.0608C20 4.53832 15.5225 0.0608215 10 0.0608215C4.4775 0.0608215 0 4.53832 0 10.0608C0 15.0525 3.65667 19.1892 8.4375 19.9392V12.9517H5.89833V10.06H8.4375V7.85832C8.4375 5.35249 9.93083 3.96749 12.215 3.96749C13.3083 3.96749 14.4533 4.16332 14.4533 4.16332V6.62415H13.1917C11.9492 6.62415 11.5617 7.39499 11.5617 8.18582V10.0608H14.335L13.8917 12.9525H11.5617V19.94C16.3433 19.1892 20 15.0517 20 10.0608Z" fill="#1877F2"/>
                </g>
                <defs>
                  <clipPath id="clip0_5_656">
                    <rect width="20" height="20" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              <span>Continue with Facebook</span>
            </button>

            <button type="button" className="tenant-signin-social-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M18.8 10.2083C18.8 9.55831 18.7417 8.93331 18.6333 8.33331H10V11.8833H14.9333C14.7167 13.025 14.0667 13.9916 13.0917 14.6416V16.95H16.0667C17.8 15.35 18.8 13 18.8 10.2083Z" fill="#4285F4"/>
                <path d="M9.99998 19.1667C12.475 19.1667 14.55 18.35 16.0667 16.95L13.0917 14.6417C12.275 15.1917 11.2333 15.525 9.99998 15.525C7.61665 15.525 5.59165 13.9167 4.86665 11.75H1.81665V14.1167C3.32498 17.1083 6.41665 19.1667 9.99998 19.1667Z" fill="#34A853"/>
                <path d="M4.86671 11.7417C4.68337 11.1917 4.57504 10.6083 4.57504 10C4.57504 9.39166 4.68337 8.80833 4.86671 8.25833V5.89166H1.81671C1.19171 7.125 0.833374 8.51666 0.833374 10C0.833374 11.4833 1.19171 12.875 1.81671 14.1083L4.19171 12.2583L4.86671 11.7417Z" fill="#FBBC05"/>
                <path d="M9.99998 4.48331C11.35 4.48331 12.55 4.94998 13.5083 5.84998L16.1333 3.22498C14.5417 1.74165 12.475 0.833313 9.99998 0.833313C6.41665 0.833313 3.32498 2.89165 1.81665 5.89165L4.86665 8.25831C5.59165 6.09165 7.61665 4.48331 9.99998 4.48331Z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="tenant-signin-footer">
            Don&apos;t have an account? <span className="tenant-signin-link">Sign Up Here</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignIn;
