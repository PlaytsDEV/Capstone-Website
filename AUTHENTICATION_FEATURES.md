# Authentication System Features

## Implemented Features

### 1. Email Verification System

- **Email/Password Registration**: After creating an account with email and password, users receive a verification email
- **Login Restriction**: Users cannot log in until they verify their email address
- **Resend Verification**: If user tries to login without verification, they're offered to resend the verification email
- **Firebase Integration**: Uses Firebase's `sendEmailVerification()` API
- **Database Field**: Added `isEmailVerified` field to User model to track verification status

### 2. Username Field

- **Registration Form**: New username input field added to sign-up form
- **Validation**:
  - Required field
  - Minimum 3 characters
  - Must be unique (checked at backend)
- **Database**: Added `username` field to User model with unique constraint
- **Social Signup**: Auto-generates username from email for Google/Facebook signups (e.g., `john123` from `john@gmail.com`)

### 3. Improved Error Handling for Google Signup

- **Transaction-like Rollback**: If backend registration fails, the Firebase user account is automatically deleted
- **No Orphaned Accounts**: Prevents situation where Firebase account exists but database record doesn't
- **Specific Error Messages**: Different error messages for different failure scenarios:
  - User already registered → Attempts login instead
  - Username taken → Shows specific error
  - Other backend errors → Shows detailed error message and rolls back
- **Branch Validation**: Checks if Google user already registered in different branch

### 4. Proper Error Prevention

- **Email/Password Registration**:
  1. Validates form fields
  2. Creates Firebase user
  3. Attempts backend registration
  4. If backend fails → Deletes Firebase user (rollback)
  5. If backend succeeds → Sends verification email
- **Google/Facebook Registration**:
  1. Validates terms agreement
  2. Signs in with social provider
  3. Attempts backend registration
  4. If already registered → Tries login instead (checks branch match)
  5. If registration fails → Signs out from Firebase (cleanup)
  6. If login fails → Signs out from Firebase (cleanup)

### 5. Database Schema Updates

#### User Model Fields Added:

```javascript
username: {
  type: String,
  required: true,
  unique: true,
  trim: true,
}

isEmailVerified: {
  type: Boolean,
  default: false,
}

verificationToken: {
  type: String,
}

verificationTokenExpiry: {
  type: Date,
}
```

### 6. Backend API Updates

#### Registration Endpoint (`/auth/register`):

- Now validates username (required, unique)
- Checks username availability
- Stores email verification status from Firebase
- Returns username in response

#### Login Endpoint (`/auth/login`):

- Returns username and email verification status
- No longer allows login for unverified emails (checked at frontend)

## User Flow

### Email/Password Registration:

1. User fills form with username, name, email, password
2. User agrees to terms and conditions
3. System creates Firebase account
4. System registers user in MongoDB
5. System sends verification email
6. User receives "Please verify your email" message
7. User clicks verification link in email
8. User can now log in

### Email/Password Login:

1. User enters email and password
2. System checks if email is verified
3. If not verified → Shows warning and offers to resend email
4. If verified → Proceeds with login
5. Validates branch match
6. Redirects to appropriate branch page

### Google/Facebook Signup:

1. User clicks social signup button
2. User agrees to terms (required)
3. System opens social login popup
4. User authorizes with Google/Facebook
5. System generates username from email
6. System attempts backend registration
7. If successful → Stores user data and redirects
8. If already registered → Attempts login instead
9. Any error → Rolls back Firebase session

### Google/Facebook Login:

1. User clicks social login button
2. System opens social login popup
3. User authorizes with Google/Facebook
4. System attempts login via backend
5. If not found → Redirects to signup
6. If found → Validates branch and redirects

## Security Features

### 1. Rollback Mechanism

- Ensures database and Firebase stay in sync
- No orphaned Firebase accounts
- Proper cleanup on errors

### 2. Email Verification

- Prevents fake/unverified emails
- Required before system access
- Uses Firebase's built-in verification

### 3. Username Uniqueness

- Backend validation
- Database unique constraint
- Clear error messages

### 4. Branch Validation

- Users locked to their registered branch
- Cross-branch login attempts redirected
- Google signup validates branch match

### 5. Comprehensive Error Handling

- Try-catch blocks throughout
- Specific error messages
- Proper error propagation
- User-friendly notifications

## Testing Checklist

- [ ] Email/Password signup creates account and sends verification email
- [ ] Unverified users cannot login
- [ ] Verification email can be resent
- [ ] Verified users can login successfully
- [ ] Username field is required and validated
- [ ] Duplicate usernames are rejected
- [ ] Google signup creates account with auto-generated username
- [ ] Google signup rollback works if backend fails
- [ ] Google signup switches to login if already registered
- [ ] Branch validation works for all signup methods
- [ ] Error messages are clear and helpful
- [ ] Firebase and MongoDB stay in sync (no orphaned accounts)

## Known Limitations

1. **OTP Verification**: Not implemented (only email verification)
2. **Phone Verification**: Not implemented
3. **Password Reset**: Not yet implemented
4. **Account Recovery**: Not yet implemented
5. **Profile Picture Upload**: Not yet implemented

## Future Enhancements

1. Add OTP verification as alternative to email
2. Implement phone number verification
3. Add password reset functionality
4. Create account recovery flow
5. Add profile picture upload during registration
6. Implement 2FA (Two-Factor Authentication)
7. Add social account linking (link Google to existing email account)
8. Email template customization for verification emails
