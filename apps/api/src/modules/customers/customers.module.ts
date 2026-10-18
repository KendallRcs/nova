import { Module } from '@nestjs/common';

import { PrismaCustomerRepository } from './adapters/driven/prisma/prisma-customer.repository';
import { PrismaCustomerMergeBook } from './adapters/driven/prisma/prisma-customer-merge-book';
import { PrismaCustomerAccountSource } from './adapters/driven/prisma/prisma-customer-account-source';
import {
  SystemCustomerClock,
  UuidV7CustomerIdGenerator,
} from './adapters/driven/system/system-customer-dependencies';
import { CustomersController } from './adapters/driving/http/customers.controller';
import type { CustomerRepository } from './hexagon/application/customer.repository';
import type { CustomerMergeBook } from './hexagon/application/customer-merge-book';
import { MergeCustomers } from './hexagon/application/merge-customers';
import {
  GetCustomerAccount,
  type CustomerAccountSource,
} from './hexagon/application/customer-account';
import {
  RegisterCustomer,
  SearchCustomers,
  UpdateCustomer,
} from './hexagon/application/manage-customers';

const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
const CUSTOMER_MERGE_BOOK = Symbol('CUSTOMER_MERGE_BOOK');
const CUSTOMER_ACCOUNT_SOURCE = Symbol('CUSTOMER_ACCOUNT_SOURCE');
@Module({
  controllers: [CustomersController],
  providers: [
    PrismaCustomerRepository,
    PrismaCustomerMergeBook,
    PrismaCustomerAccountSource,
    SystemCustomerClock,
    UuidV7CustomerIdGenerator,
    { provide: CUSTOMER_REPOSITORY, useExisting: PrismaCustomerRepository },
    { provide: CUSTOMER_MERGE_BOOK, useExisting: PrismaCustomerMergeBook },
    { provide: CUSTOMER_ACCOUNT_SOURCE, useExisting: PrismaCustomerAccountSource },
    {
      provide: RegisterCustomer,
      inject: [CUSTOMER_REPOSITORY, UuidV7CustomerIdGenerator, SystemCustomerClock],
      useFactory: (
        repository: CustomerRepository,
        ids: UuidV7CustomerIdGenerator,
        clock: SystemCustomerClock,
      ) => new RegisterCustomer(repository, ids, clock),
    },
    {
      provide: SearchCustomers,
      inject: [CUSTOMER_REPOSITORY],
      useFactory: (repository: CustomerRepository) => new SearchCustomers(repository),
    },
    {
      provide: UpdateCustomer,
      inject: [CUSTOMER_REPOSITORY, SystemCustomerClock],
      useFactory: (repository: CustomerRepository, clock: SystemCustomerClock) =>
        new UpdateCustomer(repository, clock),
    },
    {
      provide: MergeCustomers,
      inject: [CUSTOMER_MERGE_BOOK, UuidV7CustomerIdGenerator, SystemCustomerClock],
      useFactory: (
        book: CustomerMergeBook,
        ids: UuidV7CustomerIdGenerator,
        clock: SystemCustomerClock,
      ) => new MergeCustomers(book, ids, clock),
    },
    {
      provide: GetCustomerAccount,
      inject: [CUSTOMER_ACCOUNT_SOURCE, SystemCustomerClock],
      useFactory: (source: CustomerAccountSource, clock: SystemCustomerClock) =>
        new GetCustomerAccount(source, clock),
    },
  ],
})
export class CustomersModule {}
