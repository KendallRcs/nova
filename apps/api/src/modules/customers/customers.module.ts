import { Module } from '@nestjs/common';

import { PrismaCustomerRepository } from './adapters/driven/prisma/prisma-customer.repository';
import {
  SystemCustomerClock,
  UuidV7CustomerIdGenerator,
} from './adapters/driven/system/system-customer-dependencies';
import { CustomersController } from './adapters/driving/http/customers.controller';
import type { CustomerRepository } from './hexagon/application/customer.repository';
import {
  RegisterCustomer,
  SearchCustomers,
  UpdateCustomer,
} from './hexagon/application/manage-customers';

const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
@Module({
  controllers: [CustomersController],
  providers: [
    PrismaCustomerRepository,
    SystemCustomerClock,
    UuidV7CustomerIdGenerator,
    { provide: CUSTOMER_REPOSITORY, useExisting: PrismaCustomerRepository },
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
  ],
})
export class CustomersModule {}
