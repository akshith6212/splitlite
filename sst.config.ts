/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'splitlite',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: { aws: { region: 'us-east-1' } },
    };
  },

  async run() {
    // -----------------------------------------------------------------------
    // DynamoDB — single-table design
    // -----------------------------------------------------------------------
    const table = new sst.aws.Dynamo('SplitLiteTable', {
      fields: {
        PK: 'string',
        SK: 'string',
      },
      primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
      // DynamoDB Streams: captures both old and new images so the
      // SettlementCalculator can extract groupId from deleted SPLIT items.
      stream: 'new-and-old-images',
    });

    // -----------------------------------------------------------------------
    // SettlementCalculator — DynamoDB Streams consumer (NOT an HTTP Lambda)
    // -----------------------------------------------------------------------
    // Stream filter: only fire on TXN# and SPLIT# writes to avoid an
    // infinite loop when the calculator itself writes SETTLE# records.
    table.subscribe(
      {
        handler: 'functions/settlementCalculator/handler.handler',
        link: [table],
      },
      {
        filters: [
          // TXN# items: written by TransactionsHandler
          {
            dynamodb: {
              Keys: {
                PK: { S: [{ prefix: 'GROUP#' }] },
                SK: { S: [{ prefix: 'TXN#' }] },
              },
            },
          },
          // SPLIT# items: written by TransactionsHandler
          {
            dynamodb: {
              Keys: {
                PK: { S: [{ prefix: 'TXN#' }] },
                SK: { S: [{ prefix: 'SPLIT#' }] },
              },
            },
          },
        ],
      }
    );

    // -----------------------------------------------------------------------
    // Cognito User Pool — auth engine (custom UI, not hosted UI)
    // -----------------------------------------------------------------------
    const userPool = new sst.aws.CognitoUserPool('SplitLiteUserPool', {
      usernames: ['email'],
    });

    const userPoolClient = userPool.addClient('SplitLiteWebClient');

    // -----------------------------------------------------------------------
    // HTTP API Gateway — all routes protected by Cognito JWT authorizer
    // -----------------------------------------------------------------------
    const api = new sst.aws.ApiGatewayV2('SplitLiteApi', {
      cors: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // JWT authorizer backed by the Cognito user pool
    const authorizer = api.addAuthorizer({
      name: 'CognitoJwtAuthorizer',
      jwt: {
        issuer: $interpolate`https://cognito-idp.us-east-1.amazonaws.com/${userPool.id}`,
        audiences: [userPoolClient.id],
      },
    });

    // Common config shared by all protected route handlers
    const fnDefaults = {
      link: [table],
      environment: {
        TABLE_NAME: table.name,
      },
      auth: {
        jwt: { authorizer: authorizer.id },
      },
    };

    // -----------------------------------------------------------------------
    // Users routes
    // -----------------------------------------------------------------------
    api.route('GET /users/me', {
      ...fnDefaults,
      handler: 'functions/users/handler.handler',
    });

    api.route('PUT /users/me', {
      ...fnDefaults,
      handler: 'functions/users/handler.handler',
    });

    // -----------------------------------------------------------------------
    // Groups routes
    // -----------------------------------------------------------------------
    api.route('GET /groups', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('POST /groups', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('GET /groups/{groupId}', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('PUT /groups/{groupId}', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('DELETE /groups/{groupId}', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('GET /groups/{groupId}/members', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('POST /groups/{groupId}/members', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    api.route('DELETE /groups/{groupId}/members/{userId}', {
      ...fnDefaults,
      handler: 'functions/groups/handler.handler',
    });

    // -----------------------------------------------------------------------
    // Transactions routes
    // -----------------------------------------------------------------------
    api.route('POST /groups/{groupId}/transactions', {
      ...fnDefaults,
      handler: 'functions/transactions/handler.handler',
    });

    api.route('GET /groups/{groupId}/transactions', {
      ...fnDefaults,
      handler: 'functions/transactions/handler.handler',
    });

    api.route('GET /groups/{groupId}/transactions/{txnId}', {
      ...fnDefaults,
      handler: 'functions/transactions/handler.handler',
    });

    api.route('PUT /groups/{groupId}/transactions/{txnId}', {
      ...fnDefaults,
      handler: 'functions/transactions/handler.handler',
    });

    api.route('DELETE /groups/{groupId}/transactions/{txnId}', {
      ...fnDefaults,
      handler: 'functions/transactions/handler.handler',
    });

    // -----------------------------------------------------------------------
    // Settlements routes
    // -----------------------------------------------------------------------
    api.route('GET /groups/{groupId}/settlements', {
      ...fnDefaults,
      handler: 'functions/settlements/handler.handler',
    });

    api.route('GET /groups/{groupId}/settlements/{settlementId}', {
      ...fnDefaults,
      handler: 'functions/settlements/handler.handler',
    });

    api.route('POST /groups/{groupId}/settlements/{settlementId}/pay', {
      ...fnDefaults,
      handler: 'functions/settlements/handler.handler',
    });

    // -----------------------------------------------------------------------
    // Outputs — printed after deploy, also used by mobile .env
    // -----------------------------------------------------------------------
    return {
      ApiEndpoint: api.url,
      UserPoolId: userPool.id,
      UserPoolClientId: userPoolClient.id,
      TableName: table.name,
    };
  },
});
