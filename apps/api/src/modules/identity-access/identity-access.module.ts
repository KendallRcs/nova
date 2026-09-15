import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CsrfTokens } from '../../composition/csrf-tokens';

import type { AuthenticationIdentities } from './hexagon/application/authentication-identity';
import type { AuthenticatedSessions } from './hexagon/application/authenticated-sessions';
import { AuthenticateSession } from './hexagon/application/authenticate-session';
import type { ClosableSessions } from './hexagon/application/closable-sessions';
import { CloseCurrentSession } from './hexagon/application/close-current-session';
import type { CredentialProtector } from './hexagon/application/credential-protector';
import type {
  SessionCredentialProtector,
  SessionSecretGenerator,
} from './hexagon/application/session-credentials';
import type { SessionRepository } from './hexagon/application/session.repository';
import { StartSession } from './hexagon/application/start-session';
import { ResetCollaboratorPassword } from './hexagon/application/reset-collaborator-password';
import { CreateCollaboratorAccount } from './hexagon/application/create-collaborator-account';
import {
  DeactivateCollaboratorAccount,
  ReactivateCollaboratorAccount,
} from './hexagon/application/change-collaborator-account-status';
import type { TemporaryCredentialGenerator } from './hexagon/application/temporary-credential-generator';
import {
  ListCollaboratorAccounts,
  type UserAccountDirectory,
} from './hexagon/application/user-account-directory';
import { EstablishPersonalPassword } from './hexagon/application/establish-personal-password';
import type { UserAccountRepository } from './hexagon/application/user-account.repository';
import type { UserAccountAdministration } from './hexagon/application/user-account-administration';
import { Argon2idCredentialProtector } from './adapters/driven/argon2/argon2id-credential-protector';
import { NodeSessionCredentials } from './adapters/driven/crypto/node-session-credentials';
import { NodeTemporaryCredentialGenerator } from './adapters/driven/crypto/node-temporary-credential-generator';
import { PrismaAuthenticationIdentities } from './adapters/driven/prisma/prisma-authentication-identities';
import { PrismaSessionRepository } from './adapters/driven/prisma/prisma-session.repository';
import { PrismaAuthenticatedSessions } from './adapters/driven/prisma/prisma-authenticated-sessions';
import { PrismaUserAccountRepository } from './adapters/driven/prisma/prisma-user-account.repository';
import { PrismaClosableSessions } from './adapters/driven/prisma/prisma-closable-sessions';
import { PrismaRevocableSessions } from './adapters/driven/prisma/prisma-revocable-sessions';
import {
  SystemAuthenticationClock,
  UuidV7AuthenticationIdGenerator,
} from './adapters/driven/system/system-authentication-dependencies';
import { SessionsController } from './adapters/driving/http/sessions.controller';
import { PasswordController } from './adapters/driving/http/password.controller';
import { CurrentSessionController } from './adapters/driving/http/current-session.controller';
import { PermissionGuard } from './adapters/driving/http/permission.guard';
import { LoginRateLimiter } from './adapters/driving/http/login-rate-limiter';
import { UsersController } from './adapters/driving/http/users.controller';
import type { Environment } from '../../composition/environment';
import {
  RevokeCollaboratorSessions,
  type RevocableSessions,
} from './hexagon/application/revocable-sessions';

const AUTHENTICATION_IDENTITIES = Symbol('AUTHENTICATION_IDENTITIES');
const CREDENTIAL_PROTECTOR = Symbol('CREDENTIAL_PROTECTOR');
const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
const SESSION_CREDENTIALS = Symbol('SESSION_CREDENTIALS');
const AUTHENTICATED_SESSIONS = Symbol('AUTHENTICATED_SESSIONS');
const USER_ACCOUNT_REPOSITORY = Symbol('USER_ACCOUNT_REPOSITORY');
const CLOSABLE_SESSIONS = Symbol('CLOSABLE_SESSIONS');
const TEMPORARY_CREDENTIAL_GENERATOR = Symbol('TEMPORARY_CREDENTIAL_GENERATOR');
const USER_ACCOUNT_DIRECTORY = Symbol('USER_ACCOUNT_DIRECTORY');
const USER_ACCOUNT_ADMINISTRATION = Symbol('USER_ACCOUNT_ADMINISTRATION');
const REVOCABLE_SESSIONS = Symbol('REVOCABLE_SESSIONS');

@Module({
  controllers: [SessionsController, PasswordController, CurrentSessionController, UsersController],
  providers: [
    PrismaAuthenticationIdentities,
    PrismaSessionRepository,
    PrismaAuthenticatedSessions,
    PrismaUserAccountRepository,
    PrismaClosableSessions,
    PrismaRevocableSessions,
    CsrfTokens,
    {
      provide: LoginRateLimiter,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>): LoginRateLimiter =>
        new LoginRateLimiter({
          windowSeconds: config.getOrThrow('LOGIN_RATE_LIMIT_WINDOW_SECONDS'),
          pairMaxAttempts: config.getOrThrow('LOGIN_RATE_LIMIT_PAIR_MAX'),
          ipMaxAttempts: config.getOrThrow('LOGIN_RATE_LIMIT_IP_MAX'),
          globalMaxAttempts: config.getOrThrow('LOGIN_RATE_LIMIT_GLOBAL_MAX'),
        }),
    },
    { provide: APP_GUARD, useClass: PermissionGuard },
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
    { provide: AUTHENTICATED_SESSIONS, useExisting: PrismaAuthenticatedSessions },
    { provide: USER_ACCOUNT_REPOSITORY, useExisting: PrismaUserAccountRepository },
    { provide: USER_ACCOUNT_DIRECTORY, useExisting: PrismaUserAccountRepository },
    { provide: USER_ACCOUNT_ADMINISTRATION, useExisting: PrismaUserAccountRepository },
    { provide: CLOSABLE_SESSIONS, useExisting: PrismaClosableSessions },
    { provide: REVOCABLE_SESSIONS, useExisting: PrismaRevocableSessions },
    {
      provide: TEMPORARY_CREDENTIAL_GENERATOR,
      useValue: new NodeTemporaryCredentialGenerator(),
    },
    {
      provide: CreateCollaboratorAccount,
      inject: [USER_ACCOUNT_ADMINISTRATION, CREDENTIAL_PROTECTOR, TEMPORARY_CREDENTIAL_GENERATOR],
      useFactory: (
        accounts: UserAccountAdministration,
        credentials: CredentialProtector,
        temporaryCredentials: TemporaryCredentialGenerator,
      ): CreateCollaboratorAccount =>
        new CreateCollaboratorAccount(
          accounts,
          credentials,
          temporaryCredentials,
          new UuidV7AuthenticationIdGenerator(),
          new SystemAuthenticationClock(),
        ),
    },
    {
      provide: ListCollaboratorAccounts,
      inject: [USER_ACCOUNT_DIRECTORY],
      useFactory: (directory: UserAccountDirectory): ListCollaboratorAccounts =>
        new ListCollaboratorAccounts(directory),
    },
    {
      provide: DeactivateCollaboratorAccount,
      inject: [USER_ACCOUNT_ADMINISTRATION],
      useFactory: (accounts: UserAccountAdministration): DeactivateCollaboratorAccount =>
        new DeactivateCollaboratorAccount(accounts, new SystemAuthenticationClock()),
    },
    {
      provide: ReactivateCollaboratorAccount,
      inject: [USER_ACCOUNT_ADMINISTRATION, CREDENTIAL_PROTECTOR, TEMPORARY_CREDENTIAL_GENERATOR],
      useFactory: (
        accounts: UserAccountAdministration,
        credentials: CredentialProtector,
        temporaryCredentials: TemporaryCredentialGenerator,
      ): ReactivateCollaboratorAccount =>
        new ReactivateCollaboratorAccount(
          accounts,
          credentials,
          temporaryCredentials,
          new SystemAuthenticationClock(),
        ),
    },
    {
      provide: RevokeCollaboratorSessions,
      inject: [REVOCABLE_SESSIONS],
      useFactory: (sessions: RevocableSessions): RevokeCollaboratorSessions =>
        new RevokeCollaboratorSessions(sessions, new SystemAuthenticationClock()),
    },
    {
      provide: AuthenticateSession,
      inject: [AUTHENTICATED_SESSIONS, SESSION_CREDENTIALS],
      useFactory: (
        sessions: AuthenticatedSessions,
        credentials: SessionCredentialProtector,
      ): AuthenticateSession =>
        new AuthenticateSession(sessions, credentials, new SystemAuthenticationClock()),
    },
    {
      provide: EstablishPersonalPassword,
      inject: [USER_ACCOUNT_REPOSITORY, CREDENTIAL_PROTECTOR],
      useFactory: (
        accounts: UserAccountRepository,
        credentials: CredentialProtector,
      ): EstablishPersonalPassword =>
        new EstablishPersonalPassword(accounts, credentials, new SystemAuthenticationClock()),
    },
    {
      provide: CloseCurrentSession,
      inject: [CLOSABLE_SESSIONS],
      useFactory: (sessions: ClosableSessions): CloseCurrentSession =>
        new CloseCurrentSession(sessions, new SystemAuthenticationClock()),
    },
    {
      provide: ResetCollaboratorPassword,
      inject: [USER_ACCOUNT_REPOSITORY, CREDENTIAL_PROTECTOR, TEMPORARY_CREDENTIAL_GENERATOR],
      useFactory: (
        accounts: UserAccountRepository,
        credentials: CredentialProtector,
        temporaryCredentials: TemporaryCredentialGenerator,
      ): ResetCollaboratorPassword =>
        new ResetCollaboratorPassword(
          accounts,
          credentials,
          temporaryCredentials,
          new SystemAuthenticationClock(),
        ),
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
