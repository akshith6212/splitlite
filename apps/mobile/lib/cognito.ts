import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { cognitoStorage } from './secureStorage';

const userPoolId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;

let userPool: CognitoUserPool | null = null;

export function getUserPool(): CognitoUserPool {
  if (!userPool) {
    if (!userPoolId || !clientId) {
      throw new Error(
        'Cognito not configured. Set EXPO_PUBLIC_COGNITO_USER_POOL_ID and EXPO_PUBLIC_COGNITO_CLIENT_ID'
      );
    }
    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
      Storage: cognitoStorage, // Use secure storage instead of AsyncStorage
    });
  }

  return userPool;
}
