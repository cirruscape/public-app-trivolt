// The Host's area: sign in (Amplify Authenticator, against the Cognito pool), then the Host's
// home and Game control.
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signUp,
  type SignUpInput,
} from 'aws-amplify/auth';
import { Route, Routes } from 'react-router';
import { appConfig } from '../config.js';
import { HostGame } from './HostGame.js';
import { HostHistoryDetail, HostHistoryList } from './HostHistory.js';
import { HostHome } from './HostHome.js';
import { NewQuiz } from './NewQuiz.js';
import { QuizPage } from './QuizPage.js';
import { trimGivenName, validateGivenName } from './sign-up.js';
import { withWafBlockMessage } from './waf-block.js';

// Configured here, not in main.tsx, so Amplify stays out of the Players' bundle.
const { userPoolId, userPoolClientId } = appConfig();
Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } });

// The Authenticator only calls handleSignUp with the input, never the context overload.
const signUpTrimmed = ((input: SignUpInput) => signUp(trimGivenName(input))) as typeof signUp;

// Every Cognito call the Authenticator makes, so a WAF block shows the request-access message.
const services = {
  handleSignIn: withWafBlockMessage(signIn),
  handleSignUp: withWafBlockMessage(signUpTrimmed),
  handleConfirmSignIn: withWafBlockMessage(confirmSignIn),
  handleConfirmSignUp: withWafBlockMessage(confirmSignUp),
  handleResendSignUpCode: withWafBlockMessage(resendSignUpCode),
  handleForgotPassword: withWafBlockMessage(resetPassword),
  handleForgotPasswordSubmit: withWafBlockMessage(confirmResetPassword),
  validateCustomSignUp: async (
    formData: Record<string, unknown>,
    touchData: Record<string, boolean>,
  ) => validateGivenName(formData, touchData),
};

// New Hosts must give a first name, though the user pool keeps it optional (see sign-up.ts).
const formFields = {
  signUp: {
    given_name: {
      label: 'First name',
      placeholder: 'Enter your first name',
      isRequired: true,
      autocomplete: 'given-name',
      order: 1,
    },
    email: { order: 2 },
    password: { order: 3 },
    confirm_password: { order: 4 },
  },
};

export function HostApp() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email', 'given_name']}
      formFields={formFields}
      services={services}
    >
      {({ signOut, user }) => (
        <>
          <nav className="hostbar">
            <span className="muted">{user?.signInDetails?.loginId}</span>
            <button type="button" className="link" onClick={signOut}>
              Sign out
            </button>
          </nav>
          <Routes>
            <Route index element={<HostHome />} />
            <Route path="games/:gameId" element={<HostGame />} />
            <Route path="quizzes/new" element={<NewQuiz />} />
            <Route path="quizzes/:quizId" element={<QuizPage />} />
            <Route path="history" element={<HostHistoryList />} />
            <Route path="history/:gameId" element={<HostHistoryDetail />} />
          </Routes>
        </>
      )}
    </Authenticator>
  );
}
