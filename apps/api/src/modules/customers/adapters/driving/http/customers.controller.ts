import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import type { CustomerMergeResult } from '../../../hexagon/application/customer-merge-book';
import { CustomerPhoneAlreadyExistsError } from '../../../hexagon/application/customer.repository';
import { MergeCustomers } from '../../../hexagon/application/merge-customers';
import {
  RegisterCustomer,
  SearchCustomers,
  UpdateCustomer,
  type UpdateCustomerResult,
} from '../../../hexagon/application/manage-customers';
import type { CustomerView } from '../../../hexagon/application/customer.view';
import {
  InvalidCustomerDniError,
  InvalidCustomerNameError,
  InvalidCustomerPhoneError,
} from '../../../hexagon/domain/customer';
import {
  CustomerDataRequest,
  CustomerListResponse,
  CustomerMergeResponse,
  CustomerResponse,
  CustomerSearchQuery,
  MergeCustomersRequest,
  UpdateCustomerRequest,
} from './customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly registerCustomer: RegisterCustomer,
    private readonly searchCustomers: SearchCustomers,
    private readonly updateCustomer: UpdateCustomer,
    private readonly mergeCustomers: MergeCustomers,
  ) {}

  @Post()
  @RequirePermission('customers:write-basic')
  @ApiOperation({ operationId: 'registerCustomer' })
  @ApiCreatedResponse({ type: CustomerResponse })
  async register(@Body() body: CustomerDataRequest): Promise<CustomerResponse> {
    try {
      return present(await this.registerCustomer.execute(body));
    } catch (error) {
      throwCustomerInput(error);
    }
  }

  @Get()
  @RequirePermission('customers:read')
  @ApiOperation({ operationId: 'searchCustomers' })
  @ApiOkResponse({ type: CustomerListResponse })
  async search(@Query() query: CustomerSearchQuery): Promise<CustomerListResponse> {
    return { items: (await this.searchCustomers.execute(query.query)).map(present) };
  }

  @Put(':customerId')
  @RequirePermission('customers:write-basic')
  @ApiOperation({ operationId: 'updateCustomer' })
  @ApiOkResponse({ type: CustomerResponse })
  async update(
    @Param('customerId', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() body: UpdateCustomerRequest,
  ): Promise<CustomerResponse> {
    try {
      const result = await this.updateCustomer.execute({
        id,
        name: body.name,
        phone: body.phone,
        ...(body.dni === undefined ? {} : { dni: body.dni }),
        ...(body.address === undefined ? {} : { address: body.address }),
        expectedVersion: body.expectedVersion,
      });
      if (!result.ok) throwUpdateError(result);
      return present(result.customer);
    } catch (error) {
      throwCustomerInput(error);
    }
  }

  @Post('merges')
  @RequirePermission('customers:merge')
  @ApiOperation({ operationId: 'mergeCustomers' })
  @ApiCreatedResponse({ type: CustomerMergeResponse })
  async merge(
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: MergeCustomersRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CustomerMergeResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId)) {
      throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const actorId = request.novaActor?.userId;
    if (actorId === undefined) throw new UnauthorizedException();
    try {
      const result = await this.mergeCustomers.merge({
        operationId,
        actorId,
        primaryCustomerId: body.primaryCustomerId,
        duplicateCustomerId: body.duplicateCustomerId,
        expectedPrimaryVersion: body.expectedPrimaryVersion,
        expectedDuplicateVersion: body.expectedDuplicateVersion,
        resolvedName: body.resolvedName,
        resolvedPhone: body.resolvedPhone,
        ...(body.resolvedDni === undefined ? {} : { resolvedDni: body.resolvedDni }),
        ...(body.resolvedAddress === undefined ? {} : { resolvedAddress: body.resolvedAddress }),
      });
      if (!result.ok) throwMergeError(result);
      return {
        id: result.merge.mergeId,
        operationId: result.merge.operationId,
        primaryCustomerId: result.merge.primaryCustomerId,
        duplicateCustomerId: result.merge.duplicateCustomerId,
        primaryVersion: result.merge.primaryVersion,
        duplicateVersion: result.merge.duplicateVersion,
        name: result.merge.identity.name,
        phone: result.merge.identity.phoneNormalized,
        dni: result.merge.identity.dni,
        address: result.merge.identity.address,
        mergedBy: result.merge.actorId,
        mergedAt: result.merge.effectiveAt.toISOString(),
        replayed: result.replayed,
      };
    } catch (error) {
      throwCustomerInput(error);
    }
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function present(view: CustomerView): CustomerResponse {
  return {
    ...view,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
function throwCustomerInput(error: unknown): never {
  if (error instanceof CustomerPhoneAlreadyExistsError)
    throw new ConflictException({
      status: 409,
      code: 'CUSTOMER_PHONE_CONFLICT',
      detail: error.message,
      existingCustomerId: error.customerId,
    });
  if (
    error instanceof InvalidCustomerNameError ||
    error instanceof InvalidCustomerPhoneError ||
    error instanceof InvalidCustomerDniError
  ) {
    throw new UnprocessableEntityException({
      status: 422,
      code: error.name
        .replace(/Error$/, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase(),
      detail: error.message,
    });
  }
  throw error;
}
function throwUpdateError(result: Exclude<UpdateCustomerResult, { ok: true }>): never {
  if (result.reason === 'customer-not-found')
    throw new NotFoundException({
      status: 404,
      code: 'CUSTOMER_NOT_FOUND',
      detail: 'No se encontró el cliente.',
    });
  throw new ConflictException({
    status: 409,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    detail:
      result.reason === 'customer-merged'
        ? 'El cliente fue fusionado y no admite cambios.'
        : 'El cliente cambió; actualiza la información.',
  });
}

function throwMergeError(result: Exclude<CustomerMergeResult, { ok: true }>): never {
  if (result.reason === 'customer-not-found') {
    throw new NotFoundException({ status: 404, code: 'CUSTOMER_NOT_FOUND' });
  }
  if (result.reason === 'same-customer') {
    throw new UnprocessableEntityException({
      status: 422,
      code: 'SAME_CUSTOMER',
      detail: 'El cliente principal y el duplicado deben ser diferentes.',
    });
  }
  throw new ConflictException({
    status: 409,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    detail:
      result.reason === 'idempotency-conflict'
        ? 'Idempotency-Key ya fue utilizado con datos diferentes.'
        : 'Los clientes cambiaron o ya no pueden fusionarse; actualiza la información.',
    ...(result.conflictingCustomerId === undefined
      ? {}
      : { conflictingCustomerId: result.conflictingCustomerId }),
  });
}
