import { useNavigate } from 'react-router-dom';

function Navbar({ type = 'landing', currentPage = 'home' }) {
  const navigate = useNavigate();

  // Landing page navigation
  if (type === 'landing') {
    return (
      <nav className="landing-navbar">
        <div className="landing-container">
          <div className="landing-nav-content">
            <button 
              onClick={() => navigate('/')} 
              className={`landing-nav-link ${currentPage === 'home' ? 'active' : ''}`}
            >
              Home
            </button>
            <button 
              onClick={() => document.querySelector('.landing-branches')?.scrollIntoView({ behavior: 'smooth' })} 
              className={`landing-nav-link ${currentPage === 'branches' ? 'active' : ''}`}
            >
              Branches
            </button>
            <button 
              onClick={() => document.querySelector('.landing-about')?.scrollIntoView({ behavior: 'smooth' })} 
              className={`landing-nav-link ${currentPage === 'about' ? 'active' : ''}`}
            >
              About
            </button>
            <button 
              onClick={() => {}} 
              className={`landing-nav-link ${currentPage === 'faqs' ? 'active' : ''}`}
            >
              FAQs
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // Branch page navigation (Gil Puyat or Guadalupe)
  if (type === 'branch') {
    const isBranchGilPuyat = currentPage?.includes('gil-puyat');
    const branchClass = isBranchGilPuyat ? 'gpuyat' : 'guadalupe';
    const navbarClass = `${branchClass}-navbar`;
    const containerClass = `${branchClass}-container`;
    const navLinkClass = `${branchClass}-nav-link`;

    return (
      <nav className={navbarClass}>
        <div className={containerClass}>
          <div className={`${branchClass}-nav-content`}>
            <button 
              onClick={() => navigate('/')} 
              className={navLinkClass}
            >
              Home
            </button>
            <button 
              onClick={() => document.querySelector(`.${branchClass}-location`)?.scrollIntoView({ behavior: 'smooth' })} 
              className={navLinkClass}
            >
              Location
            </button>
            <button 
              onClick={() => {
                if (isBranchGilPuyat) {
                  navigate('/gil-puyat/rooms');
                } else {
                  navigate('/guadalupe/rooms');
                }
              }} 
              className={navLinkClass}
            >
              Rooms & Rates
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return null;
}

export default Navbar;
