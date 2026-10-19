import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

import type { Environment } from '../../../../../composition/environment';
import {
  ExpenseReceiptStorageUnavailableError,
  type ExpenseReceiptStorage,
  type StoredExpenseReceipt,
} from '../../../hexagon/application/expense-receipts';
import type { ExpenseReceiptMediaType } from '../../../hexagon/domain/expense-receipt';

@Injectable()
export class CloudinaryExpenseReceiptStorage implements ExpenseReceiptStorage {
  private readonly logger = new Logger(CloudinaryExpenseReceiptStorage.name);
  private readonly configured: boolean;

  constructor(config: ConfigService<Environment, true>) {
    const cloudinaryUrl = config.get('CLOUDINARY_URL', { infer: true });
    this.configured = cloudinaryUrl !== null;
    if (cloudinaryUrl !== null) configureCloudinary(cloudinaryUrl);
  }

  async store(input: Parameters<ExpenseReceiptStorage['store']>[0]): Promise<StoredExpenseReceipt> {
    this.assertConfigured();
    try {
      const result = await uploadStream(input);
      return {
        storageKey: result.public_id,
        mediaType: input.mediaType === 'application/pdf' ? 'application/pdf' : 'image/webp',
        bytes: result.bytes,
      };
    } catch (error) {
      this.logger.error('Cloudinary expense receipt upload failed.', errorStack(error));
      throw new ExpenseReceiptStorageUnavailableError();
    }
  }

  async remove(storageKey: string): Promise<boolean> {
    if (!this.configured) {
      this.logger.warn(`Expense receipt cleanup skipped because Cloudinary is not configured.`);
      return false;
    }
    try {
      const pdf = isPdfStorageKey(storageKey);
      const result = (await cloudinary.uploader.destroy(storageKey, {
        resource_type: pdf ? 'raw' : 'image',
        type: 'authenticated',
        invalidate: true,
      })) as { result?: string };
      if (result.result === 'ok' || result.result === 'not found') return true;
      this.logger.warn(
        `Cloudinary expense receipt cleanup returned ${result.result ?? 'unknown'}.`,
      );
      return false;
    } catch (error) {
      this.logger.error('Cloudinary expense receipt cleanup failed.', errorStack(error));
      return false;
    }
  }

  temporaryAccess(storageKey: string, expiresAt: Date): string {
    this.assertConfigured();
    const pdf = isPdfStorageKey(storageKey);
    return cloudinary.utils.private_download_url(storageKey, pdf ? 'pdf' : 'webp', {
      resource_type: pdf ? 'raw' : 'image',
      type: 'authenticated',
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      attachment: pdf,
    });
  }

  private assertConfigured(): void {
    if (!this.configured) throw new ExpenseReceiptStorageUnavailableError();
  }
}

function configureCloudinary(value: string): void {
  const url = new URL(value);
  cloudinary.config({
    cloud_name: decodeURIComponent(url.hostname),
    api_key: decodeURIComponent(url.username),
    api_secret: decodeURIComponent(url.password),
    secure: true,
  });
}

function uploadStream(
  input: Parameters<ExpenseReceiptStorage['store']>[0],
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      expenseReceiptUploadOptions(input.expenseId, input.assetId, input.mediaType),
      (error, result) => {
        if (error !== undefined) reject(new Error(error.message, { cause: error }));
        else if (result === undefined) reject(new Error('Cloudinary returned no upload result.'));
        else resolve(result);
      },
    );
    stream.end(Buffer.from(input.content));
  });
}

export function expenseReceiptUploadOptions(
  expenseId: string,
  assetId: string,
  mediaType: ExpenseReceiptMediaType,
): UploadApiOptions {
  const publicId = `nova/expense-receipts/${expenseId}/${assetId}`;
  if (mediaType === 'application/pdf') {
    return {
      resource_type: 'raw',
      type: 'authenticated',
      public_id: `${publicId}.pdf`,
      unique_filename: false,
      overwrite: false,
    };
  }
  return {
    resource_type: 'image',
    type: 'authenticated',
    public_id: publicId,
    unique_filename: false,
    overwrite: false,
    format: 'webp',
    transformation: {
      width: 2400,
      height: 2400,
      crop: 'limit',
      quality: 'auto:best',
      flags: 'strip_profile',
    },
  };
}

function isPdfStorageKey(storageKey: string): boolean {
  return storageKey.endsWith('.pdf');
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
