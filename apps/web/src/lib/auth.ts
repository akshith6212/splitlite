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

function getCognitoUser(email: string): CognitoUser {
  return new CognitoUser({
    Username: email,
    Pool: getUserPool(),
  });
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
        const idTokenPayload = session.getIdToken().decodePayload();
        resolve({
          userId: idTokenPayload['sub'] as string,
          email: idTokenPayload['email'] as string,
          name: (idTokenPayload['name'] as string) || (idTokenPayload['email'] as string),
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
        });
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
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
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

      const idTokenPayload = session.getIdToken().decodePayload();
      resolve({
        userId: idTokenPayload['sub'] as string,
        email: idTokenPayload['email'] as string,
        name: (idTokenPayload['name'] as string) || (idTokenPayload['email'] as string),
        accessToken: session.getAccessToken().getJwtToken(),
        idToken: session.getIdToken().getJwtToken(),
      });
    });
  });
}

export async function getAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

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
  return new Promise((resolve) => {
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

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

        const idTokenPayload = newSession.getIdToken().decodePayload();
        resolve({
          userId: idTokenPayload['sub'] as string,
          email: idTokenPayload['email'] as string,
          name: (idTokenPayload['name'] as string) || (idTokenPayload['email'] as string),
          accessToken: newSession.getAccessToken().getJwtToken(),
          idToken: newSession.getIdToken().getJwtToken(),
        });
      });
    });
  });
}
