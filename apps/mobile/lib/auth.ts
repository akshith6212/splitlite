import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserSession,
  ISignUpResult,
} from 'amazon-cognito-identity-js';
import { getUserPool } from './cognito';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  idToken: string;
}

export interface AuthError {
  code: string;
  message: string;
}

// Keep a direct reference to the signed-in CognitoUser so getAccessToken()
// doesn't have to re-derive it from storage (which can fail if the Cognito SDK
// internally changed this.username during the SRP challenge).
let activeCognitoUser: CognitoUser | null = null;

function getCognitoUser(email: string): CognitoUser {
  return new CognitoUser({
    Username: email,
    Pool: getUserPool(),
  });
}

function sessionToAuthUser(session: CognitoUserSession): AuthUser {
  const idTokenPayload = session.getIdToken().decodePayload();
  return {
    userId: idTokenPayload['sub'] as string,
    email: idTokenPayload['email'] as string,
    name: (idTokenPayload['name'] as string) || (idTokenPayload['email'] as string),
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
  };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = getCognitoUser(email);

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        activeCognitoUser = cognitoUser;
        resolve(sessionToAuthUser(session));
      },
      onFailure: (err) => {
        reject({
          code: err.code || 'UnknownError',
          message: err.message || 'Authentication failed',
        } as AuthError);
      },
    });
  });
}

export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<ISignUpResult> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    userPool.signUp(email, password, attributes, [], (err, result) => {
      if (err) {
        reject({
          code: err.code || 'UnknownError',
          message: err.message || 'Sign up failed',
        } as AuthError);
        return;
      }
      if (!result) {
        reject({ code: 'UnknownError', message: 'No result returned from sign up' });
        return;
      }
      resolve(result);
    });
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email);
    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject({
          code: err.code || 'UnknownError',
          message: err.message || 'Confirmation failed',
        } as AuthError);
        return;
      }
      resolve();
    });
  });
}

export async function resendConfirmation(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email);
    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        reject({
          code: err.code || 'UnknownError',
          message: err.message || 'Resend failed',
        } as AuthError);
        return;
      }
      resolve();
    });
  });
}

export async function signOut(): Promise<void> {
  return new Promise((resolve) => {
    const cognitoUser = activeCognitoUser ?? getUserPool().getCurrentUser();
    activeCognitoUser = null;
    if (cognitoUser) {
      cognitoUser.signOut(() => resolve());
    } else {
      resolve();
    }
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // If we have an active user from this session, use it directly.
  if (activeCognitoUser) {
    return new Promise((resolve) => {
      activeCognitoUser!.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          // Session invalid - fall through to pool lookup below
          resolve(_getCurrentUserFromPool());
          return;
        }
        resolve(sessionToAuthUser(session));
      });
    });
  }
  return _getCurrentUserFromPool();
}

function _getCurrentUserFromPool(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      // Restore the active user reference so subsequent calls are fast.
      activeCognitoUser = cognitoUser;
      resolve(sessionToAuthUser(session));
    });
  });
}

export async function getAccessToken(): Promise<string | null> {
  // Use the active CognitoUser directly - it already has the session in memory.
  const cognitoUser = activeCognitoUser ?? getUserPool().getCurrentUser();

  console.log('Getting access token for user:', cognitoUser?.getUsername());

  if (!cognitoUser) {
    return null;
  }

  return new Promise((resolve) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      if (session.isValid()) {
        resolve(session.getAccessToken().getJwtToken());
        return;
      }

      // Session expired - try to refresh
      const refreshToken = session.getRefreshToken();
      cognitoUser.refreshSession(refreshToken, (refreshErr, newSession: CognitoUserSession) => {
        if (refreshErr || !newSession) {
          resolve(null);
          return;
        }
        resolve(newSession.getAccessToken().getJwtToken());
      });
    });
  });
}

export async function refreshTokens(): Promise<AuthUser | null> {
  const cognitoUser = activeCognitoUser ?? getUserPool().getCurrentUser();

  if (!cognitoUser) {
    return null;
  }

  return new Promise((resolve) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      const refreshToken = session.getRefreshToken();
      cognitoUser.refreshSession(refreshToken, (refreshErr, newSession: CognitoUserSession) => {
        if (refreshErr || !newSession) {
          resolve(null);
          return;
        }
        resolve(sessionToAuthUser(newSession));
      });
    });
  });
}
