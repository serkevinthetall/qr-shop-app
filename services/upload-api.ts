import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/constants/api';
import { platformErrorMessage, unwrapPlatformData } from '@/services/platform-envelope';

/** Multipart image upload → Platform `/api/uploads`. */
export async function uploadPaymentSlip(
  token: string,
  localUri: string,
): Promise<string> {
  const form = new FormData();
  const name = `slip-${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const blobRes = await fetch(localUri);
    const blob = await blobRes.blob();
    const type = blob.type || 'image/jpeg';
    form.append(
      'file',
      blob,
      name.replace(/\.jpg$/i, type.includes('png') ? '.png' : '.jpg'),
    );
  } else {
    form.append('file', {
      uri: localUri,
      name,
      type: 'image/jpeg',
    } as unknown as Blob);
  }

  const res = await fetch(
    `${getApiBaseUrl()}/api/uploads?kind=${encodeURIComponent('payment-slips')}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  );

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Upload failed (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(platformErrorMessage(json, `Upload failed (${res.status})`));
  }

  const data = unwrapPlatformData<{ url?: string; path?: string }>(json);
  const url = String(data?.url || data?.path || '').trim();
  if (!url) {
    throw new Error('Upload succeeded but no file URL was returned.');
  }
  return url;
}
