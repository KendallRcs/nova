import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

import type { Environment } from '../../../../../composition/environment';
import {
  ProductImageStorageUnavailableError,
  type ProductImageStorage,
  type StoredProductImage,
} from '../../../hexagon/application/product-images';

@Injectable()
export class CloudinaryProductImageStorage implements ProductImageStorage {
  private readonly logger = new Logger(CloudinaryProductImageStorage.name);
  private readonly configured: boolean;

  constructor(config: ConfigService<Environment, true>) {
    const cloudinaryUrl = config.get('CLOUDINARY_URL', { infer: true });
    this.configured = cloudinaryUrl !== null;
    if (cloudinaryUrl !== null) configureCloudinary(cloudinaryUrl);
  }

  async store(input: Parameters<ProductImageStorage['store']>[0]): Promise<StoredProductImage> {
    this.assertConfigured();
    try {
      const result = await uploadStream(input);
      return {
        storageKey: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
      };
    } catch (error) {
      this.logger.error('Cloudinary product image upload failed.', errorStack(error));
      throw new ProductImageStorageUnavailableError();
    }
  }

  async remove(storageKey: string): Promise<boolean> {
    if (!this.configured) {
      this.logger.warn(
        `Product image cleanup skipped because Cloudinary is not configured: ${storageKey}`,
      );
      return false;
    }
    try {
      const result = (await cloudinary.uploader.destroy(storageKey, {
        resource_type: 'image',
        invalidate: true,
      })) as { result?: string };
      if (result.result === 'ok' || result.result === 'not found') return true;
      this.logger.warn(`Cloudinary product image cleanup returned ${result.result ?? 'unknown'}.`);
      return false;
    } catch (error) {
      this.logger.error(
        `Cloudinary product image cleanup failed for ${storageKey}.`,
        errorStack(error),
      );
      return false;
    }
  }

  deliveryUrl(storageKey: string): string {
    this.assertConfigured();
    return cloudinary.url(storageKey, {
      secure: true,
      resource_type: 'image',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    });
  }

  private assertConfigured(): void {
    if (!this.configured) throw new ProductImageStorageUnavailableError();
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
  input: Parameters<ProductImageStorage['store']>[0],
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      productImageUploadOptions(input.productId, input.assetId),
      (error, result) => {
        if (error !== undefined) reject(new Error(error.message, { cause: error }));
        else if (result === undefined) reject(new Error('Cloudinary returned no upload result.'));
        else resolve(result);
      },
    );
    stream.end(Buffer.from(input.content));
  });
}

export function productImageUploadOptions(productId: string, assetId: string): UploadApiOptions {
  return {
    resource_type: 'image',
    public_id: `nova/products/${productId}/${assetId}`,
    unique_filename: false,
    overwrite: false,
    format: 'webp',
    transformation: {
      width: 1600,
      height: 1600,
      crop: 'limit',
      quality: 'auto:good',
      flags: 'strip_profile',
    },
  };
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
