import {
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

if (!userPoolId || !clientId) {
  console.warn(
    'Cognito environment variables are not set. ' +
    'Please set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID.'
  );
}

let userPool: CognitoUserPool | null = null;

export function getUserPool(): CognitoUserPool {
  if (!userPool) {
    if (!userPoolId || !clientId) {
      throw new Error(
        'Cognito is not configured. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID.'
      );
    }
    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
  }
  return userPool;
}
