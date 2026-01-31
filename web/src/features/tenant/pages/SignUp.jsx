import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import "../../public/styles/tenant-signup.css";
import "../../../shared/styles/notification.css";
import logoImage from "../../../assets/images/landingpage/logo.png";
import backgroundImage from "../../../assets/images/landingpage/gil-puyat-branch.png";

function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get branch from URL query parameter
  const queryParams = new URLSearchParams(location.search);
  const branch = queryParams.get("branch") || "gil-puyat";

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      showNotification("First name is required", "error");
      return false;
    }
    if (!formData.lastName.trim()) {
      showNotification("Last name is required", "error");
      return false;
    }
    if (!formData.email.trim()) {
      showNotification("Email is required", "error");
      return false;
    }
    if (!formData.password) {
      showNotification("Password is required", "error");
      return false;
    }
    if (formData.password.length < 6) {
      showNotification("Password must be at least 6 characters", "error");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showNotification("Passwords do not match", "error");
      return false;
    }
    if (!agreedToTerms) {
      showNotification("Please agree to Terms and Conditions", "error");
      return false;
    }
    return true;
  };

  const registerUserInBackend = async (firebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await authApi.register(
        {
          email: firebaseUser.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          branch: branch,
        },
        token,
      );

      // Store user data
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(response.user));

      return response.user;
    } catch (error) {
      console.error("Backend registration error:", error);
      throw error;
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );

      // Register in backend
      await registerUserInBackend(userCredential.user);

      showNotification("Account created successfully!", "success");

      setTimeout(() => {
        navigate(`/${branch}`);
      }, 1000);
    } catch (error) {
      console.error("Signup error:", error);
      let errorMessage = "Registration failed. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already registered. Please login instead.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      }

      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider) => {
    // Check terms agreement for social signup too
    if (!agreedToTerms) {
      showNotification("Please agree to Terms and Conditions first", "error");
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      // Extract name from display name
      const displayName = result.user.displayName || "";
      const nameParts = displayName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      try {
        // Try to register
        const response = await authApi.register(
          {
            email: result.user.email,
            firstName: firstName,
            lastName: lastName,
            phone: result.user.phoneNumber || "",
            branch: branch,
          },
          token,
        );

        localStorage.setItem("authToken", token);
        localStorage.setItem("user", JSON.stringify(response.user));

        showNotification("Account created successfully!", "success");

        setTimeout(() => {
          navigate(`/${branch}`);
        }, 1000);
      } catch (error) {
        // If already registered, try login
        if (error.response?.status === 400) {
          try {
            const loginResponse = await authApi.login(token);
            localStorage.setItem("authToken", token);
            localStorage.setItem("user", JSON.stringify(loginResponse.user));

            showNotification("Logged in successfully!", "success");

            setTimeout(() => {
              navigate(`/${branch}`);
            }, 1000);
          } catch (loginError) {
            console.error("Login error:", loginError);
            showNotification(
              "Authentication failed. Please try again.",
              "error",
            );
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Social signup error:", error);
      showNotification(
        "Social authentication failed. Please try again.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const provider = new GoogleAuthProvider();
    handleSocialSignup(provider);
  };

  const handleFacebookSignup = () => {
    const provider = new FacebookAuthProvider();
    handleSocialSignup(provider);
  };

  const branchDisplay =
    branch === "gil-puyat" ? "GIL PUYAT • MAKATI" : "GUADALUPE • MAKATI";

  return (
    <div className="tenant-signup-page">
      <div className="tenant-signup-card">
        <div
          className="tenant-signup-left"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="tenant-signup-overlay">
            <div className="tenant-signup-brand">
              <img
                src={logoImage}
                alt="Lilycrest"
                className="tenant-signup-logo"
              />
              <div className="tenant-signup-brand-text">
                <h2>Lilycrest</h2>
                <span>URBAN CO-LIVING</span>
                <span>{branchDisplay}</span>
              </div>
            </div>
            <div className="tenant-signup-welcome">
              <h3>Join Lilycrest</h3>
              <p>Find Your Perfect Space</p>
            </div>
          </div>
        </div>

        <div className="tenant-signup-right">
          <h1 className="tenant-signup-title">Sign Up</h1>
          <form className="tenant-signup-form" onSubmit={handleSignUp}>
            <input
              type="text"
              name="firstName"
              placeholder="First name"
              className="tenant-signup-input"
              value={formData.firstName}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last name"
              className="tenant-signup-input"
              value={formData.lastName}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="tenant-signup-input"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone/No"
              className="tenant-signup-input"
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="tenant-signup-input"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              className="tenant-signup-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
            />

            <label className="tenant-signup-checkbox">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={loading}
              />
              <span>
                I agree to the{" "}
                <span
                  className="tenant-signup-link"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open("/terms-and-conditions", "_blank");
                  }}
                >
                  Terms and Conditions
                </span>
              </span>
            </label>

            <button
              type="submit"
              className="tenant-signup-submit"
              disabled={!agreedToTerms || loading}
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <div className="tenant-signup-divider">
            <span></span>
            <span className="tenant-signup-divider-text">Or</span>
            <span></span>
          </div>

          <div className="tenant-signup-social">
            <button
              type="button"
              className="tenant-signup-social-btn"
              onClick={handleFacebookSignup}
              disabled={loading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <g clipPath="url(#clip0_5_656)">
                  <path
                    d="M20 10.0608C20 4.53832 15.5225 0.0608215 10 0.0608215C4.4775 0.0608215 0 4.53832 0 10.0608C0 15.0525 3.65667 19.1892 8.4375 19.9392V12.9517H5.89833V10.06H8.4375V7.85832C8.4375 5.35249 9.93083 3.96749 12.215 3.96749C13.3083 3.96749 14.4533 4.16332 14.4533 4.16332V6.62415H13.1917C11.9492 6.62415 11.5617 7.39499 11.5617 8.18582V10.0608H14.335L13.8917 12.9525H11.5617V19.94C16.3433 19.1892 20 15.0517 20 10.0608Z"
                    fill="#1877F2"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_5_656">
                    <rect width="20" height="20" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span>Continue with Facebook</span>
            </button>

            <button
              type="button"
              className="tenant-signup-social-btn"
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M18.8 10.2083C18.8 9.55831 18.7417 8.93331 18.6333 8.33331H10V11.8833H14.9333C14.7167 13.025 14.0667 13.9916 13.0917 14.6416V16.95H16.0667C17.8 15.35 18.8 13 18.8 10.2083Z"
                  fill="#4285F4"
                />
                <path
                  d="M9.99998 19.1667C12.475 19.1667 14.55 18.35 16.0667 16.95L13.0917 14.6417C12.275 15.1917 11.2333 15.525 9.99998 15.525C7.61665 15.525 5.59165 13.9167 4.86665 11.75H1.81665V14.1167C3.32498 17.1083 6.41665 19.1667 9.99998 19.1667Z"
                  fill="#34A853"
                />
                <path
                  d="M4.86671 11.7417C4.68337 11.1917 4.57504 10.6083 4.57504 10C4.57504 9.39166 4.68337 8.80833 4.86671 8.25833V5.89166H1.81671C1.19171 7.125 0.833374 8.51666 0.833374 10C0.833374 11.4833 1.19171 12.875 1.81671 14.1083L4.19171 12.2583L4.86671 11.7417Z"
                  fill="#FBBC05"
                />
                <path
                  d="M9.99998 4.48331C11.35 4.48331 12.55 4.94998 13.5083 5.84998L16.1333 3.22498C14.5417 1.74165 12.475 0.833313 9.99998 0.833313C6.41665 0.833313 3.32498 2.89165 1.81665 5.89165L4.86665 8.25831C5.59165 6.09165 7.61665 4.48331 9.99998 4.48331Z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="tenant-signup-footer">
            Have an account?{" "}
            <span
              className="tenant-signup-link"
              onClick={() => navigate(`/signin?branch=${branch}`)}
              style={{ cursor: "pointer" }}
            >
              Sign Here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
