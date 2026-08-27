import { Module } from '@nestjs/common';

import type { AuthenticationIdentities } from './hexagon/application/authentication-identity';
import type { CredentialProtector } from './hexagon/application/credential-protector';
import type {
  SessionCredentialProtector,
  SessionSecretGenerator,
} from './hexagon/application/session-credentials';
import type { SessionRepository } from './hexagon/application/session.repository';
import { StartSession } from './hexagon/application/start-session';
import { Argon2idCredentialProtector } from './adapters/driven/argon2/argon2id-credential-protector';
import { NodeSessionCredentials } from './adapters/driven/crypto/node-session-credentials';
import { PrismaAuthenticationIdentities } from './adapters/driven/prisma/prisma-authentication-identities';
import { PrismaSessionRepository } from './adapters/driven/prisma/prisma-session.repository';
import {
  SystemAuthenticationClock,
  UuidV7AuthenticationIdGenerator,
} from './adapters/driven/system/system-authentication-dependencies';
import { SessionsController } from './adapters/driving/http/sessions.controller';

const AUTHENTICATION_IDENTITIES = Symbol('AUTHENTICATION_IDENTITIES');
const CREDENTIAL_PROTECTOR = Symbol('CREDENTIAL_PROTECTOR');
const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
const SESSION_CREDENTIALS = Symbol('SESSION_CREDENTIALS');

@Module({
  controllers: [SessionsController],
  providers: [
    PrismaAuthenticationIdentities,
    PrismaSessionRepository,
    {
      provide: AUTHENTICATION_IDENTITIES,
      useExisting: PrismaAuthenticationIdentities,
    },
    {
      provide: CREDENTIAL_PROTECTOR,
      useValue: new Argon2idCredentialProtector(),
    },
    {
      provide: SESSION_REPOSITORY,
      useExisting: PrismaSessionRepository,
    },
    {
      provide: SESSION_CREDENTIALS,
      useValue: new NodeSessionCredentials(),
    },
    {
      provide: StartSession,
      inject: [
        AUTHENTICATION_IDENTITIES,
        CREDENTIAL_PROTECTOR,
        SESSION_REPOSITORY,
        SESSION_CREDENTIALS,
        SESSION_CREDENTIALS,
      ],
      useFactory: (
        identities: AuthenticationIdentities,
        credentials: CredentialProtector,
        sessions: SessionRepository,
        secretGenerator: SessionSecretGenerator,
        sessionCredentialProtector: SessionCredentialProtector,
      ): StartSession =>
        new StartSession(
          identities,
          credentials,
          sessions,
          secretGenerator,
          sessionCredentialProtector,
          new UuidV7AuthenticationIdGenerator(),
          new SystemAuthenticationClock(),
        ),
    },
  ],
})
export class IdentityAccessModule {}
