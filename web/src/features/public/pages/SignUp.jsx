/**
 * =============================================================================
 * SIGN UP PAGE
 * =============================================================================
 *
 * User registration page with:
 * - Email/password registration with email verification
 * - Google and Facebook social authentication
 * - Terms and Conditions modal
 * - Show/Hide password toggle
 * - Duplicate account prevention
 * - Gmail registration doesn't require "Agree to Terms" checkbox
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordVisibilityButton from "../../../shared/components/PasswordVisibilityButton";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { auth } from "../../../firebase/config";
import { showNotification } from "../../../shared/utils/notification";
import { authApi } from "../../../shared/api/apiClient";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useAppNavigation } from "../../../shared/hooks/useAppNavigation";
import { recoverFromAuthFailure } from "../../../shared/utils/identitySafety";
import {
  validateEmail,
  validatePassword,
  calculatePasswordStrength,
  sanitizeName,
  generateUsername,
  getFirebaseErrorMessage,
} from "../../../shared/utils/authValidation";
import {
  AUTH_TOAST_DURATION,
  buildAuthWelcomeMessage,
} from "../../../shared/utils/authToasts";
import AuthBrandingPanel from "../../../shared/components/AuthBrandingPanel";
import SocialAuthButtons from "../../../shared/components/SocialAuthButtons";
import FloatingInput from "../../../shared/components/FloatingInput";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../../shared/components/PhoneInput";
import TermsModal from "../../tenant/modals/TermsModal";
import PrivacyModal from "../../tenant/modals/PrivacyModal";
import "../../../shared/styles/auth-forms.css";
import "../styles/tenant-signup.css";
import "../../../shared/styles/notification.css";
import hero1 from "../../../assets/images/hero1.jpg";
import { normalizeInternalContinuation } from "../../../shared/utils/emailVerificationFlow";

const SIGNUP_IMAGE = hero1;
const FIELD_LIMITS = {
  firstName: 50,
  lastName: 50,
  email: 254,
  password: 64,
  confirmPassword: 64,
};

function SignUp() {
  const navigate = useNavigate();
  const appNavigate = useAppNavigation();
  const {
    login: loginBackend,
    setGlobalLoading,
    isAuthenticated,
    user,
    loading: authLoading,
  } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [fieldValid, setFieldValid] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    level: "weak",
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });
  const [debounceTimer, setDebounceTimer] = useState(null);
  // Guard: prevents session lock from auto-redirecting while social
  // auth duplicate check is in progress
  const socialAuthRef = useRef(false);

  // Session lock: Redirect if already logged in
  useEffect(() => {
    if (socialAuthRef.current) return; // skip while checking duplicate
    if (!authLoading && isAuthenticated && user) {
      if (user.role === "branch_admin" || user.role === "owner")
        navigate("/admin/dashboard", { replace: true });
      else navigate("/", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // ── Form handling ──────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    // phone is now handled separately by PhoneInput — skip old guards
    const sanitizedValue =
      name === "firstName" || name === "lastName" ? sanitizeName(value) : value;
    const limit = FIELD_LIMITS[name];
    const nextValue = limit ? sanitizedValue.slice(0, limit) : sanitizedValue;
    setFormData({ ...formData, [name]: nextValue });
    setTouched({ ...touched, [name]: true });
    if (debounceTimer) clearTimeout(debounceTimer);
    if (name === "password")
      setPasswordStrength(calculatePasswordStrength(nextValue));
    const timer = setTimeout(() => validateField(name, nextValue), 300);
    setDebounceTimer(timer);
  };

  // Called directly by PhoneInput with the E.164 value
  const handlePhoneChange = (e164) => {
    setFormData((prev) => ({ ...prev, phone: e164 }));
    setTouched((prev) => ({ ...prev, phone: true }));
    // Use libphonenumber-js for accurate per-country validation
    const isValid = e164 && e164.startsWith("+") && isValidPhoneNumber(e164);
    const error = isValid ? null : "Enter a valid phone number";
    setValidationErrors((prev) => ({ ...prev, phone: error }));
    setFieldValid((prev) => ({ ...prev, phone: isValid }));
  };

  const validateField = (fieldName, value) => {
    let error = null;
    switch (fieldName) {
      case "firstName":
        if (!value.trim()) error = "First name is required";
        else if (value.length > FIELD_LIMITS.firstName)
          error = `First name must be ${FIELD_LIMITS.firstName} characters or less`;
        break;
      case "lastName":
        if (!value.trim()) error = "Last name is required";
        else if (value.length > FIELD_LIMITS.lastName)
          error = `Last name must be ${FIELD_LIMITS.lastName} characters or less`;
        break;
      case "email":
        if (value.length > FIELD_LIMITS.email)
          error = `Email must be ${FIELD_LIMITS.email} characters or less`;
        else error = validateEmail(value);
        break;
      case "phone":
        if (!value || !value.trim()) {
          error = "Phone number is required";
        } else if (
          !value.startsWith("+") ||
          !isValidPhoneNumber(value.trim())
        ) {
          error = "Enter a valid phone number";
        }
        break;
      case "password":
        if (value.length > FIELD_LIMITS.password) {
          error = `Password must be ${FIELD_LIMITS.password} characters or less`;
        } else if (/\s/.test(value)) {
          error = "Password cannot contain spaces";
        } else {
          error = validatePassword(value);
        }
        if (formData.confirmPassword)
          validateField("confirmPassword", formData.confirmPassword);
        break;
      case "confirmPassword":
        if (!value) error = "Please confirm your password";
        else if (value.length > FIELD_LIMITS.confirmPassword)
          error = `Confirm password must be ${FIELD_LIMITS.confirmPassword} characters or less`;
        else if (value !== formData.password) error = "Passwords do not match";
        break;
      default:
        break;
    }
    setValidationErrors((prev) => ({ ...prev, [fieldName]: error }));
    setFieldValid((prev) => ({ ...prev, [fieldName]: !error }));
  };

  const isFormValid = () =>
    [
      "firstName",
      "lastName",
      "email",
      "phone",
      "password",
      "confirmPassword",
    ].every((f) => fieldValid[f]) && agreedToTerms;

  const validateForm = () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });
    [
      "firstName",
      "lastName",
      "email",
      "phone",
      "password",
      "confirmPassword",
    ].forEach((f) => validateField(f, formData[f]));

    // Find the first field with an error and scroll to it
    const scrollToField = (fieldName, message) => {
      showNotification(message, "error");
      setTimeout(() => {
        const el = document.getElementById(fieldName);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 100);
      return false;
    };

    if (!formData.firstName.trim()) {
      return scrollToField("firstName", "First name is required");
    }
    if (formData.firstName.length > FIELD_LIMITS.firstName) {
      return scrollToField(
        "firstName",
        `First name must be ${FIELD_LIMITS.firstName} characters or less`,
      );
    }
    if (!formData.lastName.trim()) {
      return scrollToField("lastName", "Last name is required");
    }
    if (formData.lastName.length > FIELD_LIMITS.lastName) {
      return scrollToField(
        "lastName",
        `Last name must be ${FIELD_LIMITS.lastName} characters or less`,
      );
    }
    if (formData.email.length > FIELD_LIMITS.email) {
      return scrollToField(
        "email",
        `Email must be ${FIELD_LIMITS.email} characters or less`,
      );
    }
    const emailError = validateEmail(formData.email);
    if (emailError) {
      return scrollToField("email", emailError);
    }
    if (!formData.phone || !formData.phone.trim()) {
      return scrollToField("phone", "Phone number is required");
    }
    if (!/^\+\d{7,15}$/.test(formData.phone.trim())) {
      return scrollToField(
        "phone",
        "Enter a valid phone number with country code",
      );
    }
    if (/\s/.test(formData.password)) {
      return scrollToField("password", "Password cannot contain spaces");
    }
    if (formData.password.length > FIELD_LIMITS.password) {
      return scrollToField(
        "password",
        `Password must be ${FIELD_LIMITS.password} characters or less`,
      );
    }
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      return scrollToField("password", passwordError);
    }
    if (formData.password !== formData.confirmPassword) {
      return scrollToField("confirmPassword", "Passwords do not match");
    }
    if (formData.confirmPassword.length > FIELD_LIMITS.confirmPassword) {
      return scrollToField(
        "confirmPassword",
        `Confirm password must be ${FIELD_LIMITS.confirmPassword} characters or less`,
      );
    }
    if (!agreedToTerms) {
      showNotification("Please agree to Terms and Conditions", "error");
      return false;
    }
    return true;
  };

  // ── Registration handlers ──────────────────────────────────
  const registerUserInBackend = async (
    firebaseUser,
    phone,
    firstName,
    lastName,
  ) => {
    let lastCollision = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await authApi.register({
          email: firebaseUser.email,
          username: generateUsername(firebaseUser.email, attempt),
          firstName: sanitizeName(firstName).trim(),
          lastName: sanitizeName(lastName).trim(),
          phone,
        });
      } catch (error) {
        const code = error?.code || error?.response?.data?.code;
        if (code !== "USERNAME_TAKEN") throw error;
        lastCollision = error;
      }
    }
    throw lastCollision || new Error("Unable to allocate a registration username.");
  };

  const completePasswordOnboarding = async (firebaseUser) => {
    const response = await registerUserInBackend(
      firebaseUser,
      formData.phone,
      formData.firstName,
      formData.lastName,
    );

    sessionStorage.removeItem("lilycrest_pending_email");
    localStorage.removeItem("lilycrest_pending_email");

    if (firebaseUser.emailVerified || response?.user?.isEmailVerified) {
      await auth.signOut();
      appNavigate("/signin", {
        replace: true,
        state: { email: formData.email },
        flash: { type: "info", message: "Registration is already complete. Please sign in." },
      });
      return response;
    }

    const requestedContinuation = new URLSearchParams(window.location.search).get("continue");
    const continuePath = normalizeInternalContinuation(requestedContinuation);
    try {
      await authApi.sendEmailVerification(continuePath);
      navigate("/auth-action?state=sent", { replace: true });
    } catch (deliveryError) {
      if (deliveryError.response?.data?.state === "VERIFICATION_EMAIL_SEND_FAILED") {
        navigate("/auth-action?state=send-failed", { replace: true });
      } else {
        await auth.signOut();
        appNavigate("/signin", {
          replace: true,
          state: { email: formData.email },
          flash: {
            type: "warning",
            message: "Account created, but the verification email could not be sent. Please sign in to try again.",
          },
        });
      }
    }
    return response;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    let firebaseUser = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      firebaseUser = userCredential.user;
      try {
        await completePasswordOnboarding(firebaseUser);
      } catch (backendError) {
        await recoverFromAuthFailure(auth, backendError);
        throw backendError;
      }
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        setResumeAvailable(true);
        showNotification(
          "This Firebase account already exists. Enter its password and choose Resume registration to safely continue onboarding.",
          "info",
          7000,
        );
        return;
      }
      showNotification(getFirebaseErrorMessage(error, "signup"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeRegistration = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      await completePasswordOnboarding(credential.user);
    } catch (error) {
      await recoverFromAuthFailure(auth, error);
      showNotification(getFirebaseErrorMessage(error, "signup"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider, providerName = "Google") => {
    setLoading(true);
    socialAuthRef.current = true;
    sessionStorage.setItem("socialAuthInProgress", "1"); // tell RequireNonAdmin to skip redirect
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      if (!firebaseUser.email) {
        await recoverFromAuthFailure(auth);
        socialAuthRef.current = false;
        showNotification(
          "Unable to get email from your Google account.",
          "error",
        );
        setLoading(false);
        return;
      }
      try {
        await authApi.checkUser();
        // User already exists — sign out and redirect to sign-in
        await auth.signOut();
        socialAuthRef.current = false;
        appNavigate("/signin", {
          flash: {
            type: "info",
            message: "This email is already registered. Please sign in instead.",
          },
          replace: true,
        });
        setLoading(false);
        return;
      } catch (loginError) {
        if (loginError.response?.status === 404) {
          try {
            const rawName = (firebaseUser.displayName || "")
              .replace(/[^a-zA-Z\s'-]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            const parts = rawName.split(" ");
            const firstName = parts[0] || "User";
            const lastName = parts.slice(1).join(" ") || "Guest";
            const registration = await registerUserInBackend(
              firebaseUser,
              "",
              firstName,
              lastName,
            );
            const username = registration?.user?.username;
            await loginBackend();
            showNotification(
              buildAuthWelcomeMessage(
                {
                  displayName: firebaseUser.displayName,
                  username,
                  email: firebaseUser.email,
                },
                firstName,
              ),
              "success",
              AUTH_TOAST_DURATION,
            );
            appNavigate("/applicant/check-availability");
          } catch (regError) {
            const errMsg =
              regError.response?.data?.message || regError.message || "";
            const errCode = regError.response?.data?.code || "";

            if (errCode === "IDENTITY_CONFLICT") {
              await recoverFromAuthFailure(auth, regError);
              showNotification(
                "This account requires identity verification before it can be linked. Please use your original sign-in method or contact support.",
                "warning",
                7000,
              );
              return;
            }

            // If the error is about duplicate email/username, redirect to sign-in
            if (
              errCode === "USERNAME_TAKEN" ||
              errCode === "EMAIL_TAKEN" ||
              errMsg.includes("already") ||
              errMsg.includes("duplicate")
            ) {
              await auth.signOut();
              socialAuthRef.current = false;
              appNavigate("/signin", {
                flash: {
                  type: "info",
                  message:
                    "This email is already registered. Please sign in instead.",
                },
                replace: true,
              });
              setLoading(false);
              return;
            }

            // Preserve the Firebase identity; onboarding can be retried safely.
            await recoverFromAuthFailure(auth, regError);
            showNotification(
              errMsg || "An unexpected error occurred.",
              "error",
            );
            setLoading(false);
          }
        } else {
          await recoverFromAuthFailure(auth, loginError);
          if (loginError.response?.data?.code === "IDENTITY_CONFLICT") {
            showNotification(
              "This account requires identity verification before it can be linked. Please use your original sign-in method or contact support.",
              "warning",
              7000,
            );
            return;
          }
          showNotification(
            "An error occurred while checking your account. Please try again.",
            "error",
          );
          setLoading(false);
        }
      }
    } catch (error) {
      await recoverFromAuthFailure(auth, error);
      if (error.code !== "auth/cancelled-popup-request")
        showNotification(
          getFirebaseErrorMessage(error, "signup"),
          error.code === "auth/popup-closed-by-user" ? "info" : "error",
        );
    } finally {
      socialAuthRef.current = false;
      sessionStorage.removeItem("socialAuthInProgress");
      setLoading(false);
    }
  };

  const handleGoogleSignup = () =>
    handleSocialSignup(new GoogleAuthProvider(), "Google");
  const handleFacebookSignup = () =>
    handleSocialSignup(new FacebookAuthProvider(), "Facebook");

  // ── Field renderer helper ──────────────────────────────────
  const inputClass = (name) =>
    `w-full px-4 py-4 rounded-xl bg-gray-50 border focus:outline-none text-gray-900 font-light placeholder:text-gray-400 transition-colors ${touched[name] ? (fieldValid[name] ? "border-green-500" : "border-red-500") : "border-gray-200 focus:border-gray-300"}`;

  return (
    <>
      <div
        className="min-h-screen grid lg:grid-cols-2"
        style={{ backgroundColor: "#0A1628" }}
      >
        <AuthBrandingPanel
          imageUrl={SIGNUP_IMAGE}
          headline="Start Your Journey<br/>With Us"
          subtitle="Join a vibrant community and discover your perfect space today."
        />

        <div className="flex items-center justify-center p-8 lg:p-12 bg-white overflow-y-auto">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="lg:hidden inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
            >
              <span className="text-sm font-light">← Back to website</span>
            </Link>

            <div className="auth-header">
              <h1 className="auth-header__title">Create an account</h1>
              <p className="auth-header__subtitle">
                Already have an account? <Link to="/signin">Log in</Link>
              </p>
            </div>

            <form onSubmit={handleSignUp} className="auth-form">
              <div className="form-row">
                <FloatingInput
                  label="First name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.firstName}
                  disabled={loading}
                  error={touched.firstName ? validationErrors.firstName : null}
                  valid={touched.firstName && fieldValid.firstName}
                />
                <FloatingInput
                  label="Last name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.lastName}
                  disabled={loading}
                  error={touched.lastName ? validationErrors.lastName : null}
                  valid={touched.lastName && fieldValid.lastName}
                />
              </div>

              <FloatingInput
                label="Email address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                maxLength={FIELD_LIMITS.email}
                disabled={loading}
                autoComplete="email"
                error={touched.email ? validationErrors.email : null}
                valid={touched.email && fieldValid.email}
              />

              <PhoneInput
                authStyle
                label="Phone number"
                value={formData.phone}
                onChange={handlePhoneChange}
                hasError={touched.phone && !fieldValid.phone}
                valid={touched.phone && fieldValid.phone}
                error={touched.phone ? validationErrors.phone : null}
                required
              />

              <div>
                <FloatingInput
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  maxLength={FIELD_LIMITS.password}
                  onPaste={(e) => { if (/\s/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                  disabled={loading}
                  error={touched.password ? validationErrors.password : null}
                  valid={touched.password && fieldValid.password}
                  endAdornment={
                    <PasswordVisibilityButton
                      visible={showPassword}
                      onToggle={() => setShowPassword((current) => !current)}
                    />
                  }
                />

                {/* Password strength indicator */}
                {formData.password.length > 0 && (
                  <div className="password-strength">
                    <div className="password-strength__bar-wrap">
                      <span className="password-strength__label">Strength</span>
                      <span
                        className="password-strength__level"
                        style={{
                          color:
                            passwordStrength.score >= 100
                              ? "#10B981"
                              : passwordStrength.score >= 60
                                ? "#F59E0B"
                                : "#EF4444",
                        }}
                      >
                        {passwordStrength.level}
                      </span>
                    </div>
                    <div className="password-strength__track">
                      <div
                        className="password-strength__fill"
                        style={{
                          width: `${passwordStrength.score}%`,
                          backgroundColor:
                            passwordStrength.score >= 100
                              ? "#10B981"
                              : passwordStrength.score >= 60
                                ? "#F59E0B"
                                : "#EF4444",
                        }}
                      />
                    </div>
                    <div className="password-strength__checks">
                      {[
                        { key: "length", label: "8+ characters" },
                        { key: "uppercase", label: "Uppercase" },
                        { key: "lowercase", label: "Lowercase" },
                        { key: "number", label: "Number" },
                        { key: "special", label: "Special char" },
                      ].map(({ key, label }) => (
                        <div
                          key={key}
                          className="password-strength__check"
                          style={{
                            color: passwordStrength.requirements[key]
                              ? "#10B981"
                              : "#9CA3AF",
                          }}
                        >
                          <span
                            className="password-strength__dot"
                            style={{
                              backgroundColor: passwordStrength.requirements[
                                key
                              ]
                                ? "#10B981"
                                : "transparent",
                              color: passwordStrength.requirements[key]
                                ? "white"
                                : "#D1D5DB",
                              border: passwordStrength.requirements[key]
                                ? "none"
                                : "1.5px solid #D1D5DB",
                            }}
                          >
                            {passwordStrength.requirements[key] ? "✓" : ""}
                          </span>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <FloatingInput
                label="Confirm password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                maxLength={FIELD_LIMITS.confirmPassword}
                onPaste={(e) => { if (/\s/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                disabled={loading}
                error={
                  touched.confirmPassword
                    ? validationErrors.confirmPassword
                    : null
                }
                valid={touched.confirmPassword && fieldValid.confirmPassword}
                endAdornment={
                  <PasswordVisibilityButton
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                  />
                }
              />

              <label className="auth-terms">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true); // opens T&C modal
                    }}
                  >
                    Terms & Conditions
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPrivacy(true); // opens Privacy Policy modal
                    }}
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create account"}
              </button>

              {resumeAvailable && (
                <button
                  type="button"
                  className="auth-btn-secondary"
                  disabled={loading}
                  onClick={handleResumeRegistration}
                >
                  {loading ? "Resuming Registration..." : "Resume registration"}
                </button>
              )}

              <SocialAuthButtons
                onGoogle={handleGoogleSignup}
                loading={loading}
                dividerText="Or register with"
              />
            </form>
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      <PrivacyModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />

    </>
  );
}

export default SignUp;
